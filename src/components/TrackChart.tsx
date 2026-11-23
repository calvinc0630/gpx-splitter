import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { throttle } from 'es-toolkit';
import { calculateDistance, DistanceUnit } from '../utils/distance';
import { calculateBearing } from '../utils/direction';
import { getNiceChartAxisScale } from '../utils/chartScale';
import type { GpxTrack, GpxTrackPoint } from '../types/gpx';

interface TrackChartPoint {
    distance: number;
    elevation: number | null;
    speed: number | null;
    bearing: number | null;
    lat: number;
    lon: number;
}

export interface TrackChartProps {
    track: GpxTrack;
    boundaries?: number[];
    onHover?: (point: { lat: number; lon: number; elevation?: number } | null) => void;
    onSplitPointsChange?: (boundaries: number[]) => void;
}

const MOUSE_THROTTLE_MS = 50;
const DIRECTION_DOMAIN: [number, number] = [-200, 200];
const DIRECTION_TICKS = [-180, -90, 0, 90, 180];

const getElevation = (point: GpxTrackPoint): number =>
    typeof point.elevation === 'number' && Number.isFinite(point.elevation) ? point.elevation : 0;

const getValueRange = (values: number[]): [number, number] =>
    values.reduce<[number, number]>(
        ([min, max], value) => [Math.min(min, value), Math.max(max, value)],
        [Infinity, -Infinity]
    );

const interpolate = (previous: number | null, current: number | null): number | null =>
    previous === null || current === null ? null : (previous + current) / 2;

const formatAxisValue = (value: number, step: number, unit: string): string => {
    const decimals = Math.max(0, Math.min(6, -Math.floor(Math.log10(step))));
    return `${Number(value.toFixed(decimals))} ${unit}`;
};

const TrackChartComponent: React.FC<TrackChartProps> = ({
    track,
    boundaries = [],
    onHover,
    onSplitPointsChange,
}) => {
    const [visibleCurves, setVisibleCurves] = useState({
        elevation: true,
        speed: true,
        direction: false,
    });

    const { chartData, hoverPoints } = useMemo(() => {
        const data: TrackChartPoint[] = [];
        const realPoints: TrackChartPoint[] = [];
        let cumulativeDistance = 0;

        for (let index = 0; index < track.points.length; index++) {
            const point = track.points[index];
            const previous = track.points[index - 1];
            let segmentDistance = 0;
            let speed: number | null = null;
            let bearing: number | null = null;
            let hasValidDistance = true;

            if (previous) {
                try {
                    segmentDistance = calculateDistance(
                        previous.lat,
                        previous.lon,
                        point.lat,
                        point.lon,
                        DistanceUnit.KILOMETERS
                    );
                } catch (error) {
                    console.warn('Invalid coordinates in track chart:', error);
                    hasValidDistance = false;
                }

                if (!Number.isFinite(segmentDistance)) {
                    segmentDistance = 0;
                    hasValidDistance = false;
                }
                cumulativeDistance += segmentDistance;

                const previousTime = previous.time ? new Date(previous.time).getTime() : NaN;
                const currentTime = point.time ? new Date(point.time).getTime() : NaN;
                if (
                    hasValidDistance &&
                    Number.isFinite(previousTime) &&
                    Number.isFinite(currentTime) &&
                    currentTime > previousTime
                ) {
                    speed =
                        segmentDistance / ((currentTime - previousTime) / (1000 * 60 * 60));
                }

                if (hasValidDistance) {
                    bearing = calculateBearing(
                        previous.lat,
                        previous.lon,
                        point.lat,
                        point.lon
                    );
                }
            }

            const chartPoint: TrackChartPoint = {
                distance: cumulativeDistance,
                elevation: getElevation(point),
                speed: speed !== null && Number.isFinite(speed) ? speed : null,
                bearing,
                lat: point.lat,
                lon: point.lon,
            };

            const previousChartPoint = realPoints[realPoints.length - 1];
            if (
                previousChartPoint?.bearing !== null &&
                previousChartPoint?.bearing !== undefined &&
                chartPoint.bearing !== null &&
                Math.abs(chartPoint.bearing - previousChartPoint.bearing) > 180
            ) {
                data.push({
                    distance: (previousChartPoint.distance + chartPoint.distance) / 2,
                    elevation: interpolate(previousChartPoint.elevation, chartPoint.elevation),
                    speed: interpolate(previousChartPoint.speed, chartPoint.speed),
                    bearing: null,
                    lat: previousChartPoint.lat,
                    lon: previousChartPoint.lon,
                });
            }

            data.push(chartPoint);
            realPoints.push(chartPoint);
        }

        return { chartData: data, hoverPoints: realPoints };
    }, [track.points]);

    const elevationValues = chartData
        .map(point => point.elevation)
        .filter((value): value is number => value !== null);
    const speedValues = chartData
        .map(point => point.speed)
        .filter((value): value is number => value !== null);
    const directionValues = chartData
        .map(point => point.bearing)
        .filter((value): value is number => value !== null);

    const elevationScale = getNiceChartAxisScale(...getValueRange(elevationValues));
    const speedScale = getNiceChartAxisScale(...getValueRange(speedValues));

    const handleChartMouseMove = useMemo(
        () =>
            throttle((data: { activeLabel?: string | number | undefined } | null) => {
                if (data?.activeLabel === undefined || !onHover) return;

                const distance = Number(data.activeLabel);
                if (!Number.isFinite(distance)) return;

                const point = hoverPoints.reduce<TrackChartPoint | null>((best, current) => {
                    if (best === null) return current;
                    return Math.abs(current.distance - distance) < Math.abs(best.distance - distance)
                        ? current
                        : best;
                }, null);

                if (point) {
                    onHover({
                        lat: point.lat,
                        lon: point.lon,
                        ...(point.elevation !== null ? { elevation: point.elevation } : {}),
                    });
                }
            }, MOUSE_THROTTLE_MS),
        [hoverPoints, onHover]
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
            <div className="flex h-80 items-center justify-center rounded-lg bg-gray-50">
                <p className="text-gray-500">No track data available to chart</p>
            </div>
        );
    }

    const speedStep = speedScale.ticks[1] - speedScale.ticks[0];
    const elevationStep = elevationScale.ticks[1] - elevationScale.ticks[0];

    return (
        <div className="w-full">
            <div className="mb-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                <p className="text-sm text-gray-700">
                    <span className="font-medium">Track profile</span> combines elevation, speed,
                    and direction. Click to add split points; hover to preview location on the map.
                </p>
                <fieldset className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-gray-700">
                    <legend className="sr-only">Curves to display</legend>
                    <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded accent-blue-600 focus:ring-2 focus:ring-blue-500"
                            checked={visibleCurves.elevation}
                            onChange={event =>
                                setVisibleCurves(current => ({
                                    ...current,
                                    elevation: event.target.checked,
                                }))
                            }
                        />
                        Elevation (m)
                    </label>
                    <label
                        className={`flex items-center gap-1.5 ${
                            speedValues.length > 0
                                ? 'cursor-pointer'
                                : 'cursor-not-allowed text-gray-500'
                        }`}
                    >
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded accent-cyan-600 focus:ring-2 focus:ring-cyan-500"
                            checked={visibleCurves.speed && speedValues.length > 0}
                            disabled={speedValues.length === 0}
                            onChange={event =>
                                setVisibleCurves(current => ({
                                    ...current,
                                    speed: event.target.checked,
                                }))
                            }
                        />
                        Speed (km/h)
                        {speedValues.length === 0 && <span>(no time data)</span>}
                    </label>
                    <label
                        className={`flex items-center gap-1.5 ${
                            directionValues.length > 0
                                ? 'cursor-pointer'
                                : 'cursor-not-allowed text-gray-500'
                        }`}
                    >
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded accent-violet-600 focus:ring-2 focus:ring-violet-500"
                            checked={visibleCurves.direction && directionValues.length > 0}
                            disabled={directionValues.length === 0}
                            onChange={event =>
                                setVisibleCurves(current => ({
                                    ...current,
                                    direction: event.target.checked,
                                }))
                            }
                        />
                        Direction (°)
                        {directionValues.length === 0 && <span>(no direction data)</span>}
                    </label>
                </fieldset>
            </div>

            <div className="h-80 w-full cursor-pointer">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={chartData}
                        margin={{ top: 8, right: 12, left: 8, bottom: 5 }}
                        onMouseMove={handleChartMouseMove}
                        onMouseLeave={handleMouseLeave}
                        onClick={handleChartClick}
                    >
                        <CartesianGrid yAxisId="elevation" syncWithTicks stroke="#eef2f7" />
                        <XAxis
                            dataKey="distance"
                            type="number"
                            scale="linear"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={value => `${Number(value).toFixed(1)} km`}
                            stroke="#6b7280"
                            fontSize={12}
                        />
                        <YAxis
                            yAxisId="elevation"
                            type="number"
                            orientation="left"
                            width={visibleCurves.elevation ? 58 : 0}
                            domain={elevationScale.domain}
                            ticks={elevationScale.ticks}
                            interval={0}
                            tickFormatter={value => formatAxisValue(Number(value), elevationStep, 'm')}
                            stroke="#6b7280"
                            fontSize={11}
                            hide={!visibleCurves.elevation}
                        />
                        {speedValues.length > 0 && visibleCurves.speed && (
                            <YAxis
                                yAxisId="speed"
                                type="number"
                                orientation="right"
                                width={72}
                                domain={speedScale.domain}
                                ticks={speedScale.ticks}
                                interval={0}
                                tickFormatter={value =>
                                    formatAxisValue(Number(value), speedStep, 'km/h')
                                }
                                stroke="#6b7280"
                                fontSize={11}
                            />
                        )}
                        <YAxis
                            yAxisId="direction"
                            type="number"
                            orientation="left"
                            width={visibleCurves.direction && directionValues.length > 0 ? 58 : 0}
                            domain={DIRECTION_DOMAIN}
                            ticks={DIRECTION_TICKS}
                            interval={0}
                            tickFormatter={value => `${value}°`}
                            stroke="#6b7280"
                            fontSize={11}
                            hide={!visibleCurves.direction || directionValues.length === 0}
                        />
                        <Tooltip
                            formatter={(value, name) => {
                                if (typeof value !== 'number') {
                                    return [String(value ?? ''), String(name ?? '')];
                                }

                                const unit =
                                    name === 'Elevation'
                                        ? 'm'
                                        : name === 'Speed'
                                          ? 'km/h'
                                          : '°';
                                return [`${value.toFixed(1)} ${unit}`, String(name ?? '')];
                            }}
                            labelFormatter={label =>
                                `Distance: ${Number(label).toFixed(2)} km`
                            }
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.98)',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '12px',
                            }}
                        />
                        <Line
                            yAxisId="elevation"
                            type="monotone"
                            dataKey="elevation"
                            name="Elevation"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, stroke: '#3b82f6', fill: '#ffffff' }}
                            hide={!visibleCurves.elevation}
                        />
                        <Line
                            yAxisId="speed"
                            type="monotone"
                            dataKey="speed"
                            name="Speed"
                            stroke="#06b6d4"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, stroke: '#06b6d4', fill: '#ffffff' }}
                            hide={!visibleCurves.speed || speedValues.length === 0}
                        />
                        <Line
                            yAxisId="direction"
                            type="linear"
                            dataKey="bearing"
                            name="Direction"
                            stroke="#8b5cf6"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                            activeDot={{ r: 4, stroke: '#8b5cf6', fill: '#ffffff' }}
                            hide={!visibleCurves.direction || directionValues.length === 0}
                        />
                        {visibleCurves.direction && directionValues.length > 0 && (
                            <ReferenceLine
                                yAxisId="direction"
                                y={0}
                                stroke="#9ca3af"
                                strokeDasharray="3 3"
                            />
                        )}
                        {boundaries.map((distance, index) => (
                            <ReferenceLine
                                key={`${distance}-${index}`}
                                x={distance}
                                yAxisId="elevation"
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

export const TrackChart = React.memo(TrackChartComponent);
