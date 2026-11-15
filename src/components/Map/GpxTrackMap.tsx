import React, { useEffect, useRef, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import { LatLngBounds, divIcon } from 'leaflet';
import type { GpxTrack } from '../../types/gpx';
import { decimateTrackPoints } from '../../utils/gpx';
import { calculateDistance, DistanceUnit } from '../../utils/distance';
import {
    getSplitMarkerGroups,
    SPLIT_MARKER_RADIUS,
    TRACK_LINE_WIDTH,
    type ScreenPoint,
} from '../../utils/splitMarkerLayout';
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

type SplitPoint = {
    point: GpxTrack['points'][number];
    distance: number;
    label: string;
};

type SplitMarkerPlacement = 'on-track' | 'offset';
type SplitMarkerSize = 'small' | 'medium' | 'large';

const MARKER_SIZE_SCALE: Record<SplitMarkerSize, number> = {
    small: 0.75,
    medium: 1,
    large: 1.4,
};

const createSplitPointIcon = (
    label: string,
    offset: ScreenPoint,
    placement: SplitMarkerPlacement,
    sizeScale: number
) => {
    const markerRadius = SPLIT_MARKER_RADIUS * sizeScale;
    const minX = Math.min(0, offset.x - markerRadius);
    const minY = Math.min(0, offset.y - markerRadius);
    const maxX = Math.max(0, offset.x + markerRadius);
    const maxY = Math.max(0, offset.y + markerRadius);
    const width = Math.ceil(maxX - minX);
    const height = Math.ceil(maxY - minY);
    const target = { x: -minX, y: -minY };
    const circle = { x: offset.x - minX, y: offset.y - minY };

    if (placement === 'on-track') {
        const diameter = markerRadius * 2;
        const fontSize = 14 * sizeScale;
        return divIcon({
            html: `<div style="width:${diameter}px;height:${diameter}px;border-radius:9999px;background:#ef4444;border:2px solid #ffffff;display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:${fontSize}px;font-weight:700;line-height:1">${label}</div>`,
            className: 'custom-split-marker',
            iconSize: [diameter, diameter],
            iconAnchor: [markerRadius, markerRadius],
        });
    }

    const directionLength = Math.hypot(offset.x, offset.y) || 1;
    const connectorEnd = {
        x: circle.x - (offset.x / directionLength) * markerRadius,
        y: circle.y - (offset.y / directionLength) * markerRadius,
    };
    const fontSize = Math.min(12 * sizeScale, (markerRadius * 2 - 4) / label.length);

    return divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><line x1="${target.x}" y1="${target.y}" x2="${connectorEnd.x}" y2="${connectorEnd.y}" stroke="#b91c1c" stroke-width="1" stroke-linecap="round"/><circle cx="${circle.x}" cy="${circle.y}" r="${markerRadius - 1}" fill="#ef4444" stroke="#ffffff" stroke-width="2"/><text x="${circle.x}" y="${circle.y + fontSize / 3}" text-anchor="middle" fill="#ffffff" font-size="${fontSize}" font-weight="700">${label}</text></svg>`,
        className: 'custom-split-marker',
        iconSize: [width, height],
        iconAnchor: [target.x, target.y],
    });
};

const SplitPointMarkers: React.FC<{
    splitPoints: SplitPoint[];
    pathCoordinates: [number, number][];
    placement: SplitMarkerPlacement;
    sizeScale: number;
}> = ({ splitPoints, pathCoordinates, placement, sizeScale }) => {
    const map = useMap();
    const [, setMapViewVersion] = useState(0);

    useEffect(() => {
        const updateMarkerLayout = () => setMapViewVersion(version => version + 1);
        map.on('moveend zoomend resize', updateMarkerLayout);
        return () => {
            map.off('moveend zoomend resize', updateMarkerLayout);
        };
    }, [map]);

    const mapSize = map.getSize();
    const targets = splitPoints.map(({ point }) =>
        map.latLngToContainerPoint([point.lat, point.lon])
    );
    const projectedPath = pathCoordinates.map(coordinate => map.latLngToContainerPoint(coordinate));
    const visibleIndexes = targets.flatMap((target, index) =>
        Number.isFinite(target.x) &&
        Number.isFinite(target.y) &&
        target.x >= 0 &&
        target.x <= mapSize.x &&
        target.y >= 0 &&
        target.y <= mapSize.y
            ? [index]
            : []
    );
    const visibleTargets = visibleIndexes.map(index => targets[index]);
    const markerGroups = (
        placement === 'offset'
            ? getSplitMarkerGroups(
                  visibleTargets,
                  projectedPath,
                  mapSize,
                  SPLIT_MARKER_RADIUS * sizeScale
              )
            : visibleTargets.map((target, index) => ({
                  target,
                  indexes: [index],
                  anchorIndex: index,
                  offset: { x: 0, y: 0 },
              }))
    ).map(group => ({
        ...group,
        splitPoints: group.indexes.map(index => splitPoints[visibleIndexes[index]]),
    }));
    const unplacedPoints = markerGroups
        .filter(group => group.offset === null)
        .flatMap(group => group.splitPoints);

    return (
        <>
            {markerGroups.map(group => {
                const offset = group.offset;
                if (!offset) return null;
                const anchorPoint = splitPoints[visibleIndexes[group.anchorIndex]];
                const markerLabel =
                    group.splitPoints.length === 1
                        ? anchorPoint.label
                        : String(group.splitPoints.length);

                return (
                    <Marker
                        key={`split-${group.indexes.join('-')}`}
                        position={[anchorPoint.point.lat, anchorPoint.point.lon]}
                        title={
                            group.splitPoints.length === 1
                                ? `Split Point ${anchorPoint.label}`
                                : `${group.splitPoints.length} split points: ${group.splitPoints
                                      .map(point => point.label)
                                      .join(', ')}`
                        }
                        icon={createSplitPointIcon(markerLabel, offset, placement, sizeScale)}
                    >
                        <Popup>
                            <div className="text-sm">
                                <div className="font-semibold">
                                    {group.splitPoints.length === 1
                                        ? `Split Point ${anchorPoint.label}`
                                        : `${group.splitPoints.length} Split Points`}
                                </div>
                                {group.splitPoints.map(splitPoint => (
                                    <div className="mt-1" key={splitPoint.label}>
                                        {group.splitPoints.length > 1 && (
                                            <div className="font-medium">
                                                Split Point {splitPoint.label}
                                            </div>
                                        )}
                                        <div>Distance: {splitPoint.distance.toFixed(2)} km</div>
                                        <div>Lat: {splitPoint.point.lat.toFixed(6)}</div>
                                        <div>Lon: {splitPoint.point.lon.toFixed(6)}</div>
                                        {splitPoint.point.elevation && (
                                            <div>
                                                Elevation: {splitPoint.point.elevation.toFixed(1)}m
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
            {unplacedPoints.length > 0 && (
                <div
                    className="leaflet-bottom leaflet-left pointer-events-none"
                    role="status"
                    aria-live="polite"
                >
                    <div className="m-2 rounded bg-white px-3 py-2 text-xs text-gray-700 shadow-lg">
                        Split points {unplacedPoints.map(point => point.label).join(', ')} are
                        grouped; zoom in or pan to display them on the map.
                    </div>
                </div>
            )}
        </>
    );
};

export const GpxTrackMap: React.FC<GpxTrackMapProps> = ({
    track,
    hoveredPoint,
    boundaries = [],
    className = '',
}) => {
    const mapRef = useRef<L.Map | null>(null);
    const [markerPlacement, setMarkerPlacement] = useState<SplitMarkerPlacement>('offset');
    const [markerSize, setMarkerSize] = useState<SplitMarkerSize>('medium');

    // Performance optimization: use decimated points for rendering large tracks
    const displayPoints = useMemo(() => {
        return decimateTrackPoints(track.points, MAP_CONSTANTS.MAX_DISPLAY_POINTS);
    }, [track.points]);

    // Find track points that correspond to split boundaries
    const splitPoints = useMemo<SplitPoint[]>(() => {
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
    const pathCoordinates = useMemo<[number, number][]>(
        () => displayPoints.map(point => [point.lat, point.lon]),
        [displayPoints]
    );

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

                <Polyline
                    positions={pathCoordinates}
                    color="#3b82f6"
                    weight={TRACK_LINE_WIDTH}
                    opacity={0.8}
                />

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

                <SplitPointMarkers
                    splitPoints={splitPoints}
                    pathCoordinates={pathCoordinates}
                    placement={markerPlacement}
                    sizeScale={MARKER_SIZE_SCALE[markerSize]}
                />
            </MapContainer>

            <details className="absolute right-4 top-4 z-[1000]">
                <summary
                    aria-label="Split marker settings"
                    title="Split marker settings"
                    className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-800 shadow-lg hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                    <svg
                        aria-hidden="true"
                        className="h-5 w-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                    >
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </summary>
                <div className="mt-2 w-60 space-y-3 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 shadow-lg">
                    <label className="block">
                        <span className="mb-1 block font-medium">Marker placement</span>
                        <select
                            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                            value={markerPlacement}
                            onChange={event =>
                                setMarkerPlacement(
                                    event.target.value === 'on-track' ? 'on-track' : 'offset'
                                )
                            }
                        >
                            <option value="on-track">On track (original)</option>
                            <option value="offset">Offset with connector</option>
                        </select>
                    </label>
                    <label className="block">
                        <span className="mb-1 block font-medium">Marker size</span>
                        <select
                            className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                            value={markerSize}
                            onChange={event => {
                                const value = event.target.value;
                                if (value === 'small' || value === 'medium' || value === 'large') {
                                    setMarkerSize(value);
                                }
                            }}
                        >
                            <option value="small">Small</option>
                            <option value="medium">Medium</option>
                            <option value="large">Large</option>
                        </select>
                    </label>
                </div>
            </details>

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
