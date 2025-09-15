import { describe, it, expect } from 'vitest';
import { parseGpxFile } from '../utils/gpx';
import { SecurityError } from '../utils/security';

// Helper to create a proper File mock
const createTestFile = (content: string, filename: string = 'test.gpx', size?: number): File => {
    const blob = new Blob([content], { type: 'application/gpx+xml' });
    const file = new File([blob], filename, { type: 'application/gpx+xml' });

    // Add the text() method that our parser needs
    Object.defineProperty(file, 'text', {
        value: async () => content,
        writable: false,
        configurable: true,
    });

    // If we need to override size, we'll use defineProperty
    if (size !== undefined) {
        Object.defineProperty(file, 'size', {
            value: size,
            writable: false,
            configurable: true,
        });
    }

    return file;
};

describe('GPX Security Integration', () => {
    describe('XSS Prevention in GPX Parsing', () => {
        it('sanitizes malicious waypoint names', async () => {
            const maliciousGpx = `<?xml version="1.0"?>
                <gpx version="1.1">
                    <wpt lat="45.123" lon="-122.456">
                        <name>javascript:alert('xss') Evil Waypoint</name>
                        <desc>data:text/html,malicious content</desc>
                        <sym>vbscript:evil()</sym>
                    </wpt>
                    <trk>
                        <name>Safe Track</name>
                        <trkseg>
                            <trkpt lat="45.123" lon="-122.456">
                                <ele>100</ele>
                            </trkpt>
                            <trkpt lat="45.124" lon="-122.457">
                                <ele>101</ele>
                            </trkpt>
                        </trkseg>
                    </trk>
                </gpx>`;

            const file = createTestFile(maliciousGpx);
            const track = await parseGpxFile(file);

            expect(track.waypoints).toBeDefined();
            expect(track.waypoints).toHaveLength(1);
            // JavaScript protocols should be removed by sanitization
            expect(track.waypoints![0].name).toBe("alert('xss') Evil Waypoint");
            // Data URLs should be removed - only "data:" is removed, leaving "text/html,malicious content"
            expect(track.waypoints![0].description).toBe('text/html,malicious content');
            // VBScript protocols should be removed
            expect(track.waypoints![0].symbol).toBe('evil()');
        });

        it('truncates extremely long waypoint descriptions', async () => {
            const longDescription = 'A'.repeat(600);
            const gpxWithLongDescription = `<?xml version="1.0"?>
                <gpx version="1.1">
                    <wpt lat="45.123" lon="-122.456">
                        <name>Normal Name</name>
                        <desc>${longDescription}</desc>
                    </wpt>
                    <trk>
                        <name>Test Track</name>
                        <trkseg>
                            <trkpt lat="45.123" lon="-122.456">
                                <ele>100</ele>
                            </trkpt>
                            <trkpt lat="45.124" lon="-122.457">
                                <ele>101</ele>
                            </trkpt>
                        </trkseg>
                    </trk>
                </gpx>`;

            const file = createTestFile(gpxWithLongDescription);
            const track = await parseGpxFile(file);

            expect(track.waypoints).toBeDefined();
            expect(track.waypoints).toHaveLength(1);
            expect(track.waypoints![0].description!.length).toBe(503); // 500 + '...'
            expect(track.waypoints![0].description!.endsWith('...')).toBe(true);
        });
    });

    describe('XXE Prevention in GPX Parsing', () => {
        it('rejects GPX with external entity references', async () => {
            const xxeGpx = `<?xml version="1.0"?>
                <!DOCTYPE gpx [
                    <!ENTITY xxe SYSTEM "file:///etc/passwd">
                ]>
                <gpx version="1.1">
                    <trk>
                        <name>&xxe;</name>
                        <trkseg>
                            <trkpt lat="45.123" lon="-122.456">
                                <ele>100</ele>
                            </trkpt>
                        </trkseg>
                    </trk>
                </gpx>`;

            const file = createTestFile(xxeGpx);

            await expect(parseGpxFile(file)).rejects.toThrow(SecurityError);
            await expect(parseGpxFile(file)).rejects.toThrow(/SYSTEM entity references/);
        });
    });

    describe('Client-Side Performance Protection', () => {
        it('rejects files that are too large to prevent browser memory issues', async () => {
            const smallContent = '<gpx></gpx>';
            const file = createTestFile(smallContent, 'large.gpx', 15 * 1024 * 1024); // 15MB

            await expect(parseGpxFile(file)).rejects.toThrow(SecurityError);
            await expect(parseGpxFile(file)).rejects.toThrow(/browser performance issues/);
        });
    });

    describe('Valid GPX Files', () => {
        it('successfully parses safe GPX files', async () => {
            const safeGpx = `<?xml version="1.0"?>
                <gpx version="1.1">
                    <wpt lat="45.123" lon="-122.456">
                        <name>Safe Waypoint</name>
                        <desc>A beautiful mountain peak with great views</desc>
                        <sym>triangle</sym>
                        <ele>1234</ele>
                    </wpt>
                    <trk>
                        <name>Safe Track</name>
                        <trkseg>
                            <trkpt lat="45.123" lon="-122.456">
                                <ele>100</ele>
                            </trkpt>
                            <trkpt lat="45.124" lon="-122.457">
                                <ele>101</ele>
                            </trkpt>
                            <trkpt lat="45.125" lon="-122.458">
                                <ele>102</ele>
                            </trkpt>
                        </trkseg>
                    </trk>
                </gpx>`;

            const file = createTestFile(safeGpx);
            const track = await parseGpxFile(file);

            expect(track.name).toBe('Safe Track');
            expect(track.points).toHaveLength(3);
            expect(track.waypoints).toHaveLength(1);
            expect(track.waypoints![0].name).toBe('Safe Waypoint');
            expect(track.waypoints![0].description).toBe(
                'A beautiful mountain peak with great views'
            );
            expect(track.waypoints![0].symbol).toBe('triangle');
        });
    });
});
