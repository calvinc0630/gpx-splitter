import { gpx } from '@mapbox/togeojson';
import type { GeoJSONFeature } from '@mapbox/togeojson';
import { saveAs } from 'file-saver';
import type { GpxTrack, GpxTrackPoint, GpxSegment, GpxWaypoint } from '../types/gpx';
import { getTotalDistance as getTotalDistanceUtil, DistanceUnit } from './distance';
import {
    SecurityError,
    validateFileSize,
    validateGpxData,
    createSecureParser,
    sanitizeWaypoint,
    withTimeout,
} from './security';

export class GpxParseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GpxParseError';
    }
}

// Performance optimization: decimate track points for display
export const decimateTrackPoints = (
    points: GpxTrackPoint[],
    maxPoints: number = 2000
): GpxTrackPoint[] => {
    if (points.length <= maxPoints) {
        return points;
    }

    const step = Math.ceil(points.length / maxPoints);
    const decimated: GpxTrackPoint[] = [];

    for (let i = 0; i < points.length; i += step) {
        decimated.push(points[i]);
    }

    // Always include the last point
    if (decimated[decimated.length - 1] !== points[points.length - 1]) {
        decimated.push(points[points.length - 1]);
    }

    return decimated;
};

export const parseGpxFile = async (file: File): Promise<GpxTrack> => {
    try {
        // Validate file size to prevent DoS attacks
        validateFileSize(file);

        // Read file content with timeout protection
        const text = await withTimeout(file.text());

        // Use secure parser to prevent XXE attacks
        const secureParser = createSecureParser();
        const xmlDoc = secureParser.parseFromString(text, 'application/xml');

        // Check for XML parsing errors
        const parseError = xmlDoc.querySelector('parsererror');
        if (parseError) {
            throw new GpxParseError('Invalid XML format in GPX file');
        }

        // Convert GPX to GeoJSON using togeojson for tracks
        const geoJson = gpx(xmlDoc);

        if (!geoJson.features || geoJson.features.length === 0) {
            throw new GpxParseError('No tracks found in GPX file');
        }

        // Find the first track (LineString)
        const trackFeature = geoJson.features.find(
            (
                feature
            ): feature is GeoJSONFeature & {
                geometry: { type: 'LineString'; coordinates: number[][] };
            } => feature.geometry.type === 'LineString'
        );

        if (!trackFeature || !trackFeature.geometry.coordinates) {
            throw new GpxParseError('No valid track data found in GPX file');
        }

        // Convert coordinates to track points
        const points: GpxTrackPoint[] = trackFeature.geometry.coordinates.map((coord: number[]) => {
            const [lon, lat, elevation] = coord;
            const point: GpxTrackPoint = { lat, lon };

            if (elevation !== undefined) {
                point.elevation = elevation;
            }

            return point;
        });

        if (points.length === 0) {
            throw new GpxParseError('Track contains no points');
        }

        // Parse waypoints directly from XML
        const waypoints: GpxWaypoint[] = [];
        const waypointElements = xmlDoc.querySelectorAll('wpt');

        waypointElements.forEach(wptElement => {
            const lat = parseFloat(wptElement.getAttribute('lat') || '0');
            const lon = parseFloat(wptElement.getAttribute('lon') || '0');

            if (!isNaN(lat) && !isNaN(lon)) {
                const waypoint: GpxWaypoint = { lat, lon };

                // Extract elevation
                const eleElement = wptElement.querySelector('ele');
                if (eleElement?.textContent) {
                    const elevation = parseFloat(eleElement.textContent);
                    if (!isNaN(elevation)) {
                        waypoint.elevation = elevation;
                    }
                }

                // Extract and sanitize name to prevent XSS
                const nameElement = wptElement.querySelector('name');
                if (nameElement?.textContent) {
                    waypoint.name = nameElement.textContent.trim();
                }

                // Extract and sanitize description to prevent XSS
                const descElement = wptElement.querySelector('desc');
                if (descElement?.textContent) {
                    waypoint.description = descElement.textContent.trim();
                }

                // Extract and sanitize symbol to prevent XSS
                const symElement = wptElement.querySelector('sym');
                if (symElement?.textContent) {
                    waypoint.symbol = symElement.textContent.trim();
                }

                // Apply security sanitization
                const sanitizationInput: {
                    [key: string]: unknown;
                    name?: string;
                    description?: string;
                    symbol?: string;
                } = {};
                if (waypoint.name !== undefined) sanitizationInput.name = waypoint.name;
                if (waypoint.description !== undefined)
                    sanitizationInput.description = waypoint.description;
                if (waypoint.symbol !== undefined) sanitizationInput.symbol = waypoint.symbol;

                const sanitizedData = sanitizeWaypoint(sanitizationInput);
                const sanitizedWaypoint: GpxWaypoint = {
                    lat: waypoint.lat,
                    lon: waypoint.lon,
                };

                // Only add properties if they exist and are not undefined
                if (waypoint.elevation !== undefined)
                    sanitizedWaypoint.elevation = waypoint.elevation;
                if (sanitizedData.name !== undefined) sanitizedWaypoint.name = sanitizedData.name;
                if (sanitizedData.description !== undefined)
                    sanitizedWaypoint.description = sanitizedData.description;
                if (sanitizedData.symbol !== undefined)
                    sanitizedWaypoint.symbol = sanitizedData.symbol;
                waypoints.push(sanitizedWaypoint);
            }
        });

        // Calculate bounds including waypoints
        const allLats = [...points.map(p => p.lat), ...waypoints.map(w => w.lat)];
        const allLons = [...points.map(p => p.lon), ...waypoints.map(w => w.lon)];

        const bounds = {
            north: Math.max(...allLats),
            south: Math.min(...allLats),
            east: Math.max(...allLons),
            west: Math.min(...allLons),
        };

        // Extract track name
        const trackName =
            trackFeature.properties?.name ||
            trackFeature.properties?.title ||
            file.name.replace('.gpx', '');

        const track: GpxTrack = {
            name: trackName,
            points,
            bounds,
            ...(waypoints.length > 0 && { waypoints }),
        };

        // Validate parsed data to prevent DoS attacks
        validateGpxData(track);

        return track;
    } catch (error) {
        if (error instanceof GpxParseError || error instanceof SecurityError) {
            throw error;
        }
        throw new GpxParseError(
            `Failed to parse GPX file: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
};

// Re-export the shared distance calculation utility
export { calculateDistanceBetweenPoints as calculateDistance } from './distance';

export const getTotalDistance = (points: GpxTrackPoint[]): number => {
    return getTotalDistanceUtil(points, DistanceUnit.KILOMETERS);
};

export const generateGpxXml = (segment: GpxSegment): string => {
    const currentDate = new Date().toISOString();

    const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="GPX Track Splitter" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${segment.name}</name>
    <time>${currentDate}</time>
  </metadata>`;

    // Add waypoints if they exist
    let waypointsXml = '';
    if (segment.waypoints && segment.waypoints.length > 0) {
        waypointsXml = segment.waypoints
            .map(waypoint => {
                let wptXml = `  <wpt lat="${waypoint.lat}" lon="${waypoint.lon}">`;

                if (waypoint.elevation !== undefined) {
                    wptXml += `\n    <ele>${waypoint.elevation}</ele>`;
                }

                if (waypoint.name) {
                    wptXml += `\n    <name><![CDATA[${waypoint.name}]]></name>`;
                }

                if (waypoint.description) {
                    wptXml += `\n    <desc><![CDATA[${waypoint.description}]]></desc>`;
                }

                if (waypoint.symbol) {
                    wptXml += `\n    <sym>${waypoint.symbol}</sym>`;
                }

                wptXml += '\n  </wpt>';
                return wptXml;
            })
            .join('\n');
    }

    const trackHeader = `  <trk>
    <name>${segment.name}</name>
    <trkseg>`;

    const trackPoints = segment.points
        .map(point => {
            let trkpt = `      <trkpt lat="${point.lat}" lon="${point.lon}">`;

            if (point.elevation !== undefined) {
                trkpt += `\n        <ele>${point.elevation}</ele>`;
            }

            if (point.time) {
                trkpt += `\n        <time>${point.time.toISOString()}</time>`;
            }

            trkpt += '\n      </trkpt>';
            return trkpt;
        })
        .join('\n');

    const gpxFooter = `
    </trkseg>
  </trk>
</gpx>`;

    return (
        gpxHeader +
        '\n' +
        waypointsXml +
        (waypointsXml ? '\n' : '') +
        trackHeader +
        '\n' +
        trackPoints +
        gpxFooter
    );
};

export const downloadGpxFile = (segment: GpxSegment): void => {
    const gpxContent = generateGpxXml(segment);
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    saveAs(blob, `${segment.name}.gpx`);
};

// Constants for download behavior
const DOWNLOAD_CONSTANTS = {
    DOWNLOAD_DELAY_MS: 100, // Delay between downloads to avoid browser restrictions
} as const;

export const downloadAllSegments = (segments: GpxSegment[]): void => {
    segments.forEach((segment, index) => {
        // Add a small delay between downloads to avoid browser restrictions
        setTimeout(() => {
            downloadGpxFile(segment);
        }, index * DOWNLOAD_CONSTANTS.DOWNLOAD_DELAY_MS);
    });
};
