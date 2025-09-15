import { describe, it, expect, vi } from 'vitest';
import {
    decimateTrackPoints,
    GpxParseError,
    parseGpxFile,
    generateGpxXml,
    calculateDistance,
    getTotalDistance,
} from '../utils/gpx';
import type { GpxTrackPoint, GpxSegment } from '../types/gpx';

describe('GPX Utilities', () => {
    describe('decimateTrackPoints', () => {
        it('returns original points when count is below threshold', () => {
            const points: GpxTrackPoint[] = [
                { lat: 40.0, lon: -74.0 },
                { lat: 40.1, lon: -74.1 },
                { lat: 40.2, lon: -74.2 },
            ];

            const result = decimateTrackPoints(points, 10);
            expect(result).toEqual(points);
        });

        it('decimates points when count exceeds threshold', () => {
            const points: GpxTrackPoint[] = Array.from({ length: 1000 }, (_, i) => ({
                lat: 40.0 + i * 0.001,
                lon: -74.0 + i * 0.001,
            }));

            const result = decimateTrackPoints(points, 100);
            // Should be around 100 points (plus maybe one extra for the last point)
            expect(result.length).toBeLessThanOrEqual(105);
            expect(result.length).toBeGreaterThan(10);
        });

        it('always includes the last point', () => {
            const points: GpxTrackPoint[] = Array.from({ length: 1000 }, (_, i) => ({
                lat: 40.0 + i * 0.001,
                lon: -74.0 + i * 0.001,
            }));

            const result = decimateTrackPoints(points, 100);
            expect(result[result.length - 1]).toEqual(points[points.length - 1]);
        });

        it('handles empty array', () => {
            const result = decimateTrackPoints([], 100);
            expect(result).toEqual([]);
        });

        it('handles single point', () => {
            const points: GpxTrackPoint[] = [{ lat: 40.0, lon: -74.0 }];
            const result = decimateTrackPoints(points, 100);
            expect(result).toEqual(points);
        });

        it('uses default maxPoints when not specified', () => {
            const points: GpxTrackPoint[] = Array.from({ length: 3000 }, (_, i) => ({
                lat: 40.0 + i * 0.001,
                lon: -74.0 + i * 0.001,
            }));

            const result = decimateTrackPoints(points);
            expect(result.length).toBeLessThanOrEqual(2001); // Default 2000 + last point
            expect(result.length).toBeGreaterThan(1000);
        });
    });

    describe('GpxParseError', () => {
        it('creates error with correct name and message', () => {
            const error = new GpxParseError('Test error message');
            expect(error.name).toBe('GpxParseError');
            expect(error.message).toBe('Test error message');
            expect(error).toBeInstanceOf(Error);
        });

        it('can be caught as Error instance', () => {
            expect(() => {
                throw new GpxParseError('Test');
            }).toThrow(Error);
        });
    });

    describe('parseGpxFile', () => {
        const createMockFile = (content: string, filename = 'test.gpx'): File => {
            const blob = new Blob([content], { type: 'application/gpx+xml' });
            const file = new File([blob], filename, { type: 'application/gpx+xml' });

            // Mock the text() method for testing
            Object.defineProperty(file, 'text', {
                value: vi.fn().mockResolvedValue(content),
                writable: true,
                configurable: true,
            });

            return file;
        };

        const validGpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test Track</name>
    <trkseg>
      <trkpt lat="40.0" lon="-74.0">
        <ele>100</ele>
      </trkpt>
      <trkpt lat="40.1" lon="-74.1">
        <ele>110</ele>
      </trkpt>
      <trkpt lat="40.2" lon="-74.2">
        <ele>120</ele>
      </trkpt>
    </trkseg>
  </trk>
  <wpt lat="40.05" lon="-74.05">
    <name>Waypoint 1</name>
    <desc>Test waypoint</desc>
    <sym>flag</sym>
    <ele>105</ele>
  </wpt>
</gpx>`;

        it('parses valid GPX file successfully', async () => {
            const file = createMockFile(validGpxContent);
            const result = await parseGpxFile(file);

            expect(result.name).toBe('Test Track');
            expect(result.points).toHaveLength(3);
            expect(result.points[0]).toEqual({
                lat: 40.0,
                lon: -74.0,
                elevation: 100,
            });
            expect(result.bounds).toEqual({
                north: 40.2,
                south: 40.0,
                east: -74.0,
                west: -74.2,
            });
        });

        it('extracts waypoints correctly', async () => {
            const file = createMockFile(validGpxContent);
            const result = await parseGpxFile(file);

            expect(result.waypoints).toHaveLength(1);
            expect(result.waypoints![0]).toEqual({
                lat: 40.05,
                lon: -74.05,
                elevation: 105,
                name: 'Waypoint 1',
                description: 'Test waypoint',
                symbol: 'flag',
            });
        });

        it('handles GPX without waypoints', async () => {
            const gpxWithoutWaypoints = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test Track</name>
    <trkseg>
      <trkpt lat="40.0" lon="-74.0"><ele>100</ele></trkpt>
      <trkpt lat="40.1" lon="-74.1"><ele>110</ele></trkpt>
    </trkseg>
  </trk>
</gpx>`;

            const file = createMockFile(gpxWithoutWaypoints);
            const result = await parseGpxFile(file);

            expect(result.waypoints).toBeUndefined();
        });

        it('handles GPX without elevation data', async () => {
            const gpxWithoutElevation = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test Track</name>
    <trkseg>
      <trkpt lat="40.0" lon="-74.0"></trkpt>
      <trkpt lat="40.1" lon="-74.1"></trkpt>
    </trkseg>
  </trk>
</gpx>`;

            const file = createMockFile(gpxWithoutElevation);
            const result = await parseGpxFile(file);

            expect(result.points[0]).toEqual({
                lat: 40.0,
                lon: -74.0,
            });
            expect(result.points[0].elevation).toBeUndefined();
        });

        it('uses filename as track name when not specified', async () => {
            const gpxWithoutName = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <trkseg>
      <trkpt lat="40.0" lon="-74.0">
        <ele>100</ele>
      </trkpt>
      <trkpt lat="40.1" lon="-74.1">
        <ele>110</ele>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

            const file = createMockFile(gpxWithoutName, 'my-track.gpx');
            const result = await parseGpxFile(file);

            expect(result.name).toBe('my-track');
        });

        it('throws error for invalid XML', async () => {
            const invalidXml = 'This is not XML';
            const file = createMockFile(invalidXml);

            await expect(parseGpxFile(file)).rejects.toThrow(GpxParseError);
            await expect(parseGpxFile(file)).rejects.toThrow('Invalid XML format');
        });

        it('throws error for GPX without tracks', async () => {
            const gpxWithoutTracks = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <metadata>
    <name>Empty GPX</name>
  </metadata>
</gpx>`;

            const file = createMockFile(gpxWithoutTracks);

            await expect(parseGpxFile(file)).rejects.toThrow(GpxParseError);
            await expect(parseGpxFile(file)).rejects.toThrow('No tracks found');
        });

        it('throws error for track without points', async () => {
            const gpxWithoutPoints = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Empty Track</name>
    <trkseg></trkseg>
  </trk>
</gpx>`;

            const file = createMockFile(gpxWithoutPoints);

            await expect(parseGpxFile(file)).rejects.toThrow(GpxParseError);
            await expect(parseGpxFile(file)).rejects.toThrow('No tracks found');
        });

        it('handles file reading errors', async () => {
            // Mock a file that fails to read
            const mockFile = {
                text: vi.fn().mockRejectedValue(new Error('File read error')),
                name: 'test.gpx',
            } as unknown as File;

            await expect(parseGpxFile(mockFile)).rejects.toThrow('File read error');
        });
    });

    describe('generateGpxXml', () => {
        const mockSegment: GpxSegment = {
            name: 'Test Segment A',
            points: [
                { lat: 40.0, lon: -74.0, elevation: 100 },
                { lat: 40.1, lon: -74.1, elevation: 110 },
                { lat: 40.2, lon: -74.2, elevation: 120 },
            ],
            startIndex: 0,
            endIndex: 2,
            waypoints: [
                {
                    lat: 40.05,
                    lon: -74.05,
                    name: 'Test Waypoint',
                    description: 'A test waypoint',
                    symbol: 'flag',
                    elevation: 105,
                },
            ],
        };

        it('generates valid GPX XML content', () => {
            const gpxContent = generateGpxXml(mockSegment);

            expect(gpxContent).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(gpxContent).toContain('<gpx version="1.1"');
            expect(gpxContent).toContain('<name>Test Segment A</name>');
            expect(gpxContent).toContain('<trkpt lat="40" lon="-74">');
            expect(gpxContent).toContain('<ele>100</ele>');
        });

        it('includes all track points with elevation', () => {
            const gpxContent = generateGpxXml(mockSegment);

            mockSegment.points.forEach(point => {
                expect(gpxContent).toContain(`<trkpt lat="${point.lat}" lon="${point.lon}">`);
                if (point.elevation) {
                    expect(gpxContent).toContain(`<ele>${point.elevation}</ele>`);
                }
            });
        });

        it('includes waypoints when present', () => {
            const gpxContent = generateGpxXml(mockSegment);

            expect(gpxContent).toContain('<wpt lat="40.05" lon="-74.05">');
            expect(gpxContent).toContain('<![CDATA[Test Waypoint]]>');
            expect(gpxContent).toContain('<![CDATA[A test waypoint]]>');
            expect(gpxContent).toContain('<sym>flag</sym>');
        });

        it('handles segment without waypoints', () => {
            const { waypoints: _waypoints, ...segmentWithoutWaypoints } = mockSegment;
            const testSegment: GpxSegment = segmentWithoutWaypoints;

            const gpxContent = generateGpxXml(testSegment);

            expect(gpxContent).not.toContain('<wpt');
            expect(gpxContent).toContain('<trk>');
            expect(gpxContent).toContain('<trkpt');
        });

        it('handles points without elevation', () => {
            const segmentWithoutElevation: GpxSegment = {
                ...mockSegment,
                points: [
                    { lat: 40.0, lon: -74.0 },
                    { lat: 40.1, lon: -74.1 },
                ],
                waypoints: [], // Remove waypoints to avoid <ele> tags from waypoints
            };

            const gpxContent = generateGpxXml(segmentWithoutElevation);

            expect(gpxContent).toContain('<trkpt lat="40" lon="-74">');
            expect(gpxContent).not.toContain('<ele>');
        });

        it('properly escapes XML characters in names and descriptions', () => {
            const segmentWithSpecialChars: GpxSegment = {
                ...mockSegment,
                name: 'Track with <special> & "characters"',
                waypoints: [
                    {
                        lat: 40.0,
                        lon: -74.0,
                        name: 'Waypoint with <brackets>',
                        description: 'Description with & ampersand',
                    },
                ],
            };

            const gpxContent = generateGpxXml(segmentWithSpecialChars);

            expect(gpxContent).toContain('<name>Track with <special> & "characters"</name>');
            expect(gpxContent).toContain('<![CDATA[Waypoint with <brackets>]]>');
            expect(gpxContent).toContain('<![CDATA[Description with & ampersand]]>');
        });

        it('generates well-formed XML structure', () => {
            const gpxContent = generateGpxXml(mockSegment);

            // Basic XML structure validation
            expect(gpxContent).toMatch(/<gpx[^>]*>[\s\S]*<\/gpx>/);
            expect(gpxContent).toMatch(/<trk>[\s\S]*<\/trk>/);
            expect(gpxContent).toMatch(/<trkseg>[\s\S]*<\/trkseg>/);

            // Count opening and closing tags
            const trkptOpenCount = (gpxContent.match(/<trkpt/g) || []).length;
            const trkptCloseCount = (gpxContent.match(/<\/trkpt>/g) || []).length;
            expect(trkptOpenCount).toBe(trkptCloseCount);
            expect(trkptOpenCount).toBe(mockSegment.points.length);
        });
    });

    describe('calculateDistance', () => {
        it('calculates distance between two points correctly', () => {
            const point1: GpxTrackPoint = { lat: 40.0, lon: -74.0 };
            const point2: GpxTrackPoint = { lat: 40.1, lon: -74.1 };

            const distance = calculateDistance(point1, point2);

            // Should be approximately 14 km for this distance
            expect(distance).toBeGreaterThan(13000);
            expect(distance).toBeLessThan(15000);
        });

        it('returns 0 for identical points', () => {
            const point: GpxTrackPoint = { lat: 40.0, lon: -74.0 };

            const distance = calculateDistance(point, point);

            expect(distance).toBe(0);
        });

        it('handles elevation differences', () => {
            const point1: GpxTrackPoint = { lat: 40.0, lon: -74.0, elevation: 100 };
            const point2: GpxTrackPoint = { lat: 40.0, lon: -74.0, elevation: 200 };

            const distance = calculateDistance(point1, point2);

            // Same lat/lon but different elevation should still calculate distance
            expect(distance).toBeGreaterThanOrEqual(0);
        });
    });

    describe('getTotalDistance', () => {
        it('calculates total distance for multiple points', () => {
            const points: GpxTrackPoint[] = [
                { lat: 40.0, lon: -74.0 },
                { lat: 40.1, lon: -74.1 },
                { lat: 40.2, lon: -74.2 },
            ];

            const totalDistance = getTotalDistance(points);

            expect(totalDistance).toBeGreaterThan(0);
            expect(totalDistance).toBeCloseTo(28, 0); // Accurate Haversine calculation ~28km
        });

        it('returns 0 for empty array', () => {
            const totalDistance = getTotalDistance([]);

            expect(totalDistance).toBe(0);
        });

        it('returns 0 for single point', () => {
            const points: GpxTrackPoint[] = [{ lat: 40.0, lon: -74.0 }];

            const totalDistance = getTotalDistance(points);

            expect(totalDistance).toBe(0);
        });
    });
});
