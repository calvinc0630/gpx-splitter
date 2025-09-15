import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';
import * as gpxUtils from '../utils/gpx';
import type { GpxTrack } from '../types/gpx';

// Mock the child components to isolate App component testing
vi.mock('../components/FileUpload', () => ({
    FileUpload: ({
        onFileSelect,
        className,
    }: {
        onFileSelect: (file: File) => void;
        className: string;
    }) => (
        <div data-testid="file-upload" className={className}>
            <button onClick={() => onFileSelect(new File(['test'], 'test.gpx'))}>
                Mock Upload
            </button>
        </div>
    ),
}));

vi.mock('../components/Map', () => ({
    GpxTrackMap: ({
        track,
        hoveredPoint,
        boundaries,
    }: {
        track?: { name?: string };
        hoveredPoint?: unknown;
        boundaries?: unknown[];
    }) => (
        <div data-testid="gpx-track-map">
            <div data-testid="track-name">{track?.name}</div>
            <div data-testid="hovered-point">{hoveredPoint ? 'point-hovered' : 'no-hover'}</div>
            <div data-testid="split-boundaries">{boundaries?.length || 0}</div>
        </div>
    ),
}));

vi.mock('../components/ElevationChart', () => ({
    ElevationChart: ({
        track,
        onHover,
        onSplitPointsChange,
    }: {
        track?: { name?: string };
        onHover?: (point: unknown) => void;
        onSplitPointsChange?: (points: unknown[]) => void;
    }) => (
        <div data-testid="elevation-chart">
            <div data-testid="chart-track">{track?.name}</div>
            <button
                data-testid="trigger-hover"
                onClick={() => onHover?.({ lat: 40.0, lon: -74.0, elevation: 100 })}
            >
                Trigger Hover
            </button>
            <button data-testid="add-split-point" onClick={() => onSplitPointsChange?.([5000])}>
                Add Split Point
            </button>
        </div>
    ),
}));

// Mock GPX utilities
vi.mock('../utils/gpx', async () => {
    const actual = await vi.importActual('../utils/gpx');
    return {
        ...actual,
        parseGpxFile: vi.fn(),
        downloadAllSegments: vi.fn(),
        downloadGpxFile: vi.fn(),
        GpxParseError: class extends Error {
            constructor(message: string) {
                super(message);
                this.name = 'GpxParseError';
            }
        },
    };
});

describe('App Component', () => {
    const mockTrack: GpxTrack = {
        name: 'Test Track',
        points: [
            { lat: 40.0, lon: -74.0, elevation: 100 },
            { lat: 40.1, lon: -74.1, elevation: 110 },
            { lat: 40.2, lon: -74.2, elevation: 120 },
            { lat: 40.3, lon: -74.3, elevation: 130 },
            { lat: 40.4, lon: -74.4, elevation: 140 },
        ],
        bounds: {
            north: 40.4,
            south: 40.0,
            east: -74.0,
            west: -74.4,
        },
        waypoints: [],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Initial State', () => {
        it('renders initial upload interface', () => {
            render(<App />);

            expect(screen.getByText('GPX Track Splitter')).toBeInTheDocument();
            expect(
                screen.getByText(/Upload your GPX file to split hiking tracks/)
            ).toBeInTheDocument();
            expect(screen.getByText('Upload GPX File')).toBeInTheDocument();
            expect(screen.getByTestId('file-upload')).toBeInTheDocument();
        });

        it('displays app branding and title', () => {
            render(<App />);

            expect(screen.getByText('GPX Track Splitter')).toBeInTheDocument();
            expect(
                screen.getByText(/Upload your GPX file to split hiking tracks into segments/i)
            ).toBeInTheDocument();
        });

        it('does not show track visualization components initially', () => {
            render(<App />);

            expect(screen.queryByTestId('gpx-track-map')).not.toBeInTheDocument();
            expect(screen.queryByTestId('elevation-chart')).not.toBeInTheDocument();
        });
    });

    describe('File Upload Flow', () => {
        it('shows loading state during file parsing', async () => {
            const parsePromise = new Promise<GpxTrack>(resolve =>
                setTimeout(() => resolve(mockTrack), 100)
            );
            vi.mocked(gpxUtils.parseGpxFile).mockReturnValue(parsePromise);

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(screen.getByText('Parsing GPX file...')).toBeInTheDocument();
            });

            // Check loading spinner is present
            expect(screen.getByText('Parsing GPX file...')).toBeVisible();
        });

        it('successfully loads and displays track data', async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockResolvedValue(mockTrack);

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(screen.getByText('Track Loaded: Test Track')).toBeInTheDocument();
            });

            // Check track statistics display
            expect(screen.getByText('5')).toBeInTheDocument(); // Points count
            expect(screen.getByText('40.0000 to 40.4000')).toBeInTheDocument(); // Latitude range
            expect(screen.getByText('-74.4000 to -74.0000')).toBeInTheDocument(); // Longitude range
            expect(screen.getByText('Yes')).toBeInTheDocument(); // Elevation data

            // Check visualization components are rendered
            expect(screen.getByTestId('gpx-track-map')).toBeInTheDocument();
            expect(screen.getByTestId('elevation-chart')).toBeInTheDocument();
        });

        it('handles GPX parsing errors gracefully', async () => {
            const error = new gpxUtils.GpxParseError('Invalid GPX format');
            vi.mocked(gpxUtils.parseGpxFile).mockRejectedValue(error);

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(screen.getByText('Invalid GPX format')).toBeInTheDocument();
            });

            // Error message should be displayed with red background
            const errorDiv = screen.getByText('Invalid GPX format').closest('div');
            expect(errorDiv).toHaveClass('bg-red-50');
            expect(screen.queryByTestId('gpx-track-map')).not.toBeInTheDocument();
        });

        it('handles unexpected errors during parsing', async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockRejectedValue(new Error('Network error'));

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'Failed to read the file. Please check your internet connection and try again.'
                    )
                ).toBeInTheDocument();
            });
        });

        it('handles SecurityError XXE type', async () => {
            const { SecurityError } = await import('../utils/security');
            const error = new SecurityError('XML contains external entity references', 'XXE');
            vi.mocked(gpxUtils.parseGpxFile).mockRejectedValue(error);

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'File contains security risks and cannot be processed. Please ensure the file is from a trusted source.'
                    )
                ).toBeInTheDocument();
            });
        });

        it('handles SecurityError XSS type', async () => {
            const { SecurityError } = await import('../utils/security');
            const error = new SecurityError('File contains malicious scripts', 'XSS');
            vi.mocked(gpxUtils.parseGpxFile).mockRejectedValue(error);

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'File contains potentially unsafe content that has been blocked for security reasons.'
                    )
                ).toBeInTheDocument();
            });
        });

        it('handles SecurityError PERFORMANCE type', async () => {
            const { SecurityError } = await import('../utils/security');
            const error = new SecurityError('File is too large', 'PERFORMANCE');
            vi.mocked(gpxUtils.parseGpxFile).mockRejectedValue(error);

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'File processing failed due to performance constraints. Please try a smaller or simpler file.'
                    )
                ).toBeInTheDocument();
            });
        });

        it('handles memory exhaustion errors', async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockRejectedValue(new Error('out of memory'));

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'Not enough memory to process this file. Please try a smaller file or close other applications.'
                    )
                ).toBeInTheDocument();
            });
        });

        it('handles timeout errors', async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockRejectedValue(new Error('timeout exceeded'));

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'File processing timed out. Please try again or use a smaller file.'
                    )
                ).toBeInTheDocument();
            });
        });

        it('handles storage quota errors', async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockRejectedValue(new Error('storage quota exceeded'));

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'Not enough storage space available. Please free up some space and try again.'
                    )
                ).toBeInTheDocument();
            });
        });

        it('handles permission errors', async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockRejectedValue(new Error('permission denied'));

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'Permission denied. Please check file permissions and try again.'
                    )
                ).toBeInTheDocument();
            });
        });

        it('handles descriptive errors with fallback message', async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockRejectedValue(
                new Error('Custom descriptive error message')
            );

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(
                    screen.getByText('File processing failed: Custom descriptive error message')
                ).toBeInTheDocument();
            });
        });

        it('handles unknown errors with final fallback', async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockRejectedValue(new Error(''));

            render(<App />);

            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'An unexpected error occurred while processing the file. Please try again with a different file.'
                    )
                ).toBeInTheDocument();
            });
        });

        it('allows uploading a different file', async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockResolvedValue(mockTrack);

            render(<App />);

            // Upload first file
            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(screen.getByText('Track Loaded: Test Track')).toBeInTheDocument();
            });

            // Click "Upload Different File"
            fireEvent.click(screen.getByText('Upload Different File'));

            expect(screen.getByText('Upload GPX File')).toBeInTheDocument();
            expect(screen.queryByTestId('gpx-track-map')).not.toBeInTheDocument();
        });
    });

    describe('Track Visualization Integration', () => {
        beforeEach(async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockResolvedValue(mockTrack);
            render(<App />);
            fireEvent.click(screen.getByText('Mock Upload'));
            await waitFor(() => screen.getByText('Track Loaded: Test Track'));
        });

        it('passes track data to map component', () => {
            expect(screen.getByTestId('track-name')).toHaveTextContent('Test Track');
        });

        it('passes track data to elevation chart', () => {
            expect(screen.getByTestId('chart-track')).toHaveTextContent('Test Track');
        });

        it('handles hover events from elevation chart', () => {
            // Initially no hover
            expect(screen.getByTestId('hovered-point')).toHaveTextContent('no-hover');

            // Trigger hover from elevation chart
            fireEvent.click(screen.getByTestId('trigger-hover'));

            expect(screen.getByTestId('hovered-point')).toHaveTextContent('point-hovered');
        });

        it('handles split point changes from elevation chart', () => {
            // Initially no split boundaries
            expect(screen.getByTestId('split-boundaries')).toHaveTextContent('0');

            // Add split point from elevation chart
            fireEvent.click(screen.getByTestId('add-split-point'));

            expect(screen.getByTestId('split-boundaries')).toHaveTextContent('1');
        });
    });

    describe('Segment Generation and Download', () => {
        beforeEach(async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockResolvedValue(mockTrack);
            render(<App />);
            fireEvent.click(screen.getByText('Mock Upload'));
            await waitFor(() => screen.getByText('Track Loaded: Test Track'));
        });

        it('does not show segment options with no split points', () => {
            expect(screen.queryByText('Track Segments')).not.toBeInTheDocument();
            expect(screen.queryByText('Download All Segments')).not.toBeInTheDocument();
        });

        it('shows segment download options when split points are added', () => {
            // Add split point
            fireEvent.click(screen.getByTestId('add-split-point'));

            expect(screen.getByText('Track Segments')).toBeInTheDocument();
            expect(
                screen.getByText(/Ready to split! This will create 2 track segments/)
            ).toBeInTheDocument();
            expect(screen.getByText('Download All Segments')).toBeInTheDocument();
        });

        it('calls downloadAllSegments when download all button is clicked', () => {
            // Add split point
            fireEvent.click(screen.getByTestId('add-split-point'));

            fireEvent.click(screen.getByText('Download All Segments'));

            expect(gpxUtils.downloadAllSegments).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: expect.stringContaining('Test Track_A'),
                        points: expect.any(Array),
                    }),
                    expect.objectContaining({
                        name: expect.stringContaining('Test Track_B'),
                        points: expect.any(Array),
                    }),
                ])
            );
        });

        it('generates individual segment download buttons', () => {
            // Add split point
            fireEvent.click(screen.getByTestId('add-split-point'));

            expect(screen.getByText('Download A')).toBeInTheDocument();
            expect(screen.getByText('Download B')).toBeInTheDocument();
        });

        it('calls downloadGpxFile for individual segment downloads', () => {
            // Add split point
            fireEvent.click(screen.getByTestId('add-split-point'));

            fireEvent.click(screen.getByText('Download A'));

            expect(gpxUtils.downloadGpxFile).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: expect.stringContaining('Test Track_A'),
                    points: expect.any(Array),
                })
            );
        });
    });

    describe('State Management', () => {
        it('resets segments when loading new file', async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockResolvedValue(mockTrack);

            render(<App />);

            // Upload file and add split point
            fireEvent.click(screen.getByText('Mock Upload'));
            await waitFor(() => screen.getByText('Track Loaded: Test Track'));
            fireEvent.click(screen.getByTestId('add-split-point'));

            expect(screen.getByText('Track Segments')).toBeInTheDocument();

            // Upload Different File
            fireEvent.click(screen.getByText('Upload Different File'));
            fireEvent.click(screen.getByText('Mock Upload'));
            await waitFor(() => screen.getByText('Track Loaded: Test Track'));

            // Segments should be reset
            expect(screen.queryByText('Track Segments')).not.toBeInTheDocument();
            expect(screen.getByTestId('split-boundaries')).toHaveTextContent('0');
        });

        it('updates segment count when boundaries change', async () => {
            vi.mocked(gpxUtils.parseGpxFile).mockResolvedValue(mockTrack);

            render(<App />);
            fireEvent.click(screen.getByText('Mock Upload'));
            await waitFor(() => screen.getByText('Track Loaded: Test Track'));

            // Add first split point
            fireEvent.click(screen.getByTestId('add-split-point'));
            expect(screen.getByText(/This will create 2 track segments/)).toBeInTheDocument();

            // Verify segment count updates are properly reflected
            expect(screen.getByText('Download A')).toBeInTheDocument();
            expect(screen.getByText('Download B')).toBeInTheDocument();
        });
    });

    describe('Error Boundaries', () => {
        it('displays error when track data is missing elevation', async () => {
            const trackWithoutElevation = {
                ...mockTrack,
                points: mockTrack.points.map(p => ({ lat: p.lat, lon: p.lon })),
            };
            vi.mocked(gpxUtils.parseGpxFile).mockResolvedValue(trackWithoutElevation);

            render(<App />);
            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(screen.getByText('Track Loaded: Test Track')).toBeInTheDocument();
            });

            expect(screen.getByText('No')).toBeInTheDocument(); // Elevation data: No
        });

        it('handles empty track points gracefully', async () => {
            const emptyTrack = {
                ...mockTrack,
                points: [],
            };
            vi.mocked(gpxUtils.parseGpxFile).mockResolvedValue(emptyTrack);

            render(<App />);
            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(screen.getByText('Track Loaded: Test Track')).toBeInTheDocument();
            });

            // Find the points count specifically in the stats section
            const pointsSection = screen.getByText('Points').parentElement;
            const pointsValue = pointsSection?.querySelector('.font-semibold');
            expect(pointsValue).toHaveTextContent('0');
        });
    });

    describe('Accessibility', () => {
        it('provides proper loading announcements', async () => {
            const parsePromise = new Promise<GpxTrack>(resolve =>
                setTimeout(() => resolve(mockTrack), 100)
            );
            vi.mocked(gpxUtils.parseGpxFile).mockReturnValue(parsePromise);

            render(<App />);
            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(screen.getByText('Parsing GPX file...')).toBeInTheDocument();
            });

            // Loading state should be announced to screen readers
            expect(screen.getByText('Parsing GPX file...')).toBeVisible();
        });

        it('provides error announcements', async () => {
            const error = new gpxUtils.GpxParseError('Test error');
            vi.mocked(gpxUtils.parseGpxFile).mockRejectedValue(error);

            render(<App />);
            fireEvent.click(screen.getByText('Mock Upload'));

            await waitFor(() => {
                expect(screen.getByText('Test error')).toBeInTheDocument();
            });

            // Error message should be displayed with appropriate styling
            const errorDiv = screen.getByText('Test error').closest('div');
            expect(errorDiv).toHaveClass('bg-red-50');
        });
    });
});
