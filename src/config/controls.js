export const TOUCH_CONTROL_TUNING = Object.freeze({
  deadZone: 0.12,
  sprintOn: 0.86,
  sprintOff: 0.74,
  lookSensitivity: 0.004,
});

/**
 * Choose the presentation layer for controls without using viewport width or a
 * user-agent guess. Explicit query-string overrides keep QA deterministic.
 */
export function resolveControlMode({
  requested = 'auto',
  maxTouchPoints = 0,
  coarsePointer = false,
} = {}) {
  const normalized = String(requested || 'auto').toLowerCase();
  if (normalized === 'touch' || normalized === 'desktop') return normalized;
  return Number(maxTouchPoints) > 0 && Boolean(coarsePointer) ? 'touch' : 'desktop';
}

/** Keep the premium touch treatment default while retaining a query rollback. */
export function resolveTouchControlStyle({ requested = 'modern' } = {}) {
  return String(requested || 'modern').toLowerCase() === 'classic' ? 'classic' : 'modern';
}

/** Normalize a floating-stick offset while preserving analog distance. */
export function normalizeTouchStick(dx, dy, radius, deadZone = TOUCH_CONTROL_TUNING.deadZone) {
  const safeRadius = Math.max(1, Number(radius) || 1);
  const distance = Math.hypot(dx, dy);
  const rawMagnitude = Math.min(1, distance / safeRadius);
  const clampedDeadZone = Math.min(0.95, Math.max(0, Number(deadZone) || 0));

  if (rawMagnitude <= clampedDeadZone || distance === 0) {
    return { x: 0, z: 0, magnitude: rawMagnitude };
  }

  const magnitude = (rawMagnitude - clampedDeadZone) / (1 - clampedDeadZone);
  return {
    x: (dx / distance) * magnitude,
    z: (dy / distance) * magnitude,
    magnitude: rawMagnitude,
  };
}
