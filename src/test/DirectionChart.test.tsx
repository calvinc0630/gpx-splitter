import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DirectionChart } from '../components/DirectionChart';
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
        data?: Array<{ distance: number; bearing: number | null }>;
        onMouseMove?: (event: { activeLabel?: string }) => void;
        onMouseLeave?: () => void;
        onClick?: (event: { activeLabel?: string }) => void;
    }) => (
        <div
            data-testid="line-chart"
            data-points={data?.length ?? 0}
            data-bearings={data?.map(point => point.bearing).join(',')}
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
    Line: ({ dataKey, connectNulls }: { dataKey?: string; connectNulls?: boolean }) => (
        <div data-testid="line" data-key={dataKey} data-connect-null={connectNulls} />
    ),
    XAxis: () => null,
    YAxis: ({ domain, ticks }: { domain?: number[]; ticks?: number[] }) => (
        <div data-testid="y-axis" data-domain={domain?.join(',')} data-ticks={ticks?.join(',')} />
    ),
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: ({ x, y }: { x?: number; y?: number }) => (
        <div data-testid="reference-line" data-x={x} data-y={y} />
    ),
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const makeTrack = (points: GpxTrack['points']): GpxTrack => ({
    name: 'Test track',
    points,
    bounds: { north: 1, south: 0, east: 1, west: 0 },
});

describe('DirectionChart', () => {
    it('plots signed bearings, shares split clicks, and syncs hover to the map', () => {
        const onHover = vi.fn();
        const onSplitPointsChange = vi.fn();
        const track = makeTrack([
            { lat: 0, lon: 0 },
            { lat: 0, lon: 1 },
            { lat: 1, lon: 1 },
        ]);

        render(
            <DirectionChart
                track={track}
                boundaries={[200]}
                onHover={onHover}
                onSplitPointsChange={onSplitPointsChange}
            />
        );

        expect(screen.getByTestId('line-chart')).toHaveAttribute('data-bearings', '90,0');
        expect(screen.getByTestId('y-axis')).toHaveAttribute('data-domain', '-180,180');
        expect(screen.getByTestId('y-axis')).toHaveAttribute(
            'data-ticks',
            '-180,-135,-90,-45,0,45,90,135,180'
        );
        expect(screen.getAllByTestId('reference-line')).toHaveLength(2);
        expect(screen.getByTestId('line')).toHaveAttribute('data-connect-null', 'false');

        fireEvent.mouseMove(screen.getByTestId('line-chart'));
        expect(onHover).toHaveBeenCalledWith({ lat: 0, lon: 1 });

        fireEvent.click(screen.getByTestId('line-chart'));
        expect(onSplitPointsChange).toHaveBeenCalledWith([expect.any(Number), 200]);
    });

    it('shows an empty state when no segment has a defined direction', () => {
        render(
            <DirectionChart
                track={makeTrack([
                    { lat: 0, lon: 0 },
                    { lat: 0, lon: 0 },
                ])}
            />
        );

        expect(screen.getByText('No direction data available')).toBeInTheDocument();
    });
});
