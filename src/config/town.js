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

export const TOWN_LAYOUT = deepFreeze({
  meadowRadius: 38,
  spawn: { x: 0, y: 2, z: 14 },
  plaza: { x: 0, y: 0.8, z: 0.8, radius: 5.05 },
  gate: { x: 0, y: 0, z: 11.7 },
  pond: { x: 20, y: 0, z: 4 },
  landmarks: {
    ledger: { x: -2, y: 0.8, z: 3 },
    bell: { x: 3, y: 0.5, z: -2 },
  },
  buildings,
  paths: [
    {
      id: 'arrival',
      width: 2.35,
      points: [[0, 16], [0.4, 12], [-0.7, 7.5], [0, 2.2]],
    },
    {
      id: 'berry-bakery',
      width: 1.8,
      points: [[0.5, 0.5], [3.8, -1.8], [8.6, -4.8], [bakeryDoor.x, bakeryDoor.z]],
    },
    {
      id: 'lavender-library',
      width: 1.8,
      points: [[-0.6, 0.7], [-4.2, -0.6], [-9.2, -2.8], [libraryDoor.x, libraryDoor.z]],
    },
    {
      id: 'mint-tea-house',
      width: 1.7,
      points: [[0.2, 1.8], [3.3, 4.3], [8.2, 6.9], [teaHouseDoor.x, teaHouseDoor.z]],
    },
    {
      id: 'rose-post-office',
      width: 1.7,
      points: [[-0.5, 2.1], [-3.5, 5.2], [-8.6, 7.8], [postOfficeDoor.x, postOfficeDoor.z]],
    },
    {
      id: 'pond',
      width: 1.35,
      points: [[4, 1.2], [8.5, 0.9], [13, 2.2], [16.4, 4]],
    },
    {
      id: 'north-garden-walk',
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
      [-21, 0.16, 7.2],
    ],
  },
  authoredProps: {
    wayfinder: { asset: 'VillageWayfinder', x: 0, y: 0, z: -6.4, rotationY: 0 },
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
