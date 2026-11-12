export interface ChartAxisScale {
    domain: [number, number];
    ticks: number[];
}

const TICK_COUNT = 5;
const NICE_MULTIPLIERS = [1, 2, 5, 10];
const DOMAIN_PADDING_IN_TICK_STEPS = 2 / 9;

const getNiceStep = (value: number): number => {
    const power = 10 ** Math.floor(Math.log10(value));
    const normalized = value / power;
    const multiplier = NICE_MULTIPLIERS.find(candidate => candidate >= normalized) ?? 10;
    return multiplier * power;
};

const getNextNiceStep = (step: number): number => {
    const power = 10 ** Math.floor(Math.log10(step));
    const normalized = step / power;
    const nextMultiplier = NICE_MULTIPLIERS.find(candidate => candidate > normalized);
    return nextMultiplier === undefined ? power * 10 : nextMultiplier * power;
};

const roundToStepPrecision = (value: number, step: number): number => {
    const decimals = Math.max(0, Math.min(12, -Math.floor(Math.log10(step)) + 2));
    return Number(value.toFixed(decimals));
};

export const getNiceChartAxisScale = (minValue: number, maxValue: number): ChartAxisScale => {
    let min = Math.min(minValue, maxValue);
    let max = Math.max(minValue, maxValue);

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return { domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1] };
    }

    if (min === max) {
        const range = Math.max(1, Math.abs(min) * 0.1);
        min -= range / 2;
        max += range / 2;
    }

    let step = getNiceStep((max - min) / (TICK_COUNT - 1));
    let firstTick = Math.floor(min / step) * step;

    while (firstTick + step * (TICK_COUNT - 1) < max) {
        step = getNextNiceStep(step);
        firstTick = Math.floor(min / step) * step;
    }

    const ticks = Array.from({ length: TICK_COUNT }, (_, index) =>
        roundToStepPrecision(firstTick + step * index, step)
    );
    const padding = step * DOMAIN_PADDING_IN_TICK_STEPS;

    return {
        domain: [ticks[0] - padding, ticks[TICK_COUNT - 1] + padding],
        ticks,
    };
};
