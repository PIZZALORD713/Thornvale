/**
 * Math utilities for game development
 */

/**
 * Clamp a value between min and max
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Frame-rate independent lerp (exponential decay)
 * @param {number} current - Current value
 * @param {number} target - Target value
 * @param {number} sharpness - How fast to approach (higher = faster)
 * @param {number} dt - Delta time in seconds
 */
export function damp(current, target, sharpness, dt) {
  return lerp(current, target, 1 - Math.exp(-sharpness * dt));
}

/**
 * Normalize an angle to [-PI, PI]
 */
export function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/**
 * Interpolate between two angles (shortest path)
 */
export function lerpAngle(a, b, t) {
  let diff = normalizeAngle(b - a);
  return a + diff * t;
}

/**
 * Frame-rate independent angle damping
 */
export function dampAngle(current, target, sharpness, dt) {
  return lerpAngle(current, target, 1 - Math.exp(-sharpness * dt));
}

/**
 * Smooth step (Hermite interpolation)
 */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Degrees to radians
 */
export function degToRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Radians to degrees
 */
export function radToDeg(rad) {
  return rad * (180 / Math.PI);
}

/**
 * Random float in range
 */
export function randFloat(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Random integer in range (inclusive)
 */
export function randInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}
