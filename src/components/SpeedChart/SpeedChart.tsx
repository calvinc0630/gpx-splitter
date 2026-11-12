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
import type { GpxTrack } from '../../types/gpx';

export interface SpeedPoint {
    distance: number; // cumulative distance in km
    speed: number; // km/h
    lat: number;
    lon: number;
    elevation?: number;
}

export interface SpeedChartProps {
    track: GpxTrack;
    boundaries?: number[];
    onHover?: (point: { lat: number; lon: number; elevation?: number } | null) => void;
    onSplitPointsChange?: (boundaries: number[]) => void;
}

const MOUSE_THROTTLE_MS = 50;

const SpeedChartComponent: React.FC<SpeedChartProps> = ({
    track,
    boundaries = [],
    onHover,
    onSplitPointsChange,
}) => {
    const speedData = useMemo<SpeedPoint[]>(() => {
        const res: SpeedPoint[] = [];
        let cumulativeDistance = 0;

        for (let i = 1; i < track.points.length; i++) {
            const prev = track.points[i - 1];
            const cur = track.points[i];

            // distance between prev and cur (km)
            let d = 0;
            try {
                d = calculateDistance(
                    prev.lat,
                    prev.lon,
                    cur.lat,
                    cur.lon,
                    DistanceUnit.KILOMETERS
                );
            } catch {
                // skip invalid segment
                continue;
            }

            // time delta in hours
            const prevTime = prev.time ? new Date(prev.time).getTime() : NaN;
            const curTime = cur.time ? new Date(cur.time).getTime() : NaN;
            const deltaHours =
                !Number.isNaN(prevTime) && !Number.isNaN(curTime) && curTime > prevTime
                    ? (curTime - prevTime) / (1000 * 60 * 60)
                    : NaN;

            const speed = !Number.isNaN(deltaHours) && deltaHours > 0 ? d / deltaHours : NaN;

            cumulativeDistance += d;

            if (!Number.isNaN(speed) && Number.isFinite(speed)) {
                res.push({
                    distance: cumulativeDistance,
                    speed,
                    lat: cur.lat,
                    lon: cur.lon,
                    ...(cur.elevation !== undefined ? { elevation: cur.elevation } : {}),
                });
            }
        }

        return res;
    }, [track.points]);

    // throttled hover handler so map updates aren't excessively frequent
    const handleChartMouseMove = useMemo(
        () =>
            throttle((data: { activeLabel?: string | undefined } | null) => {
                if (data && data.activeLabel !== undefined && onHover) {
                    const distance = parseFloat(String(data.activeLabel));
                    if (!Number.isFinite(distance)) return;

                    // Find the closest chart point to the active distance.
                    const point = speedData.reduce<SpeedPoint | null>((best, p) => {
                        if (best === null) return p;
                        return Math.abs(p.distance - distance) < Math.abs(best.distance - distance)
                            ? p
                            : best;
                    }, null);

                    if (point) {
                        onHover({
                            lat: point.lat,
                            lon: point.lon,
                            ...(point.elevation !== undefined
                                ? { elevation: point.elevation }
                                : {}),
                        });
                    }
                }
            }, MOUSE_THROTTLE_MS),
        [speedData, onHover]
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

    const handleMouseLeave = () => {
        onHover?.(null);
    };

    if (!speedData.length) {
        return (
            <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No speed/time data available</p>
            </div>
        );
    }

    const speeds = speedData.map(d => d.speed);
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);
    const range = Math.max(0.1, maxSpeed - minSpeed);
    const yDomain: [number, number] = [Math.max(0, minSpeed - range * 0.1), maxSpeed + range * 0.1];

    return (
        <div className="w-full">
            <div className="mb-3 p-3 bg-white border border-gray-100 rounded-lg shadow-sm">
                <p className="text-sm text-gray-700">
                    <span className="font-medium">Speed profile</span> shows instantaneous speed
                    between recorded points (km/h). Click to add split points; hover to preview
                    location on the map.
                </p>
            </div>

            <div className="h-48 w-full cursor-pointer">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={speedData}
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
                            domain={yDomain}
                            tickFormatter={v => `${(v as number).toFixed(1)} km/h`}
                            stroke="#6b7280"
                            fontSize={12}
                        />
                        <Tooltip
                            formatter={(value: number) => [`${value.toFixed(1)} km/h`, 'Speed']}
                            labelFormatter={(label: number) => `Distance: ${label.toFixed(2)} km`}
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '12px',
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="speed"
                            stroke="#06b6d4" // cyan accent (visual tweak)
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, stroke: '#06b6d4', fill: '#ffffff' }}
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

export const SpeedChart = React.memo(SpeedChartComponent);
