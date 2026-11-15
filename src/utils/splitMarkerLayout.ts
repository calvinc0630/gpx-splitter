export interface ScreenPoint {
    x: number;
    y: number;
}

export interface SplitMarkerGroup {
    target: ScreenPoint;
    indexes: number[];
    anchorIndex: number;
    offset: ScreenPoint | null;
}

export const SPLIT_MARKER_RADIUS = 16;
export const TRACK_LINE_WIDTH = 4;

const SEARCH_DIRECTIONS = 16;
const SEARCH_STEP = 8;

interface Segment {
    start: ScreenPoint;
    end: ScreenPoint;
}

const distanceBetween = (a: ScreenPoint, b: ScreenPoint): number =>
    Math.hypot(a.x - b.x, a.y - b.y);

const distanceToSegment = (point: ScreenPoint, segment: Segment): number => {
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return distanceBetween(point, segment.start);

    const projection = Math.max(
        0,
        Math.min(
            1,
            ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared
        )
    );
    return distanceBetween(point, {
        x: segment.start.x + projection * dx,
        y: segment.start.y + projection * dy,
    });
};

const makeSegments = (points: ScreenPoint[]): Segment[] => {
    if (points.length === 1) return [{ start: points[0], end: points[0] }];
    return points.slice(1).map((end, index) => ({ start: points[index], end }));
};

const preferredAngle = (target: ScreenPoint, segments: Segment[]): number => {
    let nearestDistance = Infinity;
    let nearestAngle = -Math.PI / 2;

    for (const segment of segments) {
        const distance = distanceToSegment(target, segment);
        if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestAngle = Math.atan2(
                segment.end.y - segment.start.y,
                segment.end.x - segment.start.x
            );
        }
    }

    return nearestAngle + Math.PI / 2;
};

export const getNonOverlappingSplitMarkerOffsets = (
    targets: ScreenPoint[],
    path: ScreenPoint[],
    mapSize: ScreenPoint,
    markerRadius = SPLIT_MARKER_RADIUS
): Array<ScreenPoint | null> => {
    if (targets.length === 0) return [];
    if (
        !Number.isFinite(mapSize.x) ||
        !Number.isFinite(mapSize.y) ||
        mapSize.x <= 0 ||
        mapSize.y <= 0
    ) {
        return targets.map(() => null);
    }

    const segments = makeSegments(path);
    const placedCenters: ScreenPoint[] = [];
    const offsets: Array<ScreenPoint | null> = [];
    const maxRadius = Math.hypot(mapSize.x, mapSize.y);
    const trackClearance = markerRadius + TRACK_LINE_WIDTH / 2 + 3;
    const markerClearance = markerRadius * 2 + 4;
    const gridStep = markerClearance;

    for (const target of targets) {
        if (target.x < 0 || target.x > mapSize.x || target.y < 0 || target.y > mapSize.y) {
            offsets.push(null);
            continue;
        }

        const angle = preferredAngle(target, segments);
        let selectedCenter: ScreenPoint | null = null;
        const isClear = (center: ScreenPoint): boolean =>
            center.x >= markerRadius &&
            center.x <= mapSize.x - markerRadius &&
            center.y >= markerRadius &&
            center.y <= mapSize.y - markerRadius &&
            segments.every(segment => distanceToSegment(center, segment) >= trackClearance) &&
            placedCenters.every(
                placedCenter => distanceBetween(placedCenter, center) >= markerClearance
            );

        for (
            let radius = trackClearance;
            radius <= maxRadius && !selectedCenter;
            radius += SEARCH_STEP
        ) {
            for (let direction = 0; direction < SEARCH_DIRECTIONS; direction++) {
                const candidateAngle = angle + (Math.PI * 2 * direction) / SEARCH_DIRECTIONS;
                const candidate = {
                    x: target.x + Math.cos(candidateAngle) * radius,
                    y: target.y + Math.sin(candidateAngle) * radius,
                };
                if (isClear(candidate)) {
                    selectedCenter = candidate;
                    break;
                }
            }
        }

        if (!selectedCenter) {
            let nearestDistance = Infinity;
            for (let y = markerRadius; y <= mapSize.y - markerRadius; y += gridStep) {
                for (let x = markerRadius; x <= mapSize.x - markerRadius; x += gridStep) {
                    const candidate = { x, y };
                    const distance = distanceBetween(target, candidate);
                    if (distance < nearestDistance && isClear(candidate)) {
                        nearestDistance = distance;
                        selectedCenter = candidate;
                    }
                }
            }
        }

        if (!selectedCenter) {
            offsets.push(null);
            continue;
        }

        placedCenters.push(selectedCenter);
        offsets.push({ x: selectedCenter.x - target.x, y: selectedCenter.y - target.y });
    }

    return offsets;
};

export const getSplitMarkerGroups = (
    targets: ScreenPoint[],
    path: ScreenPoint[],
    mapSize: ScreenPoint,
    markerRadius = SPLIT_MARKER_RADIUS
): SplitMarkerGroup[] => {
    let groups: SplitMarkerGroup[] = targets.map((target, index) => ({
        target,
        indexes: [index],
        anchorIndex: index,
        offset: null,
    }));

    while (groups.length > 0) {
        const offsets = getNonOverlappingSplitMarkerOffsets(
            groups.map(group => group.target),
            path,
            mapSize,
            markerRadius
        );
        const unplacedIndexes = offsets.flatMap((offset, index) =>
            offset === null ? [index] : []
        );

        if (unplacedIndexes.length === 0 || groups.length === 1) {
            return groups.map((group, index) => ({ ...group, offset: offsets[index] }));
        }

        const mergeIndexes = new Set(unplacedIndexes);
        if (unplacedIndexes.length === 1) {
            const unplacedIndex = unplacedIndexes[0];
            let nearestIndex = -1;
            let nearestDistance = Infinity;
            groups.forEach((group, index) => {
                if (index === unplacedIndex) return;
                const distance = distanceBetween(groups[unplacedIndex].target, group.target);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestIndex = index;
                }
            });
            if (nearestIndex === -1) {
                return groups.map((group, index) => ({ ...group, offset: offsets[index] }));
            }
            mergeIndexes.add(nearestIndex);
        }

        const mergedIndexes = [...mergeIndexes]
            .flatMap(index => groups[index].indexes)
            .sort((a, b) => a - b);
        const centroid = mergedIndexes.reduce(
            (sum, index) => ({
                x: sum.x + targets[index].x / mergedIndexes.length,
                y: sum.y + targets[index].y / mergedIndexes.length,
            }),
            { x: 0, y: 0 }
        );
        const anchorIndex = mergedIndexes.reduce((nearest, index) =>
            distanceBetween(targets[index], centroid) < distanceBetween(targets[nearest], centroid)
                ? index
                : nearest
        );
        const mergedGroup: SplitMarkerGroup = {
            target: targets[anchorIndex],
            indexes: mergedIndexes,
            anchorIndex,
            offset: null,
        };

        groups = groups
            .filter((_, index) => !mergeIndexes.has(index))
            .concat(mergedGroup)
            .sort((a, b) => a.indexes[0] - b.indexes[0]);
    }

    return [];
};
