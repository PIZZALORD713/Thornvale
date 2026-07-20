import { DAY_ONE_V01 } from '../content/day-one-v01.js';
import PIZZA_LAB_TOWN_STAGE_V1 from '../content/generated/pizza-lab-town-stage-v1.json' with { type: 'json' };
import { sampleMoundHeight } from '../utils/terrain-surface.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function doorApproach(building, clearance = 0.9) {
  return {
    x: building.position.x,
    y: 0.08,
    z: building.position.z
      + building.frontSign * (building.size.z * 0.5 + clearance),
  };
}

const buildings = [
  {
    id: 'berry-bakery',
    label: 'Berry Bakery',
    position: { x: 14, y: 1.6, z: -11 },
    size: { x: 6, y: 3.2, z: 4.5 },
    frontSign: 1,
    wallMaterial: 'cream',
    roofMaterial: 'blush',
    doorMaterial: 'mint',
    porchCollider: { offsetZ: 2.63, size: { x: 1.8, y: 0.2, z: 0.75 } },
  },
  {
    id: 'lavender-library',
    label: 'Lavender Library',
    position: { x: -15, y: 2, z: -9 },
    size: { x: 5, y: 4, z: 6 },
    frontSign: 1,
    wallMaterial: 'vanilla',
    roofMaterial: 'lavender',
    doorMaterial: 'teal',
    porchCollider: { offsetZ: 3.38, size: { x: 1.8, y: 0.2, z: 0.75 } },
  },
  {
    id: 'mint-tea-house',
    label: 'Mint Tea House',
    position: { x: 14, y: 1.4, z: 12 },
    size: { x: 4, y: 2.8, z: 4 },
    frontSign: -1,
    wallMaterial: 'mint',
    roofMaterial: 'coral',
    doorMaterial: 'lavender',
    porchCollider: { offsetZ: -2.75, size: { x: 5.5, y: 0.22, z: 1.45 } },
    detailColliders: [
      { offsetX: -2.18, offsetZ: -3.33, y: 1.35, size: { x: 0.3, y: 2.5, z: 0.3 } },
      { offsetX: 2.18, offsetZ: -3.33, y: 1.35, size: { x: 0.3, y: 2.5, z: 0.3 } },
      { offsetX: -2.52, offsetZ: 0, y: 1.24, size: { x: 0.22, y: 2.3, z: 1.9 } },
    ],
  },
  {
    id: 'rose-post-office',
    label: 'Rose Post Office',
    position: { x: -14.5, y: 1.8, z: 13 },
    size: { x: 6, y: 3.6, z: 5 },
    frontSign: -1,
    wallMaterial: 'blush',
    roofMaterial: 'periwinkle',
    doorMaterial: 'cocoa',
    porchCollider: { offsetZ: -3.08, size: { x: 5.5, y: 0.22, z: 1.35 } },
    detailColliders: [
      { offsetX: -2.32, offsetZ: -3.58, y: 1.39, size: { x: 0.32, y: 2.5, z: 0.32 } },
      { offsetX: 2.32, offsetZ: -3.58, y: 1.39, size: { x: 0.32, y: 2.5, z: 0.32 } },
      { offsetX: -1.62, offsetZ: -3.6, y: 0.42, size: { x: 1.8, y: 0.84, z: 0.62 } },
    ],
  },
];

const buildingById = Object.fromEntries(buildings.map((building) => [building.id, building]));
const bakeryDoor = doorApproach(buildingById['berry-bakery']);
const libraryDoor = doorApproach(buildingById['lavender-library']);
const teaHouseDoor = doorApproach(buildingById['mint-tea-house']);
const postOfficeDoor = doorApproach(buildingById['rose-post-office']);

export const TOWN_PATH_PROFILES = deepFreeze({
  'village-lane': {
    family: 'reclaimed-pavers',
    grassMargin: 0.2,
    paverWidth: 0.44,
    paverLength: 0.68,
    paverJoint: 0.055,
    edgeOmission: 0.11,
  },
  'garden-lane': {
    family: 'reclaimed-pavers',
    grassMargin: 0.18,
    paverWidth: 0.42,
    paverLength: 0.64,
    paverJoint: 0.055,
    edgeOmission: 0.15,
  },
  'ritual-lane': {
    family: 'reclaimed-pavers',
    grassMargin: 0.22,
    paverWidth: 0.44,
    paverLength: 0.68,
    paverJoint: 0.05,
    edgeOmission: 0.08,
  },
  'waterside-steps': {
    family: 'soft-track',
    grassMargin: 0.28,
  },
  'forest-footpath': {
    family: 'soft-track',
    grassMargin: 0.3,
  },
  'meadow-track': {
    family: 'soft-track',
    grassMargin: 0.32,
  },
});

const bellHill = {
  id: 'bell-hill',
  x: 3,
  z: -37,
  baseY: -0.03,
  radiusX: 14.5,
  radiusZ: 18,
  height: 2.43,
  plateauRadius: 0.2,
  segmentsX: 40,
  segmentsZ: 48,
  walkable: true,
};
const bellBaseY = sampleMoundHeight(bellHill, 3, -36.5);
const bellLandmark = {
  x: 3,
  y: bellBaseY + 0.5,
  z: -36.5,
  baseY: bellBaseY,
};
const hillRoutePoint = (x, z) => [x, Math.max(0, sampleMoundHeight(bellHill, x, z)), z];
const bellPrecinct = {
  id: 'bell-precinct',
  witnessStones: [
    { x: -5.2, z: -42.4, scale: 0.92 },
    { x: -1.2, z: -45.0, scale: 0.82 },
    { x: 3.0, z: -46.0, scale: 0.96 },
    { x: 7.2, z: -45.0, scale: 0.82 },
    { x: 11.2, z: -42.4, scale: 0.92 },
  ],
  lanterns: [
    { x: -2.4, z: -34.0, rotation: 0.18 },
    { x: 8.4, z: -34.0, rotation: -0.18 },
  ],
  groveTrees: [
    { x: -22, z: -43, scale: 1.18 },
    { x: -18, z: -51, scale: 1.34 },
    { x: -12, z: -57, scale: 1.52 },
    { x: -6, z: -60, scale: 1.24 },
    { x: 12, z: -60, scale: 1.24 },
    { x: 18, z: -57, scale: 1.52 },
    { x: 24, z: -51, scale: 1.34 },
    { x: 28, z: -43, scale: 1.18 },
  ],
  flowerDrifts: [
    { x: -7.5, z: -39.5, radius: 2.4, count: 14 },
    { x: 13.5, z: -39.5, radius: 2.4, count: 14 },
    { x: -9.0, z: -50.5, radius: 3.0, count: 16 },
    { x: 15.0, z: -50.5, radius: 3.0, count: 16 },
  ],
};

export const TOWN_LAYOUT = deepFreeze({
  // The Bell is a destination inside Thornvale, not the terminal edge of it.
  // Keep decorative density bounded separately while giving the rear precinct
  // real walkable land and enough collision margin for the follow camera.
  meadowRadius: 64,
  physicsGroundHalfExtent: 72,
  natureRadius: 38,
  spawn: { x: 0, y: 2, z: 14 },
  plaza: { x: 0, y: 0.8, z: 0.8, radius: 5.05, scaleZ: 0.88 },
  gate: { x: 0, y: 0, z: 11.7 },
  pond: { x: 20, y: 0, z: 4 },
  terrain: {
    bellHill,
    bellPrecinct,
    decorativeHills: [
      { x: -35, y: -2.8, z: -15, scaleX: 10, scaleY: 4.2, scaleZ: 8 },
      { x: 35, y: -2.8, z: -12, scaleX: 11, scaleY: 4.6, scaleZ: 9 },
      { x: -32, y: -2.8, z: 26, scaleX: 10, scaleY: 4.1, scaleZ: 8 },
      { x: 33, y: -2.8, z: 27, scaleX: 12, scaleY: 5, scaleZ: 9 },
      { x: -34, y: -3.4, z: -63, scaleX: 17, scaleY: 5.8, scaleZ: 11 },
      { x: 3, y: -4.2, z: -71, scaleX: 24, scaleY: 7.2, scaleZ: 12 },
      { x: 40, y: -3.4, z: -63, scaleX: 17, scaleY: 5.8, scaleZ: 11 },
    ],
  },
  // Day One authored anchors are shared by presentation and the authoritative
  // director so a visible station can never drift away from its interaction.
  dayOne: DAY_ONE_V01.anchors,
  // These small masks protect individual props from decorative grass without
  // drawing a campsite floor. They intentionally leave meadow between the
  // stations so the provisional plot feels borrowed from the forest edge.
  grassExclusions: [
    {
      id: 'day-one-camp-sign',
      site: 'camp',
      x: DAY_ONE_V01.anchors.camp.x + 0.7,
      z: DAY_ONE_V01.anchors.camp.z - 1.22,
      radius: 0.9,
    },
    {
      id: 'day-one-campfire',
      site: 'campfire',
      x: DAY_ONE_V01.anchors.campfire.x,
      z: DAY_ONE_V01.anchors.campfire.z,
      radius: 1.35,
    },
    {
      id: 'day-one-garden',
      site: 'garden',
      x: DAY_ONE_V01.anchors.garden.x,
      z: DAY_ONE_V01.anchors.garden.z,
      radius: 1.8,
    },
    {
      id: 'day-one-shelter',
      site: 'shelter',
      x: DAY_ONE_V01.anchors.shelter.x,
      z: DAY_ONE_V01.anchors.shelter.z,
      radius: 2.35,
    },
    {
      id: 'day-one-woodlot',
      site: 'woodlot',
      x: DAY_ONE_V01.anchors.woodlot.x,
      z: DAY_ONE_V01.anchors.woodlot.z,
      radius: 1.65,
    },
    {
      id: 'day-one-recovery',
      site: 'campRecovery',
      x: DAY_ONE_V01.anchors.campRecovery.x,
      z: DAY_ONE_V01.anchors.campRecovery.z,
      radius: 0.85,
    },
  ],
  landmarks: {
    ledger: { x: -2, y: 0.8, z: 3 },
    bell: bellLandmark,
  },
  buildings,
  paths: [
    {
      id: 'arrival',
      profile: 'village-lane',
      width: 2.25,
      points: [[0, 16], [0.4, 12], [-0.7, 7.5], [0, 2.2]],
    },
    {
      id: 'berry-bakery',
      profile: 'garden-lane',
      width: 1.6,
      points: [[0.5, 0.5], [3.8, -1.8], [8.6, -4.8], [bakeryDoor.x, bakeryDoor.z]],
    },
    {
      id: 'lavender-library',
      profile: 'garden-lane',
      width: 1.6,
      points: [[-0.6, 0.7], [-4.2, -0.6], [-9.2, -2.8], [libraryDoor.x, libraryDoor.z]],
    },
    {
      id: 'mint-tea-house',
      profile: 'garden-lane',
      width: 1.55,
      points: [[0.2, 1.8], [3.3, 4.3], [8.2, 6.9], [teaHouseDoor.x, teaHouseDoor.z]],
    },
    {
      id: 'rose-post-office',
      profile: 'garden-lane',
      width: 1.55,
      points: [[-0.5, 2.1], [-3.5, 5.2], [-8.6, 7.8], [postOfficeDoor.x, postOfficeDoor.z]],
    },
    {
      id: 'pond',
      profile: 'waterside-steps',
      width: 1.1,
      points: [[4, 1.2], [8.5, 0.9], [13, 2.2], [16.4, 4]],
    },
    {
      id: 'forest-edge-camp',
      profile: 'forest-footpath',
      width: 1,
      points: [
        [postOfficeDoor.x, postOfficeDoor.z],
        [-18, 8.7],
        [-19.8, 6],
        [-22.8, 3.7],
        [-25.8, 3.6],
        [-28, 4],
        [-29.3, 3.8],
      ],
    },
    {
      id: 'bell-hill-ritual',
      profile: 'ritual-lane',
      width: 2,
      points: [
        hillRoutePoint(0.9, -3.7),
        hillRoutePoint(3.2, -7.3),
        hillRoutePoint(4.1, -13),
        hillRoutePoint(2.8, -20),
        hillRoutePoint(2.7, -24.8),
        hillRoutePoint(2.9, -27.8),
        hillRoutePoint(3, -30.6),
        hillRoutePoint(3, -33.4),
        hillRoutePoint(bellLandmark.x, bellLandmark.z),
      ],
    },
    {
      id: 'bell-kept-meadow',
      profile: 'meadow-track',
      width: 0.9,
      points: [
        hillRoutePoint(3, -38.2),
        hillRoutePoint(3.4, -41.4),
        hillRoutePoint(2.8, -44.7),
        hillRoutePoint(3.2, -48.2),
        [3.6, 0, -52.0],
      ],
    },
    {
      id: 'north-garden-walk',
      profile: 'meadow-track',
      width: 1.15,
      points: [
        [postOfficeDoor.x, postOfficeDoor.z],
        [-8, 12.6],
        [0, 15.4],
        [8, 12.5],
        [teaHouseDoor.x, teaHouseDoor.z],
      ],
    },
    {
      id: 'south-orchard-walk',
      profile: 'meadow-track',
      width: 1.15,
      points: [
        [libraryDoor.x, libraryDoor.z],
        [-8.5, -11.5],
        [0, -14.6],
        [8.3, -12.2],
        [bakeryDoor.x, bakeryDoor.z],
      ],
    },
  ],
  pathAprons: [
    {
      id: 'bell-hill-apron',
      profile: 'ritual-lane',
      x: bellLandmark.x,
      y: bellLandmark.baseY,
      z: bellLandmark.z,
      width: 4.2,
      depth: 3.1,
      rotationY: 0,
    },
  ],
  storyRoutes: {
    comply: [
      [0.4, 0.16, 3],
      [4, 0.16, 4.4],
      [8.2, 0.16, 6.6],
      [11, 0.16, 8.1],
      [teaHouseDoor.x, 0.42, teaHouseDoor.z],
    ],
    alter: [
      [0.4, 0.16, 3],
      [-3.8, 0.16, 4.3],
      [-8.2, 0.16, 4.8],
      [-12.2, 0.16, 6.2],
      [-17.5, 0.16, 5.2],
      [-21.6, 0.16, 4.4],
      [-25.8, 0.16, 3.6],
    ],
  },
  authoredProps: {
    wayfinder: PIZZA_LAB_TOWN_STAGE_V1.placements.wayfinder,
    gardenArch: { asset: 'GardenArch', x: 9.4, y: 0, z: 7.35, rotationY: 1.2 },
    stoneWell: { asset: 'StoneWell', x: -8.4, y: 0, z: 2.4, rotationY: 0.18 },
  },
});

// Presentation variants must not change these story-facing interaction keys.
export const TOWN_INTERACTION_CONTRACT = deepFreeze({
  ledger: { id: 'ledger', radius: 2 },
  bell: { id: 'bell', radius: 2 },
});

export function getBuildingLayout(id) {
  return TOWN_LAYOUT.buildings.find((building) => building.id === id) || null;
}

export function getBuildingDoorApproach(buildingOrId, clearance = 0.9) {
  const building = typeof buildingOrId === 'string'
    ? getBuildingLayout(buildingOrId)
    : buildingOrId;
  return building ? doorApproach(building, clearance) : null;
}

export function getBuildingBounds(buildingOrId, margin = 0) {
  const building = typeof buildingOrId === 'string'
    ? getBuildingLayout(buildingOrId)
    : buildingOrId;
  if (!building) return null;
  return {
    minX: building.position.x - building.size.x * 0.5 - margin,
    maxX: building.position.x + building.size.x * 0.5 + margin,
    minZ: building.position.z - building.size.z * 0.5 - margin,
    maxZ: building.position.z + building.size.z * 0.5 + margin,
  };
}
