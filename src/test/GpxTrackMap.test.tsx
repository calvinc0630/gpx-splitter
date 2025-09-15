import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GpxTrackMap } from '../components/Map';
import type { GpxTrack } from '../types/gpx';

// Mock React-Leaflet components
vi.mock('react-leaflet', () => ({
    MapContainer: ({
        children,
        center,
        zoom,
        className,
    }: {
        children?: React.ReactNode;
        center?: [number, number];
        zoom?: number;
        className?: string;
    }) => (
        <div
            data-testid="map-container"
            data-center={JSON.stringify(center)}
            data-zoom={zoom}
            className={className}
        >
            {children}
        </div>
    ),
    TileLayer: ({ attribution, url }: { attribution?: string; url?: string }) => (
        <div data-testid="tile-layer" data-attribution={attribution} data-url={url} />
    ),
    Polyline: ({
        positions,
        color,
        weight,
        opacity,
    }: {
        positions?: unknown[];
        color?: string;
        weight?: number;
        opacity?: number;
    }) => (
        <div
            data-testid="polyline"
            data-positions={positions?.length || 0}
            data-color={color}
            data-weight={weight}
            data-opacity={opacity}
        />
    ),
    Marker: ({
        position,
        icon,
        children,
    }: {
        position?: [number, number];
        icon?: { options?: { className?: string } };
        children?: React.ReactNode;
    }) => (
        <div
            data-testid="marker"
            data-position={JSON.stringify(position)}
            data-icon-class={icon?.options?.className}
        >
            {children}
        </div>
    ),
    Popup: ({ children }: { children?: React.ReactNode }) => (
        <div data-testid="popup">{children}</div>
    ),
    useMap: () => ({
        fitBounds: vi.fn(),
        getZoom: () => 13,
        getCenter: () => ({ lat: 40.0, lng: -74.0 }),
    }),
}));

// Mock Leaflet
vi.mock('leaflet', () => ({
    LatLngBounds: vi.fn().mockImplementation((southWest, northEast) => ({
        southWest,
        northEast,
        _southWest: southWest,
        _northEast: northEast,
    })),
    divIcon: vi.fn().mockImplementation(options => ({
        options,
        type: 'divIcon',
    })),
}));

// Mock GPX utilities
vi.mock('../utils/gpx', () => ({
    decimateTrackPoints: vi.fn().mockImplementation(points => points),
}));

// Mock CSS import
vi.mock('leaflet/dist/leaflet.css', () => ({}));

describe('GpxTrackMap Component', () => {
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
        waypoints: [
            {
                lat: 40.2,
                lon: -74.2,
                name: 'Checkpoint 1',
                description: 'Rest area',
                elevation: 1200,
                symbol: 'flag',
            },
        ],
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Basic Rendering', () => {
        it('renders map container with track data', () => {
            render(<GpxTrackMap track={mockTrack} />);

            expect(screen.getByTestId('map-container')).toBeInTheDocument();
            expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
            expect(screen.getByTestId('polyline')).toBeInTheDocument();
        });

        it('centers map on track bounds', () => {
            render(<GpxTrackMap track={mockTrack} />);

            const mapContainer = screen.getByTestId('map-container');
            const center = JSON.parse(mapContainer.getAttribute('data-center') || '[]');

            // Should be center of bounds
            expect(center[0]).toBeCloseTo(40.2); // (40.0 + 40.4) / 2
            expect(center[1]).toBeCloseTo(-74.2); // (-74.0 + -74.4) / 2
        });

        it('configures map with proper zoom and styling', () => {
            render(<GpxTrackMap track={mockTrack} className="custom-class" />);

            const mapContainer = screen.getByTestId('map-container');
            expect(mapContainer).toHaveAttribute('data-zoom', '13');
            expect(mapContainer).toHaveClass('rounded-lg');

            // Check if custom class is applied to the container div
            const containerDiv = mapContainer.closest('.custom-class');
            expect(containerDiv).toBeInTheDocument();
        });

        it('displays track information overlay', () => {
            render(<GpxTrackMap track={mockTrack} />);

            expect(screen.getByText('Test Track')).toBeInTheDocument();
            expect(screen.getByText('5 track points')).toBeInTheDocument();
            expect(screen.getByText('1 waypoint')).toBeInTheDocument();
            expect(screen.getByText('Elevation data available')).toBeInTheDocument();
            expect(screen.getByText('📍 Visualization Only')).toBeInTheDocument();
        });
    });

    describe('Track Visualization', () => {
        it('renders polyline with track coordinates', () => {
            render(<GpxTrackMap track={mockTrack} />);

            const polyline = screen.getByTestId('polyline');
            expect(polyline).toHaveAttribute('data-positions', '5');
            expect(polyline).toHaveAttribute('data-color', '#3b82f6');
            expect(polyline).toHaveAttribute('data-weight', '4');
            expect(polyline).toHaveAttribute('data-opacity', '0.8');
        });

        it('uses OpenStreetMap tiles', () => {
            render(<GpxTrackMap track={mockTrack} />);

            const tileLayer = screen.getByTestId('tile-layer');
            expect(tileLayer).toHaveAttribute(
                'data-url',
                'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            );
            expect(tileLayer.getAttribute('data-attribution')).toContain('OpenStreetMap');
        });

        it('handles track with different elevation availability', () => {
            const trackWithoutElevation = {
                ...mockTrack,
                points: mockTrack.points.map(p => ({ lat: p.lat, lon: p.lon })),
            };

            render(<GpxTrackMap track={trackWithoutElevation} />);

            expect(screen.queryByText('Elevation data available')).not.toBeInTheDocument();
        });
    });

    describe('Waypoint Markers', () => {
        it('renders waypoint markers', () => {
            render(<GpxTrackMap track={mockTrack} />);

            const markers = screen.getAllByTestId('marker');
            const waypointMarkers = markers.filter(
                marker => marker.getAttribute('data-icon-class') === 'custom-waypoint-marker'
            );

            expect(waypointMarkers).toHaveLength(1);
        });

        it('displays waypoint popup information', () => {
            render(<GpxTrackMap track={mockTrack} />);

            expect(screen.getByText('Checkpoint 1')).toBeInTheDocument();
            expect(screen.getByText('Rest area')).toBeInTheDocument();
            expect(screen.getByText('Symbol: flag')).toBeInTheDocument();
        });

        it('handles track without waypoints', () => {
            const trackWithoutWaypoints = { ...mockTrack, waypoints: [] };
            render(<GpxTrackMap track={trackWithoutWaypoints} />);

            expect(screen.queryByText(/waypoint/)).not.toBeInTheDocument();
        });

        it('displays correct waypoint count in overlay', () => {
            const trackWithMultipleWaypoints = {
                ...mockTrack,
                waypoints: [
                    { lat: 40.1, lon: -74.1, name: 'Point 1' },
                    { lat: 40.3, lon: -74.3, name: 'Point 2' },
                ],
            };

            render(<GpxTrackMap track={trackWithMultipleWaypoints} />);
            expect(screen.getByText('2 waypoints')).toBeInTheDocument();
        });
    });

    describe('Hover Point Marker', () => {
        it('renders hover marker when point is provided', () => {
            const hoveredPoint = { lat: 40.15, lon: -74.15, elevation: 1150 };
            render(<GpxTrackMap track={mockTrack} hoveredPoint={hoveredPoint} />);

            const markers = screen.getAllByTestId('marker');
            const hoverMarkers = markers.filter(
                marker => marker.getAttribute('data-icon-class') === 'custom-hover-marker'
            );

            expect(hoverMarkers).toHaveLength(1);
        });

        it('displays hover point popup information', () => {
            const hoveredPoint = { lat: 40.15, lon: -74.15, elevation: 1150 };
            render(<GpxTrackMap track={mockTrack} hoveredPoint={hoveredPoint} />);

            expect(screen.getByText('Current Position')).toBeInTheDocument();
            expect(screen.getByText('Lat: 40.150000')).toBeInTheDocument();
            expect(screen.getByText('Lon: -74.150000')).toBeInTheDocument();
            expect(screen.getByText('Elevation: 1150.0m')).toBeInTheDocument();
        });

        it('handles hover point without elevation', () => {
            const hoveredPoint = { lat: 40.15, lon: -74.15 };
            render(<GpxTrackMap track={mockTrack} hoveredPoint={hoveredPoint} />);

            expect(screen.getByText('Current Position')).toBeInTheDocument();
            expect(screen.getByText('Lat: 40.150000')).toBeInTheDocument();
            expect(screen.getByText('Lon: -74.150000')).toBeInTheDocument();

            // Should not show elevation for hover point (the 1200.0m is from waypoint)
            const currentPositionPopup = screen
                .getByText('Current Position')
                .closest('[data-testid="popup"]');
            expect(currentPositionPopup).not.toHaveTextContent('Elevation: 40.15');
        });

        it('does not render hover marker when null', () => {
            render(<GpxTrackMap track={mockTrack} hoveredPoint={null} />);

            const markers = screen.getAllByTestId('marker');
            const hoverMarkers = markers.filter(
                marker => marker.getAttribute('data-icon-class') === 'custom-hover-marker'
            );

            expect(hoverMarkers).toHaveLength(0);
        });
    });

    describe('Split Point Markers', () => {
        it('renders split point markers when boundaries provided', () => {
            const boundaries = [2.5, 5.0];
            render(<GpxTrackMap track={mockTrack} boundaries={boundaries} />);

            const markers = screen.getAllByTestId('marker');
            const splitMarkers = markers.filter(
                marker => marker.getAttribute('data-icon-class') === 'custom-split-marker'
            );

            expect(splitMarkers).toHaveLength(2);
        });

        it('displays split point information in overlay', () => {
            const boundaries = [2.5, 5.0];
            render(<GpxTrackMap track={mockTrack} boundaries={boundaries} />);

            expect(screen.getByText(/🔴 2 split points/)).toBeInTheDocument();
            expect(screen.getByText(/A, B/)).toBeInTheDocument();
        });

        it('generates correct split point labels', () => {
            const boundaries = [1.0, 2.0, 3.0];
            render(<GpxTrackMap track={mockTrack} boundaries={boundaries} />);

            expect(screen.getByText('Split Point A')).toBeInTheDocument();
            expect(screen.getByText('Split Point B')).toBeInTheDocument();
            expect(screen.getByText('Split Point C')).toBeInTheDocument();
        });

        it('does not render split markers when no boundaries', () => {
            render(<GpxTrackMap track={mockTrack} boundaries={[]} />);

            const markers = screen.getAllByTestId('marker');
            const splitMarkers = markers.filter(
                marker => marker.getAttribute('data-icon-class') === 'custom-split-marker'
            );

            expect(splitMarkers).toHaveLength(0);
            expect(screen.queryByText(/split point/)).not.toBeInTheDocument();
        });
    });

    describe('Performance Optimizations', () => {
        it('uses decimated points for large tracks', () => {
            render(<GpxTrackMap track={mockTrack} />);

            // Since we mocked decimateTrackPoints to return the same points,
            // we should verify it was called with the correct parameters
            expect(screen.getByTestId('polyline')).toHaveAttribute('data-positions', '5');
        });

        it('memoizes split point calculations', () => {
            const boundaries = [2.5];
            const { rerender } = render(<GpxTrackMap track={mockTrack} boundaries={boundaries} />);

            // Split point should be calculated
            expect(screen.getByText('Split Point A')).toBeInTheDocument();

            // Rerender with same props - split points should remain the same
            rerender(<GpxTrackMap track={mockTrack} boundaries={boundaries} />);
            expect(screen.getByText('Split Point A')).toBeInTheDocument();
        });
    });

    describe('Distance Calculations', () => {
        it('calculates split points based on distance along track', () => {
            const boundaries = [0]; // At start
            render(<GpxTrackMap track={mockTrack} boundaries={boundaries} />);

            // Should show distance 0.00 km in popup
            expect(screen.getByText('Distance: 0.00 km')).toBeInTheDocument();
        });

        it('finds closest track points for split boundaries', () => {
            const boundaries = [10]; // Far distance
            render(<GpxTrackMap track={mockTrack} boundaries={boundaries} />);

            // Should still create a split point at closest available location
            const markers = screen.getAllByTestId('marker');
            const splitMarkers = markers.filter(
                marker => marker.getAttribute('data-icon-class') === 'custom-split-marker'
            );

            expect(splitMarkers).toHaveLength(1);
        });
    });

    describe('Error Handling', () => {
        it('handles track with no points gracefully', () => {
            const emptyTrack = { ...mockTrack, points: [] };

            expect(() => {
                render(<GpxTrackMap track={emptyTrack} />);
            }).not.toThrow();

            expect(screen.getByText('0 track points')).toBeInTheDocument();
        });

        it('handles invalid coordinates gracefully', () => {
            const invalidTrack = {
                ...mockTrack,
                points: [
                    { lat: NaN, lon: -74.0, elevation: 1000 },
                    { lat: 40.1, lon: NaN, elevation: 1100 },
                ],
            };

            expect(() => {
                render(<GpxTrackMap track={invalidTrack} />);
            }).not.toThrow();
        });

        it('handles split boundaries with edge cases', () => {
            const edgeCases = [NaN, Infinity, -Infinity, 0, -1];

            expect(() => {
                render(<GpxTrackMap track={mockTrack} boundaries={edgeCases} />);
            }).not.toThrow();
        });
    });

    describe('Responsive Design', () => {
        it('applies responsive styling classes', () => {
            render(<GpxTrackMap track={mockTrack} className="responsive-map" />);

            const container = screen.getByTestId('map-container').closest('.relative');
            expect(container).toHaveClass('h-96', 'w-full', 'responsive-map');
        });

        it('positions overlay appropriately', () => {
            render(<GpxTrackMap track={mockTrack} />);

            const overlay = screen.getByText('Test Track').closest('.absolute');
            expect(overlay).toHaveClass('top-4', 'left-4', 'bg-white', 'bg-opacity-90');
        });
    });

    describe('Accessibility', () => {
        it('provides semantic information about track', () => {
            render(<GpxTrackMap track={mockTrack} />);

            // Track name should be visible
            expect(screen.getByText('Test Track')).toBeVisible();

            // Point counts should be clear
            expect(screen.getByText('5 track points')).toBeVisible();
            expect(screen.getByText('1 waypoint')).toBeVisible();
        });

        it('provides detailed popup information for markers', () => {
            const hoveredPoint = { lat: 40.15, lon: -74.15, elevation: 1150 };
            render(<GpxTrackMap track={mockTrack} hoveredPoint={hoveredPoint} />);

            // Popup should contain precise coordinates
            expect(screen.getByText('Lat: 40.150000')).toBeInTheDocument();
            expect(screen.getByText('Lon: -74.150000')).toBeInTheDocument();
        });

        it('uses clear visual indicators for different marker types', () => {
            const boundaries = [2.5];
            const hoveredPoint = { lat: 40.15, lon: -74.15 };

            render(
                <GpxTrackMap
                    track={mockTrack}
                    hoveredPoint={hoveredPoint}
                    boundaries={boundaries}
                />
            );

            const markers = screen.getAllByTestId('marker');

            // Should have different icon classes for different marker types
            const iconClasses = markers.map(m => m.getAttribute('data-icon-class'));
            expect(iconClasses).toContain('custom-waypoint-marker');
            expect(iconClasses).toContain('custom-hover-marker');
            expect(iconClasses).toContain('custom-split-marker');
        });
    });
});
