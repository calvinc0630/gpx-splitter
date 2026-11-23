import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpeedChart } from '../components/SpeedChart';
import type { GpxTrack } from '../types/gpx';

vi.mock('recharts', () => ({
    LineChart: ({
        children,
        data,
        onMouseMove,
        onMouseLeave,
        onClick,
    }: {
        children?: ReactNode;
        data?: Array<{ distance: number }>;
        onMouseMove?: (event: { activeLabel?: string }) => void;
        onMouseLeave?: () => void;
        onClick?: (event: { activeLabel?: string }) => void;
    }) => (
        <div
            data-testid="line-chart"
            data-points={data?.length ?? 0}
            onMouseMove={() => {
                const distance = data?.[0]?.distance;
                if (distance !== undefined) {
                    onMouseMove?.({ activeLabel: String(distance) });
                }
            }}
            onMouseLeave={() => onMouseLeave?.()}
            onClick={() => {
                const distance = data?.[0]?.distance;
                if (distance !== undefined) {
                    onClick?.({ activeLabel: String(distance) });
                }
            }}
        >
            {children}
        </div>
    ),
    Line: () => null,
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: ({ x, label }: { x?: number; label?: { value?: string } }) => (
        <div data-testid="reference-line" data-x={x} data-label={label?.value} />
    ),
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const makeTrack = (points: GpxTrack['points']): GpxTrack => ({
    name: 'Test track',
    points,
    bounds: { north: 40.001, south: 40, east: -74, west: -74 },
});

describe('SpeedChart', () => {
    it('calculates speed for timed points and syncs hover to the segment endpoint', () => {
        const onHover = vi.fn();
        const track = makeTrack([
            { lat: 40, lon: -74, time: new Date('2024-01-01T00:00:00Z') },
            { lat: 40.001, lon: -74, time: new Date('2024-01-01T00:01:00Z') },
        ]);

        render(<SpeedChart track={track} onHover={onHover} />);

        expect(screen.getByTestId('line-chart')).toHaveAttribute('data-points', '1');
        fireEvent.mouseMove(screen.getByTestId('line-chart'));

        expect(onHover).toHaveBeenCalledWith({ lat: 40.001, lon: -74 });
    });

    it('shows an empty state when segments do not have valid timestamps', () => {
        const track = makeTrack([
            { lat: 40, lon: -74, time: new Date('invalid') },
            { lat: 40.001, lon: -74, time: new Date('2024-01-01T00:01:00Z') },
        ]);

        render(<SpeedChart track={track} />);

        expect(screen.getByText('No speed/time data available')).toBeInTheDocument();
    });

    it('adds split points when clicked and displays shared split markers', () => {
        const onSplitPointsChange = vi.fn();
        const track = makeTrack([
            { lat: 40, lon: -74, time: new Date('2024-01-01T00:00:00Z') },
            { lat: 40.001, lon: -74, time: new Date('2024-01-01T00:01:00Z') },
        ]);
        const distance = 0.111195;

        const { rerender } = render(
            <SpeedChart track={track} boundaries={[]} onSplitPointsChange={onSplitPointsChange} />
        );

        fireEvent.click(screen.getByTestId('line-chart'));

        expect(onSplitPointsChange).toHaveBeenCalledWith([expect.any(Number)]);

        rerender(
            <SpeedChart
                track={track}
                boundaries={[distance]}
                onSplitPointsChange={onSplitPointsChange}
            />
        );

        expect(screen.getByTestId('reference-line')).toHaveAttribute('data-x', String(distance));
        expect(screen.getByTestId('reference-line')).toHaveAttribute('data-label', 'A');
    });
});
