import React, { useCallback, useMemo, useState, useEffect } from 'react';
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

// Constants for performance and UX optimization
const CHART_CONSTANTS = {
    MOUSE_THROTTLE_MS: 50, // Throttle mouse events to prevent performance issues
    CHART_HEIGHT_PX: 400, // Standard chart height for good visibility
} as const;

export interface ElevationPoint {
    distance: number;
    elevation: number;
    lat: number;
    lon: number;
}

export interface ElevationChartProps {
    track: GpxTrack;
    onHover?: (point: { lat: number; lon: number; elevation: number } | null) => void;
    onSplitPointsChange?: (boundaries: number[]) => void;
}

const ElevationChartComponent: React.FC<ElevationChartProps> = ({
    track,
    onHover,
    onSplitPointsChange,
}) => {
    const [boundaries, setBoundaries] = useState<number[]>([]);

    const elevationData = useMemo(() => {
        const points: ElevationPoint[] = [];
        let totalDistance = 0;

        track.points.forEach((point, pointIndex) => {
            if (pointIndex > 0) {
                const prevPoint = track.points[pointIndex - 1];
                try {
                    const distance = calculateDistance(
                        prevPoint.lat,
                        prevPoint.lon,
                        point.lat,
                        point.lon,
                        DistanceUnit.KILOMETERS
                    );
                    totalDistance += distance;
                } catch (error) {
                    // Handle invalid coordinates gracefully - continue with previous distance
                    console.warn('Invalid coordinates in elevation data:', error);
                }
            }

            points.push({
                distance: totalDistance,
                elevation: point.elevation || 0,
                lat: point.lat,
                lon: point.lon,
            });
        });

        return points;
    }, [track.points]);

    // Handle chart click to add split points
    const handleChartClick = useCallback(
        (data: { activeLabel?: string | undefined } | null) => {
            if (data && data.activeLabel !== undefined) {
                const distance = parseFloat(data.activeLabel);

                // Add this distance as a boundary
                const newBoundaries = [...boundaries, distance].sort((a, b) => a - b);
                setBoundaries(newBoundaries);

                // Update parent components
                onSplitPointsChange?.(newBoundaries);
            }
        },
        [boundaries, onSplitPointsChange]
    );

    // Clear all boundaries
    const clearBoundaries = useCallback(() => {
        setBoundaries([]);
        onSplitPointsChange?.([]);
    }, [onSplitPointsChange]);

    // Generate boundaries for segments (only used if boundaries are manually set)
    const segmentBoundaries = useMemo(() => {
        return boundaries;
    }, [boundaries]);

    // Handle mouse events from Recharts - memory-safe throttled implementation
    const handleChartMouseMove = useMemo(() => {
        const baseHandler = (data: { activeLabel?: string | undefined } | null) => {
            if (data && data.activeLabel !== undefined && onHover) {
                const distance = parseFloat(data.activeLabel);
                const point = elevationData.find(p => Math.abs(p.distance - distance) < 0.01);
                if (point) {
                    onHover({
                        lat: point.lat,
                        lon: point.lon,
                        elevation: point.elevation,
                    });
                }
            }
        };

        // Create throttled function with ES Toolkit - automatically handles cleanup
        return throttle(baseHandler, CHART_CONSTANTS.MOUSE_THROTTLE_MS);
    }, [elevationData, onHover]);

    // Clean up throttled function on unmount
    useEffect(() => {
        return () => {
            handleChartMouseMove.cancel();
        };
    }, [handleChartMouseMove]);

    const handleChartMouseLeave = useCallback(() => {
        onHover?.(null);
    }, [onHover]);

    if (!elevationData.length) {
        return (
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No elevation data available</p>
            </div>
        );
    }

    const minElevation = Math.min(...elevationData.map(d => d.elevation));
    const maxElevation = Math.max(...elevationData.map(d => d.elevation));
    const elevationRange = maxElevation - minElevation;
    const yAxisDomain = [
        Math.max(0, minElevation - elevationRange * 0.1),
        maxElevation + elevationRange * 0.1,
    ];

    return (
        <div className="w-full">
            {/* Instructions */}
            <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                    <span className="font-medium">Click on the elevation profile</span> to create
                    split points. Hover to preview location on map.
                </p>
            </div>

            {/* Controls */}
            {boundaries.length > 0 && (
                <div className="mb-3 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm text-blue-800">
                        <span className="font-medium">
                            {boundaries.length + 1} segments created
                        </span>
                        <span className="ml-2 text-blue-600">
                            Split points: {boundaries.map(d => `${d.toFixed(2)}km`).join(', ')}
                        </span>
                    </div>
                    <button
                        onClick={clearBoundaries}
                        className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                        Reset to Single Track
                    </button>
                </div>
            )}

            <div className="h-64 w-full cursor-pointer relative">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={elevationData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        onMouseMove={handleChartMouseMove}
                        onMouseLeave={handleChartMouseLeave}
                        onClick={handleChartClick}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                            dataKey="distance"
                            type="number"
                            scale="linear"
                            domain={['dataMin', 'dataMax']}
                            tickFormatter={value => `${value.toFixed(1)} km`}
                            stroke="#6b7280"
                            fontSize={12}
                        />
                        <YAxis
                            domain={yAxisDomain}
                            tickFormatter={value => `${value.toFixed(0)} m`}
                            stroke="#6b7280"
                            fontSize={12}
                        />
                        <Tooltip
                            formatter={(value: number) => [`${value.toFixed(0)} m`, 'Elevation']}
                            labelFormatter={(label: number) => `Distance: ${label.toFixed(2)} km`}
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                fontSize: '12px',
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="elevation"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, stroke: '#3b82f6', fill: '#ffffff' }}
                        />

                        {/* Render split points as vertical lines */}
                        {segmentBoundaries.map((distance, index) => (
                            <ReferenceLine
                                key={index}
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

// Memoize the component to prevent unnecessary re-renders
export const ElevationChart = React.memo(ElevationChartComponent);
