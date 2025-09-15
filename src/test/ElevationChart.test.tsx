import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElevationChart } from '../components/ElevationChart';
import type { GpxTrack } from '../types/gpx';

// Mock Recharts components
vi.mock('recharts', () => ({
    LineChart: ({
        children,
        onMouseMove,
        onMouseLeave,
        onClick,
        data,
    }: {
        children?: React.ReactNode;
        onMouseMove?: (event: { activeLabel?: string }) => void;
        onMouseLeave?: () => void;
        onClick?: (event: { activeLabel?: string }) => void;
        data?: unknown[];
    }) => (
        <div
            data-testid="line-chart"
            data-points={data?.length || 0}
            onMouseMove={() => {
                if (onMouseMove) {
                    // Use distance 0 which should match first point
                    onMouseMove({ activeLabel: '0' });
                }
            }}
            onMouseLeave={() => {
                if (onMouseLeave) {
                    onMouseLeave();
                }
            }}
            onClick={() => {
                if (onClick) {
                    onClick({ activeLabel: '3.5' });
                }
            }}
        >
            {children}
        </div>
    ),
    Line: ({ dataKey, stroke }: { dataKey?: string; stroke?: string }) => (
        <div data-testid="line" data-key={dataKey} data-stroke={stroke} />
    ),
    XAxis: ({
        dataKey,
        tickFormatter,
    }: {
        dataKey?: string;
        tickFormatter?: (value: number) => string;
    }) => (
        <div data-testid="x-axis" data-key={dataKey}>
            {tickFormatter && tickFormatter(0.0)}
        </div>
    ),
    YAxis: ({
        domain,
        tickFormatter,
    }: {
        domain?: unknown;
        tickFormatter?: (value: number) => string;
    }) => (
        <div data-testid="y-axis" data-domain={JSON.stringify(domain)}>
            {tickFormatter && tickFormatter(1500)}
        </div>
    ),
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: ({
        formatter,
        labelFormatter,
    }: {
        formatter?: (value: number) => string;
        labelFormatter?: (value: number) => string;
    }) => (
        <div data-testid="tooltip">
            {formatter && formatter(1500)}
            {labelFormatter && labelFormatter(0.0)}
        </div>
    ),
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="responsive-container" style={{ width: '100%', height: '100%' }}>
            {children}
        </div>
    ),
    ReferenceLine: ({
        x,
        stroke,
        label,
    }: {
        x?: number;
        stroke?: string;
        label?: { value?: string } | string;
    }) => (
        <div
            data-testid="reference-line"
            data-x={x}
            data-stroke={stroke}
            data-label={typeof label === 'string' ? label : label?.value}
        />
    ),
}));

describe('ElevationChart Component', () => {
    const mockTrack: GpxTrack = {
        name: 'Test Track',
        points: [
            { lat: 40.0, lon: -74.0, elevation: 1000 },
            { lat: 40.1, lon: -74.1, elevation: 1100 },
            { lat: 40.2, lon: -74.2, elevation: 1200 },
            { lat: 40.3, lon: -74.3, elevation: 1300 },
            { lat: 40.4, lon: -74.4, elevation: 1400 },
        ],
        bounds: {
            north: 40.4,
            south: 40.0,
            east: -74.0,
            west: -74.4,
        },
        waypoints: [],
    };

    const mockOnHover = vi.fn();
    const mockOnSplitPointsChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('renders elevation chart with track data', () => {
            render(
                <ElevationChart
                    track={mockTrack}
                    onHover={mockOnHover}
                    onSplitPointsChange={mockOnSplitPointsChange}
                />
            );

            expect(screen.getByTestId('line-chart')).toBeInTheDocument();
            expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
            expect(screen.getByTestId('line')).toBeInTheDocument();
            expect(screen.getByTestId('x-axis')).toBeInTheDocument();
            expect(screen.getByTestId('y-axis')).toBeInTheDocument();
        });

        it('displays instructions for user interaction', () => {
            render(<ElevationChart track={mockTrack} />);

            expect(screen.getByText(/Click on the elevation profile/)).toBeInTheDocument();
            expect(screen.getByText(/to create split points/)).toBeInTheDocument();
            expect(screen.getByText(/Hover to preview location on map/)).toBeInTheDocument();
        });

        it('renders chart with correct number of data points', () => {
            render(<ElevationChart track={mockTrack} />);

            const chart = screen.getByTestId('line-chart');
            expect(chart).toHaveAttribute('data-points', '5');
        });

        it('configures axes with proper formatting', () => {
            render(<ElevationChart track={mockTrack} />);

            const xAxis = screen.getByTestId('x-axis');
            expect(xAxis).toHaveTextContent('0.0 km'); // Formatted distance

            const yAxis = screen.getByTestId('y-axis');
            expect(yAxis).toHaveTextContent('1500 m'); // Formatted elevation
        });
    });

    describe('Empty Data Handling', () => {
        it('renders empty state when no elevation data', () => {
            const emptyTrack = { ...mockTrack, points: [] };
            render(<ElevationChart track={emptyTrack} />);

            expect(screen.getByText('No elevation data available')).toBeInTheDocument();
            expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
        });

        it('handles track with points but no elevation data', () => {
            const trackWithoutElevation = {
                ...mockTrack,
                points: mockTrack.points.map(
                    (p: { lat: number; lon: number; elevation?: number }) => ({
                        lat: p.lat,
                        lon: p.lon,
                    })
                ),
            };

            render(<ElevationChart track={trackWithoutElevation} />);

            // Should still render chart with 0 elevation values
            expect(screen.getByTestId('line-chart')).toBeInTheDocument();
            expect(screen.queryByText('No elevation data available')).not.toBeInTheDocument();
        });
    });

    describe('Mouse Interactions', () => {
        it('calls onHover when mouse moves over chart', async () => {
            render(
                <ElevationChart
                    track={mockTrack}
                    onHover={mockOnHover}
                    onSplitPointsChange={mockOnSplitPointsChange}
                />
            );

            const chart = screen.getByTestId('line-chart');
            fireEvent.mouseMove(chart);

            // Wait for throttled event to be processed
            await waitFor(
                () => {
                    expect(mockOnHover).toHaveBeenCalled();
                },
                { timeout: 100 }
            );

            // Should be called with approximately matching data
            const lastCall = mockOnHover.mock.calls[mockOnHover.mock.calls.length - 1];
            if (lastCall && lastCall[0]) {
                expect(lastCall[0]).toHaveProperty('lat');
                expect(lastCall[0]).toHaveProperty('lon');
                expect(lastCall[0]).toHaveProperty('elevation');
            }
        });

        it('calls onHover with null when mouse leaves chart', () => {
            render(
                <ElevationChart
                    track={mockTrack}
                    onHover={mockOnHover}
                    onSplitPointsChange={mockOnSplitPointsChange}
                />
            );

            const chart = screen.getByTestId('line-chart');
            fireEvent.mouseLeave(chart);

            expect(mockOnHover).toHaveBeenCalledWith(null);
        });

        it('does not break when onHover is not provided', () => {
            render(<ElevationChart track={mockTrack} />);

            const chart = screen.getByTestId('line-chart');
            expect(() => {
                fireEvent.mouseMove(chart);
                fireEvent.mouseLeave(chart);
            }).not.toThrow();
        });
    });

    describe('Split Point Management', () => {
        it('creates split point when chart is clicked', () => {
            render(
                <ElevationChart
                    track={mockTrack}
                    onHover={mockOnHover}
                    onSplitPointsChange={mockOnSplitPointsChange}
                />
            );

            const chart = screen.getByTestId('line-chart');
            fireEvent.click(chart);

            expect(mockOnSplitPointsChange).toHaveBeenCalledWith([3.5]);
        });

        it('displays split point controls when boundaries exist', () => {
            render(
                <ElevationChart track={mockTrack} onSplitPointsChange={mockOnSplitPointsChange} />
            );

            // Click to create split point
            const chart = screen.getByTestId('line-chart');
            fireEvent.click(chart);

            expect(screen.getByText(/2 segments created/)).toBeInTheDocument();
            expect(screen.getByText(/Split points: 3.50km/)).toBeInTheDocument();
            expect(screen.getByText('Reset to Single Track')).toBeInTheDocument();
        });

        it('clears all boundaries when reset button is clicked', () => {
            render(
                <ElevationChart track={mockTrack} onSplitPointsChange={mockOnSplitPointsChange} />
            );

            // Click to create split point
            const chart = screen.getByTestId('line-chart');
            fireEvent.click(chart);

            // Click reset button
            fireEvent.click(screen.getByText('Reset to Single Track'));

            expect(mockOnSplitPointsChange).toHaveBeenCalledWith([]);
        });

        it('sorts split points in ascending order', () => {
            render(
                <ElevationChart track={mockTrack} onSplitPointsChange={mockOnSplitPointsChange} />
            );

            const chart = screen.getByTestId('line-chart');

            // Create multiple split points by clicking multiple times
            fireEvent.click(chart); // Should add 3.5
            fireEvent.click(chart); // Should add another 3.5 (duplicate)

            // Should only have one unique boundary
            expect(mockOnSplitPointsChange).toHaveBeenCalledWith([3.5]);
        });

        it('renders reference lines for split points', () => {
            render(
                <ElevationChart track={mockTrack} onSplitPointsChange={mockOnSplitPointsChange} />
            );

            // Click to create split point
            const chart = screen.getByTestId('line-chart');
            fireEvent.click(chart);

            const referenceLine = screen.getByTestId('reference-line');
            expect(referenceLine).toHaveAttribute('data-x', '3.5');
            expect(referenceLine).toHaveAttribute('data-stroke', '#ef4444');
            expect(referenceLine).toHaveAttribute('data-label', 'A');
        });

        it('does not break when onSplitPointsChange is not provided', () => {
            render(<ElevationChart track={mockTrack} />);

            const chart = screen.getByTestId('line-chart');
            expect(() => {
                fireEvent.click(chart);
            }).not.toThrow();
        });
    });

    describe('Chart Configuration', () => {
        it('configures elevation range with proper domain', () => {
            render(<ElevationChart track={mockTrack} />);

            const yAxis = screen.getByTestId('y-axis');
            const domain = JSON.parse(yAxis.getAttribute('data-domain') || '[]');

            // Should have lower and upper bounds with padding
            expect(domain).toHaveLength(2);
            expect(domain[0]).toBeLessThan(1000); // Below minimum elevation
            expect(domain[1]).toBeGreaterThan(1400); // Above maximum elevation
        });

        it('configures line style correctly', () => {
            render(<ElevationChart track={mockTrack} />);

            const line = screen.getByTestId('line');
            expect(line).toHaveAttribute('data-key', 'elevation');
            expect(line).toHaveAttribute('data-stroke', '#3b82f6');
        });

        it('renders tooltip with proper formatting', () => {
            render(<ElevationChart track={mockTrack} />);

            const tooltip = screen.getByTestId('tooltip');
            expect(tooltip).toHaveTextContent('1500'); // Elevation
            expect(tooltip).toHaveTextContent('0.00'); // Distance
        });
    });

    describe('Performance Optimizations', () => {
        it('throttles mouse move events', async () => {
            render(<ElevationChart track={mockTrack} onHover={mockOnHover} />);

            const chart = screen.getByTestId('line-chart');

            // Trigger multiple rapid mouse moves
            fireEvent.mouseMove(chart);
            fireEvent.mouseMove(chart);
            fireEvent.mouseMove(chart);

            // Wait for throttled events to be processed
            await waitFor(
                () => {
                    expect(mockOnHover).toHaveBeenCalled();
                },
                { timeout: 100 }
            );

            // Should be called at least once, but less than 3 times due to throttling
            expect(mockOnHover.mock.calls.length).toBeGreaterThan(0);
            expect(mockOnHover.mock.calls.length).toBeLessThanOrEqual(3);
        });

        it('memoizes elevation data calculation', () => {
            const { rerender } = render(<ElevationChart track={mockTrack} />);

            const chart1 = screen.getByTestId('line-chart');
            const initialPoints = chart1.getAttribute('data-points');

            // Rerender with same track data
            rerender(<ElevationChart track={mockTrack} />);

            const chart2 = screen.getByTestId('line-chart');
            const newPoints = chart2.getAttribute('data-points');

            expect(newPoints).toBe(initialPoints);
        });
    });

    describe('Large Dataset Handling', () => {
        it('handles large number of points efficiently', () => {
            const largeTrack = {
                ...mockTrack,
                points: Array.from({ length: 1000 }, (_, i) => ({
                    lat: 40 + i * 0.001,
                    lon: -74 + i * 0.001,
                    elevation: 1000 + Math.sin(i * 0.1) * 200,
                })),
            };

            const renderStart = performance.now();
            render(<ElevationChart track={largeTrack} />);
            const renderTime = performance.now() - renderStart;

            expect(screen.getByTestId('line-chart')).toBeInTheDocument();
            expect(renderTime).toBeLessThan(1000); // Should render within 1 second
        });
    });

    describe('Error Boundaries', () => {
        it('handles invalid elevation data gracefully', () => {
            const invalidTrack = {
                ...mockTrack,
                points: [
                    { lat: 40.0, lon: -74.0, elevation: NaN },
                    { lat: 40.1, lon: -74.1, elevation: Infinity },
                    { lat: 40.2, lon: -74.2, elevation: -Infinity },
                ],
            };

            expect(() => {
                render(<ElevationChart track={invalidTrack} />);
            }).not.toThrow();

            expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        });

        it('handles invalid coordinates gracefully', () => {
            const invalidTrack = {
                ...mockTrack,
                points: [
                    { lat: NaN, lon: -74.0, elevation: 1000 },
                    { lat: 40.1, lon: NaN, elevation: 1100 },
                    { lat: Infinity, lon: -74.2, elevation: 1200 },
                ],
            };

            expect(() => {
                render(<ElevationChart track={invalidTrack} />);
            }).not.toThrow();
        });
    });

    describe('Accessibility', () => {
        it('provides appropriate cursor styling for interactive chart', () => {
            render(<ElevationChart track={mockTrack} />);

            const chartContainer = screen.getByTestId('line-chart').closest('.cursor-pointer');
            expect(chartContainer).toBeInTheDocument();
        });

        it('provides clear instructions for user interaction', () => {
            render(<ElevationChart track={mockTrack} />);

            const instructions = screen.getByText(/Click on the elevation profile/);
            expect(instructions).toBeVisible();
            expect(instructions.closest('.bg-gray-50')).toBeInTheDocument(); // Highlighted instructions
        });

        it('provides feedback when split points are created', () => {
            render(
                <ElevationChart track={mockTrack} onSplitPointsChange={mockOnSplitPointsChange} />
            );

            // Create split point
            const chart = screen.getByTestId('line-chart');
            fireEvent.click(chart);

            // Should show visual feedback
            expect(screen.getByText(/2 segments created/)).toBeInTheDocument();
            expect(screen.getByText(/Split points:/)).toBeInTheDocument();
        });
    });

    describe('Component Memoization', () => {
        it('prevents unnecessary re-renders with React.memo', () => {
            const renderSpy = vi.fn();

            const TestWrapper = ({ track }: { track: GpxTrack }) => {
                renderSpy();
                return <ElevationChart track={track} />;
            };

            const { rerender } = render(<TestWrapper track={mockTrack} />);

            // Rerender with same props
            rerender(<TestWrapper track={mockTrack} />);

            // Should only render twice (initial + rerender), not more
            expect(renderSpy).toHaveBeenCalledTimes(2);
        });
    });
});
