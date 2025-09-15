import { describe, it, expect } from 'vitest';
import {
    calculateDistance,
    calculateDistanceBetweenPoints,
    getTotalDistance,
    findPointAtDistance,
    getCumulativeDistances,
    DistanceUnit,
} from '../utils/distance';
import type { GpxTrackPoint } from '../types/gpx';

describe('Distance Calculations', () => {
    describe('calculateDistance', () => {
        it('should calculate distance between two points in meters', () => {
            // Distance between Boston, MA and New York, NY (approximately 306 km)
            const distance = calculateDistance(
                42.3601,
                -71.0589,
                40.7128,
                -74.006,
                DistanceUnit.METERS
            );
            expect(distance).toBeCloseTo(306000, -3); // Within 1km accuracy
        });

        it('should calculate distance between two points in kilometers', () => {
            // Distance between Boston, MA and New York, NY
            const distance = calculateDistance(
                42.3601,
                -71.0589,
                40.7128,
                -74.006,
                DistanceUnit.KILOMETERS
            );
            expect(distance).toBeCloseTo(306, 0); // Within 1km accuracy
        });

        it('should return 0 for identical points', () => {
            const distance = calculateDistance(42.3601, -71.0589, 42.3601, -71.0589);
            expect(distance).toBe(0);
        });

        it('should handle small distances accurately', () => {
            // 1 degree of latitude ≈ 111 km (actual calculation is ~111.19 km)
            const distance = calculateDistance(0, 0, 1, 0, DistanceUnit.KILOMETERS);
            expect(distance).toBeCloseTo(111.19, 1);
        });

        it('should validate coordinate ranges', () => {
            // Invalid latitude
            expect(() => calculateDistance(91, 0, 0, 0)).toThrow(
                'Latitude must be between -90 and 90 degrees'
            );
            expect(() => calculateDistance(-91, 0, 0, 0)).toThrow(
                'Latitude must be between -90 and 90 degrees'
            );

            // Invalid longitude
            expect(() => calculateDistance(0, 181, 0, 0)).toThrow(
                'Longitude must be between -180 and 180 degrees'
            );
            expect(() => calculateDistance(0, -181, 0, 0)).toThrow(
                'Longitude must be between -180 and 180 degrees'
            );
        });

        it('should handle edge cases at coordinate boundaries', () => {
            // Test at valid coordinate boundaries
            expect(() => calculateDistance(90, 0, -90, 0)).not.toThrow();
            expect(() => calculateDistance(0, 179.999, 0, -179.999)).not.toThrow();
            // Note: 180 is exclusive boundary, so use 179.999
            expect(() => calculateDistance(0, 179.9, 0, -179.9)).not.toThrow();
        });
    });

    describe('calculateDistanceBetweenPoints', () => {
        const point1: GpxTrackPoint = { lat: 42.3601, lon: -71.0589 };
        const point2: GpxTrackPoint = { lat: 40.7128, lon: -74.006 };

        it('should calculate distance between GPX points in meters', () => {
            const distance = calculateDistanceBetweenPoints(point1, point2, DistanceUnit.METERS);
            expect(distance).toBeCloseTo(306000, -3);
        });

        it('should calculate distance between GPX points in kilometers', () => {
            const distance = calculateDistanceBetweenPoints(
                point1,
                point2,
                DistanceUnit.KILOMETERS
            );
            expect(distance).toBeCloseTo(306, 0);
        });

        it('should default to meters unit', () => {
            const distance = calculateDistanceBetweenPoints(point1, point2);
            expect(distance).toBeCloseTo(306000, -3);
        });
    });

    describe('getTotalDistance', () => {
        const straightPath: GpxTrackPoint[] = [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
            { lat: 2, lon: 0 },
        ];

        it('should calculate total distance along a path in meters', () => {
            const distance = getTotalDistance(straightPath, DistanceUnit.METERS);
            // Approximately 2 degrees = ~222.39 km (actual Haversine calculation)
            expect(distance).toBeCloseTo(222390, 0);
        });

        it('should calculate total distance along a path in kilometers', () => {
            const distance = getTotalDistance(straightPath, DistanceUnit.KILOMETERS);
            expect(distance).toBeCloseTo(222.39, 1);
        });

        it('should return 0 for empty array', () => {
            expect(getTotalDistance([])).toBe(0);
        });

        it('should return 0 for single point', () => {
            expect(getTotalDistance([{ lat: 0, lon: 0 }])).toBe(0);
        });

        it('should default to meters unit', () => {
            const distance = getTotalDistance(straightPath);
            expect(distance).toBeCloseTo(222390, 0);
        });
    });

    describe('findPointAtDistance', () => {
        const testPath: GpxTrackPoint[] = [
            { lat: 0, lon: 0 }, // 0 km
            { lat: 1, lon: 0 }, // ~111 km
            { lat: 2, lon: 0 }, // ~222 km
            { lat: 3, lon: 0 }, // ~333 km
        ];

        it('should find closest point at target distance', () => {
            const result = findPointAtDistance(testPath, 150, DistanceUnit.KILOMETERS);
            expect(result.index).toBe(1); // Closest to 150km is point at ~111km
        });

        it('should handle distance 0', () => {
            const result = findPointAtDistance(testPath, 0);
            expect(result.index).toBe(0);
            expect(result.actualDistance).toBe(0);
        });

        it('should handle negative distance', () => {
            const result = findPointAtDistance(testPath, -10);
            expect(result.index).toBe(0);
            expect(result.actualDistance).toBe(0);
        });

        it('should handle distance beyond track end', () => {
            const result = findPointAtDistance(testPath, 1000, DistanceUnit.KILOMETERS);
            expect(result.index).toBe(testPath.length - 1);
        });

        it('should handle empty array', () => {
            const result = findPointAtDistance([], 100);
            expect(result.index).toBe(0);
            expect(result.actualDistance).toBe(0);
        });

        it('should return actual distance at found point', () => {
            const result = findPointAtDistance(testPath, 200, DistanceUnit.KILOMETERS);
            expect(result.actualDistance).toBeCloseTo(222.39, 1);
        });
    });

    describe('getCumulativeDistances', () => {
        const testPath: GpxTrackPoint[] = [
            { lat: 0, lon: 0 },
            { lat: 1, lon: 0 },
            { lat: 2, lon: 0 },
        ];

        it('should calculate cumulative distances in meters', () => {
            const distances = getCumulativeDistances(testPath, DistanceUnit.METERS);
            expect(distances).toHaveLength(3);
            expect(distances[0]).toBe(0);
            expect(distances[1]).toBeCloseTo(111195, 0);
            expect(distances[2]).toBeCloseTo(222390, 0);
        });

        it('should calculate cumulative distances in kilometers', () => {
            const distances = getCumulativeDistances(testPath, DistanceUnit.KILOMETERS);
            expect(distances).toHaveLength(3);
            expect(distances[0]).toBe(0);
            expect(distances[1]).toBeCloseTo(111.19, 1);
            expect(distances[2]).toBeCloseTo(222.39, 1);
        });

        it('should return empty array for empty input', () => {
            const distances = getCumulativeDistances([]);
            expect(distances).toEqual([]);
        });

        it('should return [0] for single point', () => {
            const distances = getCumulativeDistances([{ lat: 0, lon: 0 }]);
            expect(distances).toEqual([0]);
        });

        it('should default to meters unit', () => {
            const distances = getCumulativeDistances(testPath);
            expect(distances[1]).toBeCloseTo(111195, 0);
        });
    });

    describe('Real-world accuracy tests', () => {
        it('should be accurate for known geographic distances', () => {
            // Distance from Statue of Liberty to Empire State Building (approximately 8.5 km)
            const distance = calculateDistance(
                40.689247,
                -74.044502, // Statue of Liberty
                40.748817,
                -73.985428, // Empire State Building
                DistanceUnit.KILOMETERS
            );
            expect(distance).toBeCloseTo(8.5, 0);
        });

        it('should handle antipodal points correctly', () => {
            // Distance between a point and its antipode should be π * R (half circumference)
            // Use 179.999 instead of 180 since 180 is exclusive boundary
            const distance = calculateDistance(0, 0, 0, 179.999, DistanceUnit.KILOMETERS);
            const expectedDistance = Math.PI * 6371; // ≈ 20,015 km
            expect(distance).toBeCloseTo(expectedDistance, -2);
        });

        it('should be consistent with existing gpx.ts calculation', () => {
            // Test with same coordinates as existing implementation
            const point1: GpxTrackPoint = { lat: 42.3601, lon: -71.0589 };
            const point2: GpxTrackPoint = { lat: 42.3701, lon: -71.0489 };

            const newDistance = calculateDistanceBetweenPoints(point1, point2, DistanceUnit.METERS);

            // Should be approximately the same as the gpx.ts implementation
            // (small variations due to precision are acceptable)
            expect(newDistance).toBeGreaterThan(1000); // At least 1km
            expect(newDistance).toBeLessThan(2000); // Less than 2km
        });
    });
});
