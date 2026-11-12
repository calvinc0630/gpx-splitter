import { describe, expect, it } from 'vitest';
import { calculateBearing } from '../utils/direction';

describe('calculateBearing', () => {
    it('uses north as zero and returns signed clockwise bearings', () => {
        expect(calculateBearing(0, 0, 1, 0)).toBeCloseTo(0);
        expect(calculateBearing(0, 0, 0, 1)).toBeCloseTo(90);
        expect(Math.abs(calculateBearing(0, 0, -1, 0) ?? 0)).toBeCloseTo(180);
        expect(calculateBearing(0, 0, 0, -1)).toBeCloseTo(-90);
    });

    it('returns null for invalid or directionless coordinate pairs', () => {
        expect(calculateBearing(0, 0, 0, 0)).toBeNull();
        expect(calculateBearing(91, 0, 0, 0)).toBeNull();
        expect(calculateBearing(0, 180, 0, 0)).toBeNull();
    });
});
