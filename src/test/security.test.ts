import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    SecurityError,
    sanitizeText,
    sanitizeWaypoint,
    validateXmlSecurity,
    validateFileSize,
    validateGpxData,
    createSecureParser,
    withTimeout,
    SECURITY_LIMITS,
} from '../utils/security';

describe('Security Utilities', () => {
    describe('SecurityError', () => {
        it('creates error with correct type and message', () => {
            const error = new SecurityError('Test message', 'XSS');
            expect(error.message).toBe('Test message');
            expect(error.type).toBe('XSS');
            expect(error.name).toBe('SecurityError');
        });

        it('supports all security error types', () => {
            const xssError = new SecurityError('XSS test', 'XSS');
            const xxeError = new SecurityError('XXE test', 'XXE');
            const perfError = new SecurityError('Performance test', 'PERFORMANCE');

            expect(xssError.type).toBe('XSS');
            expect(xxeError.type).toBe('XXE');
            expect(perfError.type).toBe('PERFORMANCE');
        });
    });

    describe('XSS Prevention', () => {
        describe('sanitizeText', () => {
            it('handles null and undefined input', () => {
                expect(sanitizeText(null)).toBe('');
                expect(sanitizeText(undefined)).toBe('');
                expect(sanitizeText('')).toBe('');
            });

            it('removes HTML tags', () => {
                expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")');
                expect(sanitizeText('<div>Safe content</div>')).toBe('Safe content');
                expect(sanitizeText('<img src="x" onerror="alert(1)">')).toBe('');
            });

            it('removes javascript protocols', () => {
                expect(sanitizeText('javascript:alert(1)')).toBe('alert(1)');
                expect(sanitizeText('JAVASCRIPT:alert(1)')).toBe('alert(1)');
                expect(sanitizeText('vbscript:msgbox(1)')).toBe('msgbox(1)');
            });

            it('removes event handlers', () => {
                expect(sanitizeText('onclick="alert(1)"')).toBe('');
                expect(sanitizeText('onmouseover="alert(1)"')).toBe('');
                expect(sanitizeText('ONCLICK="alert(1)"')).toBe('');
            });

            it('removes data URLs', () => {
                expect(sanitizeText('data:text/html,<script>alert(1)</script>')).toBe(
                    'text/html,alert(1)'
                );
                expect(sanitizeText('DATA:image/svg+xml;base64,PHN2Zz4=')).toBe(
                    'image/svg+xml;base64,PHN2Zz4='
                );
            });

            it('decodes HTML entities and then sanitizes', () => {
                expect(sanitizeText('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('alert(1)');
                expect(sanitizeText('&quot;test&quot;')).toBe('"test"');
                expect(sanitizeText('&amp;amp;')).toBe('&amp;');
            });

            it('removes control characters', () => {
                expect(sanitizeText('test\x00\x01\x02')).toBe('test');
                expect(sanitizeText('test\x7F')).toBe('test');
                expect(sanitizeText('test\n\ttab')).toBe('test\n\ttab'); // Keep newlines and tabs
            });

            it('truncates long text', () => {
                const longText = 'a'.repeat(600);
                const sanitized = sanitizeText(longText);
                expect(sanitized.length).toBe(503); // 500 + '...'
                expect(sanitized.endsWith('...')).toBe(true);
            });

            it('preserves safe content', () => {
                expect(sanitizeText('Safe waypoint name')).toBe('Safe waypoint name');
                expect(sanitizeText('Mountain Peak (1,234m)')).toBe('Mountain Peak (1,234m)');
                expect(sanitizeText('GPS coordinates: 45.123, -122.456')).toBe(
                    'GPS coordinates: 45.123, -122.456'
                );
            });
        });

        describe('sanitizeWaypoint', () => {
            it('sanitizes all text fields in waypoint', () => {
                const maliciousWaypoint = {
                    name: '<script>alert("name")</script>',
                    description: '<img src="x" onerror="alert(1)">',
                    symbol: 'javascript:alert(1)',
                    lat: 45.123,
                    lon: -122.456,
                };

                const sanitized = sanitizeWaypoint(maliciousWaypoint);

                expect(sanitized.name).toBe('alert("name")');
                expect(sanitized.description).toBe('');
                expect(sanitized.symbol).toBe('alert(1)');
                expect(sanitized['lat']).toBe(45.123); // Numbers preserved
                expect(sanitized['lon']).toBe(-122.456);
            });

            it('handles waypoint with missing fields', () => {
                const waypoint = { lat: 45.123, lon: -122.456 };
                const sanitized = sanitizeWaypoint(waypoint);

                expect(sanitized['lat']).toBe(45.123);
                expect(sanitized['lon']).toBe(-122.456);
                expect(sanitized.name).toBeUndefined();
                expect(sanitized.description).toBeUndefined();
                expect(sanitized.symbol).toBeUndefined();
            });

            it('preserves safe waypoint content', () => {
                const safeWaypoint = {
                    name: 'Mountain Peak',
                    description: 'Beautiful viewpoint with panoramic views',
                    symbol: 'triangle',
                    lat: 45.123,
                    lon: -122.456,
                };

                const sanitized = sanitizeWaypoint(safeWaypoint);

                expect(sanitized.name).toBe('Mountain Peak');
                expect(sanitized.description).toBe('Beautiful viewpoint with panoramic views');
                expect(sanitized.symbol).toBe('triangle');
            });
        });
    });

    describe('XXE Prevention', () => {
        describe('validateXmlSecurity', () => {
            it('detects external entity declarations', () => {
                const maliciousXml = `<?xml version="1.0"?>
                    <!DOCTYPE root [
                        <!ENTITY xxe SYSTEM "file:///etc/passwd">
                    ]>
                    <root>&xxe;</root>`;

                expect(() => validateXmlSecurity(maliciousXml)).toThrow(SecurityError);
                expect(() => validateXmlSecurity(maliciousXml)).toThrow(/SYSTEM entity references/);
            });

            it('detects PUBLIC entity declarations', () => {
                const maliciousXml = `<!DOCTYPE root [
                    <!ENTITY xxe PUBLIC "public" "http://evil.com/evil.dtd">
                ]>`;

                expect(() => validateXmlSecurity(maliciousXml)).toThrow(SecurityError);
            });

            it('detects parameter entities', () => {
                const maliciousXml = `<!DOCTYPE root [
                    <!ENTITY % xxe SYSTEM "http://evil.com/evil.dtd">
                    %xxe;
                ]>`;

                expect(() => validateXmlSecurity(maliciousXml)).toThrow(SecurityError);
            });

            it('detects entity references', () => {
                const maliciousXml = `<root>&xxe;</root>`;
                expect(() => validateXmlSecurity(maliciousXml)).toThrow(SecurityError);
            });

            it('detects DOCTYPE with external references', () => {
                const maliciousXml = `<!DOCTYPE root SYSTEM "http://evil.com/evil.dtd">`;
                expect(() => validateXmlSecurity(maliciousXml)).toThrow(SecurityError);
                expect(() => validateXmlSecurity(maliciousXml)).toThrow(
                    /DOCTYPE with external references/
                );
            });

            it('allows safe XML content', () => {
                const safeXml = `<?xml version="1.0"?>
                    <gpx version="1.1">
                        <trk>
                            <name>Safe Track</name>
                            <trkseg>
                                <trkpt lat="45.123" lon="-122.456">
                                    <ele>100</ele>
                                </trkpt>
                            </trkseg>
                        </trk>
                    </gpx>`;

                expect(() => validateXmlSecurity(safeXml)).not.toThrow();
            });

            it('handles case-insensitive patterns', () => {
                const maliciousXml = `<!entity test SYSTEM "file://test">`;
                expect(() => validateXmlSecurity(maliciousXml)).toThrow(SecurityError);
            });
        });

        describe('createSecureParser', () => {
            it('creates parser that validates XML security', () => {
                const parser = createSecureParser();
                const maliciousXml = `<!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>`;

                expect(() => parser.parseFromString(maliciousXml, 'application/xml')).toThrow(
                    SecurityError
                );
            });

            it('parses safe XML successfully', () => {
                const parser = createSecureParser();
                const safeXml = `<root><test>content</test></root>`;

                const doc = parser.parseFromString(safeXml, 'application/xml');
                expect(doc.querySelector('test')?.textContent).toBe('content');
            });
        });
    });

    describe('Client-Side Performance Protection', () => {
        describe('validateFileSize', () => {
            it('allows files under size limit', () => {
                const smallFile = new File(['test content'], 'test.gpx', {
                    type: 'application/gpx+xml',
                });
                expect(() => validateFileSize(smallFile)).not.toThrow();
            });

            it('rejects files over size limit to prevent browser issues', () => {
                // Create a mock file that exceeds the limit
                const largeFile = {
                    size: SECURITY_LIMITS.MAX_FILE_SIZE + 1,
                    name: 'large.gpx',
                } as File;

                expect(() => validateFileSize(largeFile)).toThrow(SecurityError);
                expect(() => validateFileSize(largeFile)).toThrow(/browser performance issues/);
            });

            it('provides helpful error message about browser performance', () => {
                const largeFile = {
                    size: 20 * 1024 * 1024, // 20MB
                    name: 'large.gpx',
                } as File;

                expect(() => validateFileSize(largeFile)).toThrow(
                    /20.0MB exceeds maximum allowed size of 10MB.*browser performance/
                );
            });
        });

        describe('validateGpxData', () => {
            it('allows reasonable track data', () => {
                const data = {
                    points: Array(1000).fill({ lat: 45, lon: -122 }),
                    waypoints: Array(10).fill({ lat: 45, lon: -122 }),
                };

                expect(() => validateGpxData(data)).not.toThrow();
            });

            it('rejects tracks with too many points to prevent browser slowdown', () => {
                const data = {
                    points: Array(SECURITY_LIMITS.MAX_POINTS + 1).fill({ lat: 45, lon: -122 }),
                    waypoints: [],
                };

                expect(() => validateGpxData(data)).toThrow(SecurityError);
                expect(() => validateGpxData(data)).toThrow(/browser performance issues/);
            });

            it('rejects tracks with too many waypoints to prevent map rendering issues', () => {
                const data = {
                    points: Array(100).fill({ lat: 45, lon: -122 }),
                    waypoints: Array(SECURITY_LIMITS.MAX_WAYPOINTS + 1).fill({
                        lat: 45,
                        lon: -122,
                    }),
                };

                expect(() => validateGpxData(data)).toThrow(SecurityError);
                expect(() => validateGpxData(data)).toThrow(/slow down map rendering/);
            });

            it('handles missing waypoints gracefully', () => {
                const data = {
                    points: Array(100).fill({ lat: 45, lon: -122 }),
                };

                expect(() => validateGpxData(data)).not.toThrow();
            });
        });

        describe('withTimeout', () => {
            beforeEach(() => {
                vi.useFakeTimers();
            });

            afterEach(() => {
                vi.useRealTimers();
            });

            it('resolves successful operations', async () => {
                const fastOperation = Promise.resolve('success');
                const result = await withTimeout(fastOperation, 1000);
                expect(result).toBe('success');
            });

            it('rejects operations that exceed timeout to prevent UI freezing', async () => {
                const slowOperation = new Promise(resolve => setTimeout(resolve, 2000));
                const timeoutPromise = withTimeout(slowOperation, 1000);

                // Fast-forward time to trigger timeout
                vi.advanceTimersByTime(1001);

                await expect(timeoutPromise).rejects.toThrow(SecurityError);
                await expect(timeoutPromise).rejects.toThrow(/prevents the browser from freezing/);
            });

            it('uses default timeout when not specified', async () => {
                const slowOperation = new Promise(resolve =>
                    setTimeout(resolve, SECURITY_LIMITS.PARSE_TIMEOUT + 1000)
                );
                const timeoutPromise = withTimeout(slowOperation);

                vi.advanceTimersByTime(SECURITY_LIMITS.PARSE_TIMEOUT + 1);

                await expect(timeoutPromise).rejects.toThrow(SecurityError);
            });
        });
    });

    describe('Security Configuration', () => {
        it('has reasonable client-side performance limits', () => {
            expect(SECURITY_LIMITS.MAX_FILE_SIZE).toBe(10 * 1024 * 1024); // 10MB - reasonable for browser
            expect(SECURITY_LIMITS.MAX_POINTS).toBe(50000); // Keep UI responsive
            expect(SECURITY_LIMITS.MAX_WAYPOINTS).toBe(1000); // Keep map rendering smooth
            expect(SECURITY_LIMITS.PARSE_TIMEOUT).toBe(10000); // 10 seconds - reasonable for client
            expect(SECURITY_LIMITS.MAX_TEXT_FIELD_LENGTH).toBe(500);
        });

        it('defines empty allowed HTML tags for XSS prevention', () => {
            expect(SECURITY_LIMITS.ALLOWED_HTML_TAGS).toEqual([]);
        });
    });
});
