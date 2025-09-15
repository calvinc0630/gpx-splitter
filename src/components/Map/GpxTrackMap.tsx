import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngBounds, divIcon } from 'leaflet';
import type { GpxTrack } from '../../types/gpx';
import { decimateTrackPoints } from '../../utils/gpx';
import { calculateDistance, DistanceUnit } from '../../utils/distance';
import 'leaflet/dist/leaflet.css';

// Constants for map rendering optimization
const MAP_CONSTANTS = {
    MAX_DISPLAY_POINTS: 2000, // Maximum points to render for performance
    MAP_PADDING: [20, 20] as [number, number], // Padding for map bounds
} as const;

interface GpxTrackMapProps {
    track: GpxTrack;
    hoveredPoint?: { lat: number; lon: number; elevation?: number } | null;
    boundaries?: number[]; // Distances in km where splits occur
    className?: string;
}

// Component to fit map bounds to track
const FitBounds: React.FC<{ track: GpxTrack }> = ({ track }) => {
    const map = useMap();

    useEffect(() => {
        if (track.points.length > 0) {
            const bounds = new LatLngBounds(
                [track.bounds.south, track.bounds.west],
                [track.bounds.north, track.bounds.east]
            );
            map.fitBounds(bounds, { padding: MAP_CONSTANTS.MAP_PADDING });
        }
    }, [map, track]);

    return null;
};

export const GpxTrackMap: React.FC<GpxTrackMapProps> = ({
    track,
    hoveredPoint,
    boundaries = [],
    className = '',
}) => {
    const mapRef = useRef<L.Map | null>(null);

    // Performance optimization: use decimated points for rendering large tracks
    const displayPoints = useMemo(() => {
        return decimateTrackPoints(track.points, MAP_CONSTANTS.MAX_DISPLAY_POINTS);
    }, [track.points]);

    // Find track points that correspond to split boundaries
    const splitPoints = useMemo(() => {
        if (boundaries.length === 0) return [];

        const points = [];
        let cumulativeDistance = 0;

        for (const boundaryDistance of boundaries) {
            let closestPoint = track.points[0];
            let minDiff = Math.abs(0 - boundaryDistance);
            cumulativeDistance = 0;

            for (let i = 0; i < track.points.length; i++) {
                if (i > 0) {
                    const prevPoint = track.points[i - 1];
                    const currentPoint = track.points[i];
                    const segmentDistance = calculateDistance(
                        prevPoint.lat,
                        prevPoint.lon,
                        currentPoint.lat,
                        currentPoint.lon,
                        DistanceUnit.KILOMETERS
                    );
                    cumulativeDistance += segmentDistance;
                }

                const diff = Math.abs(cumulativeDistance - boundaryDistance);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestPoint = track.points[i];
                }
            }

            points.push({
                point: closestPoint,
                distance: boundaryDistance,
                label: String.fromCharCode(65 + points.length), // A, B, C, etc.
            });
        }

        return points;
    }, [track.points, boundaries]);

    // Convert track points to Leaflet LatLng format (using original points for accuracy)
    const pathCoordinates: [number, number][] = displayPoints.map(point => [point.lat, point.lon]);

    // Calculate center point for initial map view
    const centerLat = (track.bounds.north + track.bounds.south) / 2;
    const centerLon = (track.bounds.east + track.bounds.west) / 2;

    // Create custom markers for waypoints
    const createWaypointIcon = () => {
        return divIcon({
            html: `<div class="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs border-2 border-white shadow-lg">📍</div>`,
            className: 'custom-waypoint-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12],
        });
    };

    // Create custom markers for split points
    const createSplitPointIcon = (label: string) => {
        return divIcon({
            html: `<div class="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold border-2 border-white shadow-lg">${label}</div>`,
            className: 'custom-split-marker',
            iconSize: [32, 32],
            iconAnchor: [16, 16],
        });
    };

    // Create custom marker for hovered point
    const createHoverIcon = () => {
        return divIcon({
            html: `<div class="bg-yellow-500 text-white rounded-full w-4 h-4 border-2 border-white shadow-lg animate-pulse"></div>`,
            className: 'custom-hover-marker',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
        });
    };

    return (
        <div className={`relative h-96 w-full ${className}`}>
            <MapContainer
                center={[centerLat, centerLon]}
                zoom={13}
                className="h-full w-full rounded-lg"
                ref={mapRef}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <FitBounds track={track} />

                <Polyline positions={pathCoordinates} color="#3b82f6" weight={4} opacity={0.8} />

                {/* Hover point marker */}
                {hoveredPoint && (
                    <Marker
                        position={[hoveredPoint.lat, hoveredPoint.lon]}
                        icon={createHoverIcon()}
                    >
                        <Popup>
                            <div className="text-sm">
                                <div className="font-semibold">Current Position</div>
                                <div className="mt-1">
                                    <div>Lat: {hoveredPoint.lat.toFixed(6)}</div>
                                    <div>Lon: {hoveredPoint.lon.toFixed(6)}</div>
                                    {hoveredPoint.elevation && (
                                        <div>Elevation: {hoveredPoint.elevation.toFixed(1)}m</div>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Waypoint markers */}
                {track.waypoints?.map((waypoint, index) => (
                    <Marker
                        key={`waypoint-${index}`}
                        position={[waypoint.lat, waypoint.lon]}
                        icon={createWaypointIcon()}
                    >
                        <Popup>
                            <div className="text-sm">
                                <div className="font-semibold">
                                    {waypoint.name || `Waypoint ${index + 1}`}
                                </div>
                                {waypoint.description && (
                                    <div
                                        className="text-gray-600 mt-1"
                                        title={waypoint.description}
                                    >
                                        {waypoint.description}
                                    </div>
                                )}
                                <div className="mt-1">
                                    <div>Lat: {waypoint.lat.toFixed(6)}</div>
                                    <div>Lon: {waypoint.lon.toFixed(6)}</div>
                                    {waypoint.elevation && (
                                        <div>Elevation: {waypoint.elevation.toFixed(1)}m</div>
                                    )}
                                    {waypoint.symbol && (
                                        <div title={waypoint.symbol}>Symbol: {waypoint.symbol}</div>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}

                {/* Split point markers */}
                {splitPoints.map((splitPoint, index) => (
                    <Marker
                        key={`split-${index}`}
                        position={[splitPoint.point.lat, splitPoint.point.lon]}
                        icon={createSplitPointIcon(splitPoint.label)}
                    >
                        <Popup>
                            <div className="text-sm">
                                <div className="font-semibold">Split Point {splitPoint.label}</div>
                                <div className="mt-1">
                                    <div>Distance: {splitPoint.distance.toFixed(2)} km</div>
                                    <div>Lat: {splitPoint.point.lat.toFixed(6)}</div>
                                    <div>Lon: {splitPoint.point.lon.toFixed(6)}</div>
                                    {splitPoint.point.elevation && (
                                        <div>
                                            Elevation: {splitPoint.point.elevation.toFixed(1)}m
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>

            <div className="absolute top-4 left-4 bg-white bg-opacity-90 rounded-lg p-3 shadow-lg">
                <h3 className="font-semibold text-sm text-gray-800 mb-1">{track.name}</h3>
                <div className="text-xs text-gray-600 space-y-1">
                    <div>{track.points.length} track points</div>
                    {track.waypoints && track.waypoints.length > 0 && (
                        <div>
                            {track.waypoints.length} waypoint{track.waypoints.length > 1 ? 's' : ''}
                        </div>
                    )}
                    {splitPoints.length > 0 && (
                        <div className="text-red-600 font-medium">
                            🔴 {splitPoints.length} split point{splitPoints.length > 1 ? 's' : ''} (
                            {splitPoints.map(p => p.label).join(', ')})
                        </div>
                    )}
                    {track.points.some(p => p.elevation !== undefined) && (
                        <div>Elevation data available</div>
                    )}
                    <div className="text-xs text-blue-600 mt-2 font-medium">
                        📍 Visualization Only
                    </div>
                </div>
            </div>
        </div>
    );
};
