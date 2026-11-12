import { describe, expect, it } from 'vitest';
import { getNiceChartAxisScale } from '../utils/chartScale';

const isNiceStep = (step: number): boolean => {
    const power = 10 ** Math.floor(Math.log10(step));
    const multiplier = step / power;
    return [1, 2, 5, 10].some(candidate => Math.abs(multiplier - candidate) < 1e-8);
};

describe('getNiceChartAxisScale', () => {
    it.each([
        [0, 4],
        [6.4, 13.8],
        [101, 149],
        [-140, -35],
    ])('creates five readable ticks for the range %s to %s', (min, max) => {
        const scale = getNiceChartAxisScale(min, max);
        const step = scale.ticks[1] - scale.ticks[0];

        expect(scale.ticks).toHaveLength(5);
        expect(isNiceStep(step)).toBe(true);
        expect(scale.ticks[0]).toBeLessThanOrEqual(min);
        expect(scale.ticks[4]).toBeGreaterThanOrEqual(max);
    });

    it('pads the domain so its ticks align with the direction chart divisions', () => {
        const scale = getNiceChartAxisScale(5, 45);
        const positions = scale.ticks.map(
            tick => (tick - scale.domain[0]) / (scale.domain[1] - scale.domain[0])
        );

        [-180, -90, 0, 90, 180].forEach((tick, index) =>
            expect(positions[index]).toBeCloseTo((tick + 200) / 400, 8)
        );
    });

    it('creates a finite scale for a constant value', () => {
        const scale = getNiceChartAxisScale(10, 10);

        expect(scale.ticks).toHaveLength(5);
        expect(scale.domain.every(Number.isFinite)).toBe(true);
        expect(scale.ticks[0]).toBeLessThan(10);
        expect(scale.ticks[4]).toBeGreaterThan(10);
    });
});
