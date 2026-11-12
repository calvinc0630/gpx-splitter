import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TrackChart } from '../components/TrackChart';
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
        data?: Array<{
            distance: number;
            elevation: number | null;
            speed: number | null;
            bearing: number | null;
        }>;
        onMouseMove?: (event: { activeLabel?: string }) => void;
        onMouseLeave?: () => void;
        onClick?: (event: { activeLabel?: string }) => void;
    }) => (
        <div
            data-testid="line-chart"
            data-points={data?.length ?? 0}
            data-bearings={data?.map(point => point.bearing ?? 'null').join(',')}
            onMouseMove={() => {
                const distance = data?.[1]?.distance;
                if (distance !== undefined) onMouseMove?.({ activeLabel: String(distance) });
            }}
            onMouseLeave={() => onMouseLeave?.()}
            onClick={() => {
                const distance = data?.[1]?.distance;
                if (distance !== undefined) onClick?.({ activeLabel: String(distance) });
            }}
        >
            {children}
        </div>
    ),
    Line: ({
        dataKey,
        name,
        yAxisId,
        hide,
    }: {
        dataKey?: string;
        name?: string;
        yAxisId?: string;
        hide?: boolean;
    }) => (
        <div
            data-testid="line"
            data-key={dataKey}
            data-name={name}
            data-axis-id={yAxisId}
            data-hidden={hide ?? false}
        />
    ),
    XAxis: () => null,
    YAxis: ({
        yAxisId,
        domain,
        ticks,
        orientation,
        hide,
        width,
        tickFormatter,
    }: {
        yAxisId?: string;
        domain?: number[];
        ticks?: number[];
        orientation?: string;
        hide?: boolean;
        width?: number;
        tickFormatter?: (value: number) => string;
    }) => (
        <div
            data-testid="y-axis"
            data-axis-id={yAxisId}
            data-domain={domain?.join(',')}
            data-ticks={ticks?.join(',')}
            data-orientation={orientation}
            data-hidden={hide}
            data-width={width}
            data-first-label={ticks?.[0] !== undefined ? tickFormatter?.(ticks[0]) : ''}
        />
    ),
    CartesianGrid: ({
        yAxisId,
        syncWithTicks,
    }: {
        yAxisId?: string;
        syncWithTicks?: boolean;
    }) => (
        <div
            data-testid="cartesian-grid"
            data-axis-id={yAxisId}
            data-sync-with-ticks={syncWithTicks}
        />
    ),
    Tooltip: () => null,
    ReferenceLine: ({
        x,
        y,
        yAxisId,
        label,
    }: {
        x?: number;
        y?: number;
        yAxisId?: string;
        label?: { value?: string };
    }) => (
        <div
            data-testid="reference-line"
            data-x={x}
            data-y={y}
            data-axis-id={yAxisId}
            data-label={label?.value}
        />
    ),
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

const makeTrack = (points: GpxTrack['points']): GpxTrack => ({
    name: 'Test track',
    points,
    bounds: { north: 40.003, south: 40, east: -74, west: -74.003 },
});

const makeTimedTrack = () =>
    makeTrack([
        {
            lat: 40,
            lon: -74,
            elevation: 100,
            time: new Date('2024-01-01T00:00:00Z'),
        },
        {
            lat: 40.001,
            lon: -74,
            elevation: 120,
            time: new Date('2024-01-01T00:01:00Z'),
        },
        {
            lat: 40.002,
            lon: -74,
            elevation: 140,
            time: new Date('2024-01-01T00:02:00Z'),
        },
    ]);

describe('TrackChart', () => {
    it('renders all three series on a single chart with aligned readable axes', () => {
        render(<TrackChart track={makeTimedTrack()} />);

        expect(screen.getAllByTestId('line')).toHaveLength(3);
        expect(screen.getByTestId('line-chart').getAttribute('data-points')).toBe('3');
        expect(
            screen.getAllByTestId('line').map(line => line.getAttribute('data-axis-id')).sort()
        ).toEqual(['direction', 'elevation', 'speed']);
        expect(screen.getByTestId('cartesian-grid').getAttribute('data-sync-with-ticks')).toBe(
            'true'
        );

        const axes = screen.getAllByTestId('y-axis');
        expect(axes).toHaveLength(3);

        const directionAxis = axes.find(axis => axis.getAttribute('data-axis-id') === 'direction');
        expect(directionAxis).toBeDefined();
        expect(directionAxis?.getAttribute('data-domain')).toBe('-200,200');
        expect(directionAxis?.getAttribute('data-ticks')).toBe('-180,-90,0,90,180');

        const directionPositions = getTickPositions(directionAxis!);
        for (const axis of axes.filter(axis => axis !== directionAxis)) {
            const ticks = axis.getAttribute('data-ticks')!.split(',').map(Number);
            expect(ticks).toHaveLength(5);

            const positions = getTickPositions(axis);
            positions.forEach((position, index) =>
                expect(position).toBeCloseTo(directionPositions[index], 8)
            );

            const step = ticks[1] - ticks[0];
            const power = 10 ** Math.floor(Math.log10(step));
            const normalizedStep = Math.round((step / power) * 1e6) / 1e6;
            expect([1, 2, 5, 10]).toContain(normalizedStep);
        }

        const speedAxis = axes.find(axis => axis.getAttribute('data-axis-id') === 'speed');
        const elevationAxis = axes.find(axis => axis.getAttribute('data-axis-id') === 'elevation');
        expect(speedAxis?.getAttribute('data-first-label')).toContain('km/h');
        expect(elevationAxis?.getAttribute('data-first-label')).toContain('m');
    });

    it('shares split clicks and hover updates with the map', () => {
        const onHover = vi.fn();
        const onSplitPointsChange = vi.fn();
        const track = makeTimedTrack();

        render(
            <TrackChart
                track={track}
                onHover={onHover}
                onSplitPointsChange={onSplitPointsChange}
            />
        );

        fireEvent.mouseMove(screen.getByTestId('line-chart'));
        expect(onHover).toHaveBeenCalledWith(
            expect.objectContaining({ lat: 40.001, lon: -74, elevation: 120 })
        );

        fireEvent.click(screen.getByTestId('line-chart'));
        expect(onSplitPointsChange).toHaveBeenCalledWith([expect.any(Number)]);

        fireEvent.mouseLeave(screen.getByTestId('line-chart'));
        expect(onHover).toHaveBeenLastCalledWith(null);
    });

    it('renders a labeled vertical marker for each split point', () => {
        render(<TrackChart track={makeTimedTrack()} boundaries={[0.1, 0.2]} />);

        const markers = screen
            .getAllByTestId('reference-line')
            .filter(line => line.getAttribute('data-x') !== null);

        expect(markers.map(marker => marker.getAttribute('data-x'))).toEqual(['0.1', '0.2']);
        expect(markers.map(marker => marker.getAttribute('data-axis-id'))).toEqual([
            'elevation',
            'elevation',
        ]);
        expect(markers.map(marker => marker.getAttribute('data-label'))).toEqual(['A', 'B']);
    });

    it('starts with direction hidden and toggles curves together with their axes', () => {
        render(<TrackChart track={makeTimedTrack()} />);

        const directionToggle = screen.getByRole('checkbox', {
            name: 'Direction (°)',
        }) as HTMLInputElement;
        expect(directionToggle.checked).toBe(false);

        const directionAxis = screen
            .getAllByTestId('y-axis')
            .find(axis => axis.getAttribute('data-axis-id') === 'direction');
        const directionLine = screen
            .getAllByTestId('line')
            .find(line => line.getAttribute('data-axis-id') === 'direction');
        expect(directionAxis?.getAttribute('data-hidden')).toBe('true');
        expect(directionLine?.getAttribute('data-hidden')).toBe('true');

        fireEvent.click(directionToggle);
        expect(directionToggle.checked).toBe(true);
        expect(directionAxis?.getAttribute('data-hidden')).toBe('false');
        expect(directionLine?.getAttribute('data-hidden')).toBe('false');

        const elevationToggle = screen.getByRole('checkbox', {
            name: 'Elevation (m)',
        }) as HTMLInputElement;
        fireEvent.click(elevationToggle);
        expect(
            screen
                .getAllByTestId('y-axis')
                .find(axis => axis.getAttribute('data-axis-id') === 'elevation')
                ?.getAttribute('data-hidden')
        ).toBe('true');

        const speedToggle = screen.getByRole('checkbox', {
            name: 'Speed (km/h)',
        }) as HTMLInputElement;
        fireEvent.click(speedToggle);
        expect(speedToggle.checked).toBe(false);
        expect(
            screen
                .getAllByTestId('y-axis')
                .some(axis => axis.getAttribute('data-axis-id') === 'speed')
        ).toBe(false);
    });

    it('keeps the elevation scale visible when elevation is the only selected curve', () => {
        render(<TrackChart track={makeTimedTrack()} />);

        fireEvent.click(screen.getByRole('checkbox', { name: 'Speed (km/h)' }));

        const axes = screen.getAllByTestId('y-axis');
        const elevationAxis = axes.find(axis => axis.getAttribute('data-axis-id') === 'elevation');
        const directionAxis = axes.find(axis => axis.getAttribute('data-axis-id') === 'direction');

        expect(elevationAxis?.getAttribute('data-width')).toBe('58');
        expect(elevationAxis?.getAttribute('data-hidden')).toBe('false');
        expect(directionAxis?.getAttribute('data-width')).toBe('0');
        expect(directionAxis?.getAttribute('data-hidden')).toBe('true');
    });

    it('keeps the combined elevation chart usable when track timestamps are unavailable', () => {
        render(
            <TrackChart
                track={makeTrack([
                    { lat: 40, lon: -74, elevation: 100 },
                    { lat: 40.001, lon: -74, elevation: 120 },
                ])}
            />
        );

        const speedToggle = screen.getByRole('checkbox', {
            name: /Speed \(km\/h\)/,
        }) as HTMLInputElement;
        expect(speedToggle.disabled).toBe(true);
        expect(speedToggle.checked).toBe(false);
        expect(screen.getByText('(no time data)').textContent).toBe('(no time data)');
        expect(
            screen
                .getAllByTestId('y-axis')
                .some(axis => axis.getAttribute('data-axis-id') === 'speed')
        ).toBe(false);
        expect(screen.queryByTestId('line-chart')).not.toBeNull();
    });

    it('disables the direction toggle when the track has no direction data', () => {
        render(
            <TrackChart
                track={makeTrack([{ lat: 40, lon: -74, elevation: 100 }])}
            />
        );

        const directionToggle = screen.getByRole('checkbox', {
            name: /Direction \(°\)/,
        }) as HTMLInputElement;
        expect(directionToggle.disabled).toBe(true);
        expect(directionToggle.checked).toBe(false);
    });

    it('breaks only the direction line where bearing wraps around north', () => {
        const track = makeTrack([
            { lat: 0, lon: 0, elevation: 100, time: new Date('2024-01-01T00:00:00Z') },
            { lat: -1, lon: 0.01, elevation: 110, time: new Date('2024-01-01T00:01:00Z') },
            { lat: -2, lon: 0, elevation: 120, time: new Date('2024-01-01T00:02:00Z') },
        ]);

        render(<TrackChart track={track} />);

        expect(screen.getByTestId('line-chart').getAttribute('data-bearings')).toContain(',null,');
        expect(screen.getAllByTestId('line')).toHaveLength(3);
    });
});

const getTickPositions = (axis: HTMLElement): number[] => {
    const domain = axis.getAttribute('data-domain')!.split(',').map(Number);
    const ticks = axis.getAttribute('data-ticks')!.split(',').map(Number);
    return ticks.map(tick => (tick - domain[0]) / (domain[1] - domain[0]));
};
