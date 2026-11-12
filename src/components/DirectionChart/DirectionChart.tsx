import React, { useMemo, useEffect, useCallback } from 'react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { throttle } from 'es-toolkit';
import { calculateDistance, DistanceUnit } from '../../utils/distance';
import { calculateBearing } from '../../utils/direction';
import type { GpxTrack } from '../../types/gpx';

interface DirectionPoint {
    distance: number;
    bearing: number;
    lat: number;
    lon: number;
    elevation?: number;
}

interface DirectionChartPoint extends Omit<DirectionPoint, 'bearing'> {
    bearing: number | null;
}

export interface DirectionChartProps {
    track: GpxTrack;
    boundaries?: number[];
    onHover?: (point: { lat: number; lon: number; elevation?: number } | null) => void;
    onSplitPointsChange?: (boundaries: number[]) => void;
}

const MOUSE_THROTTLE_MS = 50;

const DirectionChartComponent: React.FC<DirectionChartProps> = ({
    track,
    boundaries = [],
    onHover,
    onSplitPointsChange,
}) => {
    const { chartData, directionPoints } = useMemo(() => {
        const chartPoints: DirectionChartPoint[] = [];
        const points: DirectionPoint[] = [];
        let cumulativeDistance = 0;
        let previousPoint: DirectionPoint | null = null;

        for (let i = 1; i < track.points.length; i++) {
            const prev = track.points[i - 1];
            const cur = track.points[i];

            let distance: number;
            try {
                distance = calculateDistance(
                    prev.lat,
                    prev.lon,
                    cur.lat,
                    cur.lon,
                    DistanceUnit.KILOMETERS
                );
            } catch {
                continue;
            }

            cumulativeDistance += distance;
            const bearing = calculateBearing(prev.lat, prev.lon, cur.lat, cur.lon);
            if (bearing === null) continue;

            const point: DirectionPoint = {
                distance: cumulativeDistance,
                bearing,
                lat: cur.lat,
                lon: cur.lon,
                ...(cur.elevation !== undefined ? { elevation: cur.elevation } : {}),
            };

            if (previousPoint && Math.abs(point.bearing - previousPoint.bearing) > 180) {
                chartPoints.push({
                    ...point,
                    distance: (previousPoint.distance + point.distance) / 2,
                    bearing: null,
                });
            }

            chartPoints.push(point);
            points.push(point);
            previousPoint = point;
        }

        return { chartData: chartPoints, directionPoints: points };
    }, [track.points]);

    const handleChartMouseMove = useMemo(
        () =>
            throttle((data: { activeLabel?: string | number | undefined } | null) => {
                if (data?.activeLabel === undefined || !onHover) return;

                const distance = Number(data.activeLabel);
                if (!Number.isFinite(distance)) return;

                const point = directionPoints.reduce<DirectionPoint | null>((best, current) => {
                    if (best === null) return current;
                    return Math.abs(current.distance - distance) <
                        Math.abs(best.distance - distance)
                        ? current
                        : best;
                }, null);

                if (point) {
                    onHover({
                        lat: point.lat,
                        lon: point.lon,
                        ...(point.elevation !== undefined ? { elevation: point.elevation } : {}),
                    });
                }
            }, MOUSE_THROTTLE_MS),
        [directionPoints, onHover]
    );

    useEffect(() => {
        return () => {
            handleChartMouseMove.cancel();
        };
    }, [handleChartMouseMove]);

    const handleChartClick = useCallback(
        (data: { activeLabel?: string | number | undefined } | null) => {
            if (data?.activeLabel === undefined) return;

            const distance = Number(data.activeLabel);
            if (!Number.isFinite(distance) || boundaries.includes(distance)) return;

            onSplitPointsChange?.([...boundaries, distance].sort((a, b) => a - b));
        },
        [boundaries, onSplitPointsChange]
    );

    const handleMouseLeave = useCallback(() => {
        onHover?.(null);
    }, [onHover]);

    if (!chartData.length) {
        return (
            <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No direction data available</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <div className="mb-3 p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                <p className="text-sm text-gray-700">
                    <span className="font-medium">Direction profile</span> shows the signed bearing
                    of each track segment (0° = north, positive = clockwise). Click to add split
                    points; hover to preview location on the map.
                </p>
            </div>

            <div className="h-48 w-full cursor-pointer">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 8, right: 30, left: 20, bottom: 5 }}
                        onMouseMove={handleChartMouseMove}
                        onMouseLeave={handleMouseLeave}
                        onClick={handleChartClick}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                        <XAxis
                            dataKey="distance"
                            type="number"
                            scale="linear"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={value => `${(value as number).toFixed(1)} km`}
                            stroke="#6b7280"
                            fontSize={12}
                        />
                        <YAxis
                            domain={[-180, 180]}
                            ticks={[-180, -135, -90, -45, 0, 45, 90, 135, 180]}
                            tickFormatter={value => `${value}°`}
                            stroke="#6b7280"
                            fontSize={12}
                        />
                        <Tooltip
                            formatter={value => [
                                typeof value === 'number' ? `${value.toFixed(1)}°` : '—',
                                'Direction',
                            ]}
                            labelFormatter={label => {
                                const distance = Number(label);
                                return Number.isFinite(distance)
                                    ? `Distance: ${distance.toFixed(2)} km`
                                    : '';
                            }}
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '12px',
                            }}
                        />
                        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                        <Line
                            type="linear"
                            dataKey="bearing"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                            activeDot={{ r: 4, stroke: '#8b5cf6', fill: '#ffffff' }}
                        />
                        {boundaries.map((distance, index) => (
                            <ReferenceLine
                                key={`${distance}-${index}`}
                                x={distance}
                                stroke="#ef4444"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                label={{
                                    value: String.fromCharCode(65 + index),
                                    position: 'top',
                                    style: {
                                        fill: '#ef4444',
                                        fontWeight: 'bold',
                                        fontSize: '11px',
                                        textAnchor: 'middle',
                                    },
                                }}
                            />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export const DirectionChart = React.memo(DirectionChartComponent);
