function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

const HINT_ROUTE_POINTS = [
  [-18, 0, 56],
  [-14, 0, 52.8],
  [-8.2, 0, 50.8],
  [-1.5, 0, 48.2],
  [4.3, 0, 45.3],
  [8.2, 0, 42.2],
  [9.6, 0, 37.2],
  [14.5, 0, 33.4],
  [16.2, 0, 29.2],
  [11.4, 0, 26.6],
  [6.2, 0, 23.5],
  [2.3, 0, 19.1],
  [1.25, 0, 13.8],
  [0.35, 0, 13.55],
  [0, 0, 10.45],
  [0, 0, 7.5],
];

const CROSSROADS_ROUTE_INDEX = 5;
const STEWARD_ROUTE_INDEX = 12;

function sampleFootprints(points, spacing = 0.9) {
  const result = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const dx = end[0] - start[0];
    const dz = end[2] - start[2];
    const length = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.floor(length / spacing));
    for (let step = 0; step < steps; step += 1) {
      const progress = step / steps;
      result.push([
        start[0] + dx * progress,
        start[2] + dz * progress,
      ]);
    }
  }
  const final = points.at(-1);
  result.push([final[0], final[2]]);
  return result;
}

/**
 * The Path Remembers You is a temporary arrival layer around the canonical
 * World Stage. It does not alter the town manifest: fresh players begin on
 * this reviewed corridor, while established saves use the existing gate spawn.
 */
export const ARRIVAL_PROLOGUE_V1 = deepFreeze({
  id: 'the-path-remembers-you-v1',
  treadSignature: 'left-heel-triangle-missing-v1',
  anchors: {
    spawn: { x: -18, y: 2, z: 56 },
    crossroads: { x: 8.2, y: 0, z: 42.2 },
    stewardWelcome: { x: 1.25, y: 0, z: 13.8, facing: Math.PI },
    lantern: { x: 0.35, y: 0.68, z: 13.55 },
    gateInside: { x: 0, y: 0, z: 10.45 },
    gateRecovery: { x: 0, y: 2, z: 14 },
  },
  hintRoute: {
    id: 'arrival-whiteout',
    points: HINT_ROUTE_POINTS,
  },
  snowTracks: {
    approach: HINT_ROUTE_POINTS.slice(0, CROSSROADS_ROUTE_INDEX + 1),
    remembered: HINT_ROUTE_POINTS.slice(CROSSROADS_ROUTE_INDEX, STEWARD_ROUTE_INDEX + 1),
    wrongFork: [
      HINT_ROUTE_POINTS[CROSSROADS_ROUTE_INDEX],
      [2.8, 0, 39.4],
      [-2.4, 0, 40.2],
      [-7.6, 0, 44.1],
      [-11, 0, 49],
    ],
  },
  footprints: {
    fresh: [
      [-22, 59.2],
      [-21.25, 58.55],
      [-20.5, 57.9],
      [-19.75, 57.25],
      [-19, 56.6],
      [-18.25, 56.05],
    ],
    remembered: sampleFootprints(
      HINT_ROUTE_POINTS.slice(CROSSROADS_ROUTE_INDEX, STEWARD_ROUTE_INDEX + 1),
    ),
  },
  environment: {
    snowField: { width: 54, length: 60, center: { x: 0, z: 35 } },
    fog: { near: 2.8, far: 14.5 },
    distanceMarkers: [
      { x: -14.8, z: 52.8, rotation: -0.25 },
      { x: -8.9, z: 50.1, rotation: 0.18 },
      { x: -1.9, z: 47.2, rotation: -0.12 },
      { x: 5.5, z: 44.5, rotation: 0.22 },
      { x: 10.4, z: 36.7, rotation: -0.16 },
      { x: 16.7, z: 29.4, rotation: 0.2 },
      { x: 8.7, z: 24.6, rotation: -0.18 },
    ],
    drifts: [
      { x: -9.6, z: 53.7, scaleX: 2.8, scaleZ: 1.25 },
      { x: 0.8, z: 50.1, scaleX: 3.4, scaleZ: 1.4 },
      { x: -11.2, z: 49.5, scaleX: 4.2, scaleZ: 1.7 },
      { x: 11.4, z: 43.7, scaleX: 3, scaleZ: 1.2 },
      { x: 19.3, z: 35.2, scaleX: 3.3, scaleZ: 1.35 },
      { x: 13.8, z: 25.2, scaleX: 3.7, scaleZ: 1.45 },
    ],
  },
  timing: {
    crossroadsRadius: 2,
    gateCrossingRadius: 1.45,
    hintDistance: 12,
  },
});

export default ARRIVAL_PROLOGUE_V1;
