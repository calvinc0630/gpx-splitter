const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const calculateBearing = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number | null => {
    if (
        !Number.isFinite(lat1) ||
        !Number.isFinite(lon1) ||
        !Number.isFinite(lat2) ||
        !Number.isFinite(lon2) ||
        lat1 < -90 ||
        lat1 > 90 ||
        lat2 < -90 ||
        lat2 > 90 ||
        lon1 < -180 ||
        lon1 >= 180 ||
        lon2 < -180 ||
        lon2 >= 180
    ) {
        return null;
    }

    const startLatitude = toRadians(lat1);
    const endLatitude = toRadians(lat2);
    const deltaLongitude = toRadians(lon2 - lon1);
    const east = Math.sin(deltaLongitude) * Math.cos(endLatitude);
    const north =
        Math.cos(startLatitude) * Math.sin(endLatitude) -
        Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(deltaLongitude);

    if (east === 0 && north === 0) {
        return null;
    }

    return (Math.atan2(east, north) * 180) / Math.PI;
};
