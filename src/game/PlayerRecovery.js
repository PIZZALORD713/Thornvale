export const PLAYER_FALL_RECOVERY_Y = -12;

export function hasPlayerFallenOutOfWorld(
  position,
  minimumY = PLAYER_FALL_RECOVERY_Y,
) {
  const y = Number(position?.y);
  return !Number.isFinite(y) || y < minimumY;
}

function clonePoint(point) {
  if (!point) return null;
  return {
    x: Number(point.x) || 0,
    y: Number(point.y) || 0,
    z: Number(point.z) || 0,
  };
}

function readHorizontalPoint(point) {
  if (Array.isArray(point)) {
    const x = Number(point[0]);
    const z = Number(point.length >= 3 ? point[2] : point[1]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    return { x, z };
  }

  const x = Number(point?.x);
  const z = Number(point?.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  return { x, z };
}

function distanceToSegment(point, start, end) {
  const segmentX = end.x - start.x;
  const segmentZ = end.z - start.z;
  const lengthSquared = segmentX * segmentX + segmentZ * segmentZ;
  if (lengthSquared <= Number.EPSILON) {
    return Math.hypot(point.x - start.x, point.z - start.z);
  }
  const projection = Math.max(0, Math.min(1,
    ((point.x - start.x) * segmentX + (point.z - start.z) * segmentZ)
      / lengthSquared));
  return Math.hypot(
    point.x - (start.x + segmentX * projection),
    point.z - (start.z + segmentZ * projection),
  );
}

/**
 * Measures horizontal distance to the nearest authored arrival segment.
 * Routes may use the config's [x, y, z] points or plain { x, z } points.
 */
export function distanceToReviewedCorridor(position, reviewedRoutes) {
  const point = readHorizontalPoint(position);
  if (!point) return Infinity;

  let nearest = Infinity;
  for (const route of (Array.isArray(reviewedRoutes) ? reviewedRoutes : [])) {
    const points = route.map(readHorizontalPoint).filter(Boolean);
    if (points.length === 1) {
      nearest = Math.min(nearest, Math.hypot(
        point.x - points[0].x,
        point.z - points[0].z,
      ));
      continue;
    }
    for (let index = 0; index < points.length - 1; index += 1) {
      nearest = Math.min(
        nearest,
        distanceToSegment(point, points[index], points[index + 1]),
      );
    }
  }
  return nearest;
}

export function isWithinReviewedCorridor(
  position,
  reviewedRoutes,
  leash = 10,
) {
  const safeLeash = Number(leash);
  if (!Number.isFinite(safeLeash) || safeLeash < 0) return false;
  const distance = distanceToReviewedCorridor(position, reviewedRoutes);
  return Number.isFinite(distance) && distance <= safeLeash;
}

/**
 * Pure fold gate. Stateful cooldown/re-entry bookkeeping remains with the
 * composition layer, while this helper cannot mutate authoritative state.
 */
export function isArrivalFoldEligible({
  position,
  reviewedRoutes,
  leash = 10,
  arrivalComplete = false,
  cooldownRemainingMs = 0,
  requiresCorridorReentry = false,
} = {}) {
  if (
    arrivalComplete
    || requiresCorridorReentry
    || Number(cooldownRemainingMs) > 0
  ) return false;

  const safeLeash = Number(leash);
  if (!Number.isFinite(safeLeash) || safeLeash < 0) return false;
  const distance = distanceToReviewedCorridor(position, reviewedRoutes);
  return Number.isFinite(distance) && distance > safeLeash;
}

export function resolveCurrentRecoveryPoint(snapshot, arrivalPoint, shelterPoint) {
  if (snapshot?.world?.camp?.shelterRepaired === true && shelterPoint) {
    return clonePoint(shelterPoint);
  }
  return clonePoint(arrivalPoint);
}
