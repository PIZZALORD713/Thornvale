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

export function resolveCurrentRecoveryPoint(snapshot, arrivalPoint, shelterPoint) {
  if (snapshot?.world?.camp?.shelterRepaired === true && shelterPoint) {
    return clonePoint(shelterPoint);
  }
  return clonePoint(arrivalPoint);
}
