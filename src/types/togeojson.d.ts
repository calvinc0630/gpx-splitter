declare module '@mapbox/togeojson' {
    export interface GeoJSONFeature {
        type: 'Feature';
        geometry: {
            type: string;
            coordinates: number[][];
        };
        properties?: {
            name?: string;
            title?: string;
            [key: string]: unknown;
        };
    }

    export interface GeoJSONFeatureCollection {
        type: 'FeatureCollection';
        features: GeoJSONFeature[];
    }

    export function gpx(doc: Document): GeoJSONFeatureCollection;
    export function kml(doc: Document): GeoJSONFeatureCollection;
}
