export interface GpxTrackPoint {
    lat: number;
    lon: number;
    elevation?: number;
    time?: Date;
}

export interface GpxWaypoint {
    lat: number;
    lon: number;
    elevation?: number;
    name?: string;
    description?: string;
    symbol?: string;
}

export interface GpxTrack {
    name: string;
    points: GpxTrackPoint[];
    bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    };
    waypoints?: GpxWaypoint[];
}

export interface SplitPoint {
    index: number;
    point: GpxTrackPoint;
    label: string; // A, B, C, etc.
}

export interface GpxSegment {
    name: string;
    points: GpxTrackPoint[];
    startIndex: number;
    endIndex: number;
    waypoints?: GpxWaypoint[];
}
