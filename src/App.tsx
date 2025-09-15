import { useState, useEffect, useMemo } from 'react';
import './App.css';
import { FileUpload } from './components/FileUpload';
import { GpxTrackMap } from './components/Map';
import { ElevationChart } from './components/ElevationChart';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Button, Card, InfoCard, Alert } from './components/ui';
import { parseGpxFile, GpxParseError, downloadAllSegments, downloadGpxFile } from './utils/gpx';
import { SecurityError } from './utils/security';
import { findPointAtDistance, DistanceUnit } from './utils/distance';
import type { GpxTrack } from './types/gpx';

function App() {
    const [gpxTrack, setGpxTrack] = useState<GpxTrack | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hoveredPoint, setHoveredPoint] = useState<{
        lat: number;
        lon: number;
        elevation?: number;
    } | null>(null);
    const [numSegments, setNumSegments] = useState<number>(1);
    const [boundaries, setBoundaries] = useState<number[]>([]);

    // Update numSegments when boundaries change
    useEffect(() => {
        setNumSegments(boundaries.length + 1);
    }, [boundaries]);

    // Memoized segments generation - prevents redundant expensive calculations
    const segments = useMemo(() => {
        if (!gpxTrack || boundaries.length === 0) {
            return [
                {
                    name: `${gpxTrack?.name || 'Track'} - Segment 1`,
                    points: gpxTrack?.points || [],
                    startIndex: 0,
                    endIndex: (gpxTrack?.points?.length || 1) - 1,
                    waypoints: gpxTrack?.waypoints || [],
                },
            ];
        }

        const segmentsArray = [];
        const boundaryIndices = boundaries.map(distance => {
            // Convert distance to point index using shared utility
            const result = findPointAtDistance(gpxTrack.points, distance, DistanceUnit.KILOMETERS);
            return result.index;
        });

        // Sort boundary indices
        boundaryIndices.sort((a, b) => a - b);

        // Create segments with A-Z naming convention
        let startIndex = 0;
        boundaryIndices.forEach((endIndex, i) => {
            const segmentSuffix = String.fromCharCode(65 + i); // A, B, C, etc.
            segmentsArray.push({
                name: `${gpxTrack.name}_${segmentSuffix}`,
                points: gpxTrack.points.slice(startIndex, endIndex + 1),
                startIndex,
                endIndex,
                waypoints: [],
            });
            startIndex = endIndex;
        });

        // Add final segment
        const finalSegmentSuffix = String.fromCharCode(65 + segmentsArray.length);
        segmentsArray.push({
            name: `${gpxTrack.name}_${finalSegmentSuffix}`,
            points: gpxTrack.points.slice(startIndex),
            startIndex,
            endIndex: gpxTrack.points.length - 1,
            waypoints: [],
        });

        return segmentsArray;
    }, [gpxTrack, boundaries]);

    // Helper function to provide user-friendly error messages
    const getErrorMessage = (error: unknown): string => {
        if (error instanceof GpxParseError) {
            return error.message;
        }

        if (error instanceof SecurityError) {
            switch (error.type) {
                case 'PERFORMANCE':
                    if (error.message.includes('File size')) {
                        return 'File is too large. Please use a file smaller than 10MB for better performance.';
                    }
                    if (error.message.includes('timed out')) {
                        return 'File processing timed out. Please try a smaller file or check your device performance.';
                    }
                    if (error.message.includes('points')) {
                        return 'File contains too many track points. Please use a simplified track with fewer points.';
                    }
                    return 'File processing failed due to performance constraints. Please try a smaller or simpler file.';

                case 'XXE':
                    return 'File contains security risks and cannot be processed. Please ensure the file is from a trusted source.';

                case 'XSS':
                    return 'File contains potentially unsafe content that has been blocked for security reasons.';

                default:
                    return 'File failed security validation and cannot be processed safely.';
            }
        }

        // Handle common JavaScript errors with helpful messages
        if (error instanceof Error) {
            const message = error.message.toLowerCase();

            if (
                message.includes('network') ||
                message.includes('fetch') ||
                message.includes('connection')
            ) {
                return 'Failed to read the file. Please check your internet connection and try again.';
            }

            if (message.includes('memory') || message.includes('out of memory')) {
                return 'Not enough memory to process this file. Please try a smaller file or close other applications.';
            }

            if (message.includes('timeout')) {
                return 'File processing timed out. Please try again or use a smaller file.';
            }

            if (message.includes('quota') || message.includes('storage')) {
                return 'Not enough storage space available. Please free up some space and try again.';
            }

            if (message.includes('permission') || message.includes('access')) {
                return 'Permission denied. Please check file permissions and try again.';
            }

            // Return the original error message if it's descriptive enough
            if (
                error.message &&
                error.message.length > 10 &&
                !error.message.includes('undefined')
            ) {
                return `File processing failed: ${error.message}`;
            }
        }

        // Final fallback for truly unknown errors
        return 'An unexpected error occurred while processing the file. Please try again with a different file.';
    };

    const handleFileSelect = async (file: File) => {
        setIsLoading(true);
        setError(null);

        try {
            const track = await parseGpxFile(file);
            setGpxTrack(track);
            setNumSegments(1); // Reset to 1 segment when loading a new file
            setBoundaries([]); // Clear any existing boundaries
        } catch (err) {
            const errorMessage = getErrorMessage(err);
            setError(errorMessage);
            // Use environment-aware logging
            if (typeof err === 'object' && err !== null) {
                console.error('GPX parsing error:', err);
            } else {
                console.error('GPX parsing error:', String(err));
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="max-w-4xl w-full space-y-8">
                <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold text-gray-800">GPX Track Splitter</h1>
                    <p className="text-gray-600 max-w-2xl mx-auto">
                        Upload your GPX file to split hiking tracks into segments. Perfect for "out
                        & back" style trails.
                    </p>
                </div>

                <Card>
                    {!gpxTrack ? (
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold text-gray-800">Upload GPX File</h2>
                            <FileUpload onFileSelect={handleFileSelect} className="w-full" />
                            {isLoading && (
                                <div className="text-center text-blue-600">
                                    <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                                    Parsing GPX file...
                                </div>
                            )}
                            {error && <Alert type="error">{error}</Alert>}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-semibold text-gray-800">
                                    Track Loaded: {gpxTrack.name}
                                </h2>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setGpxTrack(null)}
                                    icon={
                                        <svg
                                            className="w-4 h-4"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                            />
                                        </svg>
                                    }
                                >
                                    Upload Different File
                                </Button>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <InfoCard label="Points" value={gpxTrack.points.length} />
                                <InfoCard
                                    label="Latitude Range"
                                    value={`${gpxTrack.bounds.south.toFixed(4)} to ${gpxTrack.bounds.north.toFixed(4)}`}
                                />
                                <InfoCard
                                    label="Longitude Range"
                                    value={`${gpxTrack.bounds.west.toFixed(4)} to ${gpxTrack.bounds.east.toFixed(4)}`}
                                />
                                <InfoCard
                                    label="Elevation Data"
                                    value={
                                        gpxTrack.points.some(p => p.elevation !== undefined)
                                            ? 'Yes'
                                            : 'No'
                                    }
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-semibold text-gray-800">
                                        Track Visualization
                                    </h3>
                                </div>
                                <ErrorBoundary
                                    fallback={error => (
                                        <div className="h-96 w-full border border-red-300 rounded-lg bg-red-50 flex items-center justify-center">
                                            <div className="text-center">
                                                <p className="text-red-600 font-medium">
                                                    Map Error
                                                </p>
                                                <p className="text-red-500 text-sm mt-1">
                                                    Unable to display map: {error.message}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                >
                                    <GpxTrackMap
                                        track={gpxTrack}
                                        hoveredPoint={hoveredPoint}
                                        boundaries={boundaries}
                                    />
                                </ErrorBoundary>
                            </div>

                            <div className="space-y-4">
                                <ErrorBoundary
                                    fallback={error => (
                                        <div className="h-64 w-full border border-red-300 rounded-lg bg-red-50 flex items-center justify-center">
                                            <div className="text-center">
                                                <p className="text-red-600 font-medium">
                                                    Chart Error
                                                </p>
                                                <p className="text-red-500 text-sm mt-1">
                                                    Unable to display chart: {error.message}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                >
                                    <ElevationChart
                                        track={gpxTrack}
                                        onHover={setHoveredPoint}
                                        onSplitPointsChange={setBoundaries}
                                    />
                                </ErrorBoundary>
                            </div>

                            {numSegments > 1 && (
                                <div className="space-y-4">
                                    <h4 className="text-lg font-semibold text-gray-800">
                                        Track Segments
                                    </h4>

                                    <Alert type="success" className="space-y-4">
                                        <div>
                                            <p className="text-green-800 font-medium">
                                                Ready to split! This will create {segments.length}{' '}
                                                track segments.
                                            </p>
                                            <p className="text-green-700 text-sm mt-1">
                                                Download individual segments or all at once.
                                            </p>
                                        </div>

                                        <div className="flex flex-wrap gap-3">
                                            <Button
                                                variant="success"
                                                onClick={() => downloadAllSegments(segments)}
                                                icon={
                                                    <svg
                                                        className="w-4 h-4"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                                        />
                                                    </svg>
                                                }
                                            >
                                                Download All Segments
                                            </Button>

                                            {segments.map((segment, index) => (
                                                <Button
                                                    key={`export-${index}`}
                                                    variant="primary"
                                                    size="sm"
                                                    onClick={() => downloadGpxFile(segment)}
                                                >
                                                    Download {segment.name.split('_').pop()}
                                                </Button>
                                            ))}
                                        </div>
                                    </Alert>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}

export default App;
