/**
 * Geographic distance calculations using the Haversine formula
 * Based on WGS84 ellipsoid approximation
 */

import type { GpxTrackPoint } from '../types/gpx';

/**
 * Distance units for calculations
 */
export const DistanceUnit = {
    METERS: 'meters',
    KILOMETERS: 'kilometers',
} as const;

export type DistanceUnit = (typeof DistanceUnit)[keyof typeof DistanceUnit];

// Earth's mean radius in meters (WGS84 approximation)
const EARTH_RADIUS_METERS = 6371000;

// Earth's mean radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Convert degrees to radians
 */
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Calculate the great-circle distance between two points on Earth using the Haversine formula
 *
 * @param lat1 - Latitude of first point in decimal degrees
 * @param lon1 - Longitude of first point in decimal degrees
 * @param lat2 - Latitude of second point in decimal degrees
 * @param lon2 - Longitude of second point in decimal degrees
 * @param unit - Unit for returned distance
 * @returns Distance between points in specified unit
 */
export const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    unit: DistanceUnit = DistanceUnit.METERS
): number => {
    // Validate coordinate ranges
    if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
        throw new Error('Latitude must be between -90 and 90 degrees');
    }
    if (lon1 < -180 || lon1 >= 180 || lon2 < -180 || lon2 >= 180) {
        throw new Error('Longitude must be between -180 and 180 degrees');
    }

    // Convert degrees to radians
    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);

    // Haversine formula
    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // Return distance in requested unit
    const radius = unit === DistanceUnit.KILOMETERS ? EARTH_RADIUS_KM : EARTH_RADIUS_METERS;
    return radius * c;
};

/**
 * Calculate distance between two GPX track points
 *
 * @param point1 - First GPX track point
 * @param point2 - Second GPX track point
 * @param unit - Unit for returned distance
 * @returns Distance between points in specified unit
 */
export const calculateDistanceBetweenPoints = (
    point1: GpxTrackPoint,
    point2: GpxTrackPoint,
    unit: DistanceUnit = DistanceUnit.METERS
): number => {
    return calculateDistance(point1.lat, point1.lon, point2.lat, point2.lon, unit);
};

/**
 * Calculate total distance along a series of GPX track points
 *
 * @param points - Array of GPX track points in order
 * @param unit - Unit for returned distance
 * @returns Total distance along the track in specified unit
 */
export const getTotalDistance = (
    points: GpxTrackPoint[],
    unit: DistanceUnit = DistanceUnit.METERS
): number => {
    if (points.length < 2) {
        return 0;
    }

    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
        totalDistance += calculateDistanceBetweenPoints(points[i - 1], points[i], unit);
    }

    return totalDistance;
};

/**
 * Find the point index that corresponds to a target cumulative distance
 *
 * @param points - Array of GPX track points in order
 * @param targetDistance - Target cumulative distance
 * @param unit - Unit of the target distance
 * @returns Object with index and actual distance at that point
 */
export const findPointAtDistance = (
    points: GpxTrackPoint[],
    targetDistance: number,
    unit: DistanceUnit = DistanceUnit.METERS
): { index: number; actualDistance: number } => {
    if (points.length === 0) {
        return { index: 0, actualDistance: 0 };
    }

    if (targetDistance <= 0) {
        return { index: 0, actualDistance: 0 };
    }

    let cumulativeDistance = 0;
    let closestIndex = 0;
    let minDiff = Infinity;

    for (let i = 1; i < points.length; i++) {
        const segmentDistance = calculateDistanceBetweenPoints(points[i - 1], points[i], unit);
        cumulativeDistance += segmentDistance;

        const diff = Math.abs(cumulativeDistance - targetDistance);
        if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
        }

        // If we've passed the target, the closest is either current or previous
        if (cumulativeDistance >= targetDistance) {
            break;
        }
    }

    // Calculate actual distance at the closest index
    let actualDistance = 0;
    for (let i = 1; i <= closestIndex; i++) {
        actualDistance += calculateDistanceBetweenPoints(points[i - 1], points[i], unit);
    }

    return { index: closestIndex, actualDistance };
};

/**
 * Calculate cumulative distances along a track
 *
 * @param points - Array of GPX track points in order
 * @param unit - Unit for returned distances
 * @returns Array of cumulative distances at each point
 */
export const getCumulativeDistances = (
    points: GpxTrackPoint[],
    unit: DistanceUnit = DistanceUnit.METERS
): number[] => {
    if (points.length === 0) {
        return [];
    }

    const distances = [0]; // First point is at distance 0
    let cumulativeDistance = 0;

    for (let i = 1; i < points.length; i++) {
        const segmentDistance = calculateDistanceBetweenPoints(points[i - 1], points[i], unit);
        cumulativeDistance += segmentDistance;
        distances.push(cumulativeDistance);
    }

    return distances;
};
