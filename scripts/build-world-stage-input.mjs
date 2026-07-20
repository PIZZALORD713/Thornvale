import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CatmullRomCurve3, Vector3 } from 'three';

import {
  TOWN_INTERACTION_CONTRACT,
  TOWN_LAYOUT,
  TOWN_PATH_PROFILES,
} from '../src/config/town.js';
import { createMoundSurfaceGrid } from '../src/utils/terrain-surface.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = resolve(ROOT, 'assets-src/pizza-lab/world-stage/thornvale-world-stage-v1.json');
const OUTPUT_PATH = resolve(ROOT, 'output/pizza-lab/world-stage-v1.input.json');
const WAYFINDER_AUTHORING_PATH = resolve(
  ROOT,
  'assets-src/pizza-lab/wayfinder-v1/thornvale-wayfinder-authoring.blend',
);

const COTTAGE_ROOTS = Object.freeze({
  'berry-bakery': 'Cottage_berry_bakery',
  'lavender-library': 'Cottage_lavender_library',
  'mint-tea-house': 'Cottage_mint_tea_house',
  'rose-post-office': 'Cottage_rose_post_office',
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hashJson(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function point3(point) {
  if (point.length >= 3) return new Vector3(point[0], point[1], point[2]);
  return new Vector3(point[0], 0, point[1]);
}

function pathSamples(route) {
  const curve = new CatmullRomCurve3(route.points.map(point3), false, 'centripetal');
  const length = Math.max(0.001, curve.getLength());
  return {
    id: route.id,
    profile: route.profile,
    profileContract: TOWN_PATH_PROFILES[route.profile],
    width: route.width,
    length,
    points: curve
      .getSpacedPoints(Math.max(18, Math.ceil(length / 0.45)))
      .map(({ x, y, z }) => [x, y, z]),
  };
}

function box(id, role, position, size, extra = {}) {
  return { id, role, position, size, ...extra };
}

function buildingColliders(building) {
  const result = [box(
    `collider.building.${building.id}`,
    'physics-collider',
    building.position,
    building.size,
    { authority: `layout.buildings.${building.id}` },
  )];
  if (building.porchCollider) {
    result.push(box(
      `collider.building.${building.id}.porch`,
      'physics-collider',
      {
        x: building.position.x,
        y: building.porchCollider.size.y,
        z: building.position.z + building.porchCollider.offsetZ,
      },
      building.porchCollider.size,
    ));
  }
  (building.detailColliders || []).forEach((detail, index) => {
    result.push(box(
      `collider.building.${building.id}.detail.${index}`,
      'physics-collider',
      {
        x: building.position.x + detail.offsetX,
        y: detail.y,
        z: building.position.z + detail.offsetZ,
      },
      detail.size,
    ));
  });

  const sideX = building.size.x * 0.5 + 1.05;
  const frontEdge = building.frontSign * (building.size.z * 0.5 + 1.35) * 0.45;
  const backZ = -building.frontSign * (building.size.z * 0.5 + 1);
  const sideLength = Math.abs(frontEdge - backZ);
  const sideCenterZ = (frontEdge + backZ) * 0.5;
  result.push(box(
    `collider.building.${building.id}.fence.back`,
    'physics-collider',
    { x: building.position.x, y: 0.45, z: building.position.z + backZ },
    { x: sideX * 2 + 0.12, y: 0.9, z: 0.16 },
  ));
  [-1, 1].forEach((sign) => {
    result.push(box(
      `collider.building.${building.id}.fence.${sign < 0 ? 'left' : 'right'}`,
      'physics-collider',
      {
        x: building.position.x + sign * sideX,
        y: 0.45,
        z: building.position.z + sideCenterZ,
      },
      { x: 0.16, y: 0.9, z: sideLength + 0.12 },
    ));
  });
  return result;
}

function rotatedLocalX(placement, localX) {
  return {
    x: placement.x + Math.cos(placement.rotationY || 0) * localX,
    z: placement.z - Math.sin(placement.rotationY || 0) * localX,
  };
}

function worldColliders() {
  const colliders = TOWN_LAYOUT.buildings.flatMap(buildingColliders);
  const { wayfinder, stoneWell, gardenArch } = TOWN_LAYOUT.authoredProps;
  colliders.push(
    box('collider.prop.wayfinder', 'physics-collider', { x: wayfinder.x, y: 1.05, z: wayfinder.z }, { x: 0.42, y: 2.1, z: 0.42 }),
    box('collider.prop.stone-well', 'physics-collider', { x: stoneWell.x, y: 0.58, z: stoneWell.z }, { x: 2.15, y: 1.16, z: 2.15 }),
  );
  [-1, 1].forEach((sign) => {
    const arch = rotatedLocalX(gardenArch, sign * 1.325);
    colliders.push(box(
      `collider.prop.garden-arch.${sign < 0 ? 'left' : 'right'}`,
      'physics-collider',
      { x: arch.x, y: 1.08, z: arch.z },
      { x: 0.48, y: 2.16, z: 0.48 },
    ));
    colliders.push(box(
      `collider.landmark.welcome-gate.${sign < 0 ? 'left' : 'right'}`,
      'physics-collider',
      { x: TOWN_LAYOUT.gate.x + sign * 2.05, y: 1.45, z: TOWN_LAYOUT.gate.z },
      { x: 0.62, y: 2.9, z: 0.62 },
    ));
  });
  colliders.push(
    box('collider.landmark.ledger', 'physics-collider', { x: TOWN_LAYOUT.landmarks.ledger.x, y: 1.1, z: TOWN_LAYOUT.landmarks.ledger.z }, { x: 2.05, y: 2.2, z: 0.38 }),
    box('collider.landmark.bell', 'physics-collider', { x: TOWN_LAYOUT.landmarks.bell.x, y: TOWN_LAYOUT.landmarks.bell.baseY + 0.22, z: TOWN_LAYOUT.landmarks.bell.z }, { x: 1.65, y: 0.44, z: 1.35 }),
  );
  return colliders;
}

function assetPlacements() {
  const placements = [];
  for (const building of TOWN_LAYOUT.buildings) {
    placements.push({
      id: `thornvale.buildings.${building.id}.visual`,
      source: 'cottages',
      assetRoot: COTTAGE_ROOTS[building.id],
      editable: false,
      publishSet: 'context-v1',
      position: { x: building.position.x, y: 0, z: building.position.z },
      rotationY: building.frontSign < 0 ? Math.PI : 0,
    });
  }
  for (const [id, placement] of Object.entries(TOWN_LAYOUT.authoredProps)) {
    placements.push({
      id: `thornvale.authoredProps.${id}`,
      source: 'village-dressing',
      assetRoot: placement.asset,
      editable: id === 'wayfinder',
      publishSet: id === 'wayfinder' ? 'wayfinder-v1' : 'context-v1',
      position: { x: placement.x, y: placement.y, z: placement.z },
      rotationY: placement.rotationY || 0,
    });
  }
  placements.push(
    {
      id: 'thornvale.gate.visual', source: 'arrival-plaza', assetRoot: 'WelcomeGate',
      editable: false, publishSet: 'context-v1', position: { ...TOWN_LAYOUT.gate }, rotationY: 0,
    },
    {
      id: 'thornvale.landmarks.ledger.visual', source: 'arrival-plaza', assetRoot: 'CommunityLedger',
      editable: false, publishSet: 'context-v1',
      position: { ...TOWN_LAYOUT.landmarks.ledger, y: 0 }, rotationY: 0,
    },
    {
      id: 'thornvale.landmarks.bell.visual', source: 'arrival-plaza', assetRoot: 'TownBell',
      editable: false, publishSet: 'context-v1',
      position: { ...TOWN_LAYOUT.landmarks.bell, y: TOWN_LAYOUT.landmarks.bell.baseY }, rotationY: 0,
    },
  );
  return placements;
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  const runtimeLayoutHash = hashJson(TOWN_LAYOUT);
  if (runtimeLayoutHash !== manifest.layoutSha256) {
    throw new Error(`World Stage layout drift: ${runtimeLayoutHash} != ${manifest.layoutSha256}`);
  }
  for (const source of manifest.sources) {
    const bytes = await readFile(resolve(ROOT, source.path));
    const actual = createHash('sha256').update(bytes).digest('hex');
    if (actual !== source.sha256) throw new Error(`Asset drift for ${source.id}`);
  }
  const wayfinderSource = await readFile(WAYFINDER_AUTHORING_PATH);
  const wayfinderSourceSha256 = createHash('sha256').update(wayfinderSource).digest('hex');

  const hill = createMoundSurfaceGrid(TOWN_LAYOUT.terrain.bellHill);
  const input = {
    schemaVersion: 1,
    id: 'thornvale-world-stage-v1',
    coordinateContract: {
      runtime: 'three-y-up-front-positive-z',
      blender: 'z-up-front-negative-y',
      point: '[x,y,z] -> [x,-z,y]',
      dimensions: '[x,y,z] -> [x,z,y]',
    },
    authority: {
      sourceManifest: 'assets-src/pizza-lab/world-stage/thornvale-world-stage-v1.json',
      layoutSha256: manifest.layoutSha256,
      publishMode: 'candidate-only',
      editablePublishSets: ['wayfinder-v1'],
      gameplayAuthority: 'locked-runtime',
    },
    sources: manifest.sources,
    authoringAssets: {
      wayfinder: {
        path: 'assets-src/pizza-lab/wayfinder-v1/thornvale-wayfinder-authoring.blend',
        sha256: wayfinderSourceSha256,
        root: 'VillageWayfinder',
        requiredComponents: [
          'Wayfinder_BoardAssembly_01',
          'Wayfinder_BoardAssembly_02',
          'Wayfinder_BoardAssembly_03',
          'Wayfinder_Board_01',
          'Wayfinder_Board_02',
          'Wayfinder_Board_03',
          'Wayfinder_Post',
        ],
      },
    },
    assets: assetPlacements(),
    terrain: {
      meadow: { id: 'terrain.meadow', radius: TOWN_LAYOUT.meadowRadius, y: 0 },
      physicsBounds: {
        id: 'contract.physics-ground-bounds',
        halfExtent: TOWN_LAYOUT.physicsGroundHalfExtent,
      },
      bellHill: {
        id: 'terrain.bell-hill',
        contract: TOWN_LAYOUT.terrain.bellHill,
        vertices: Array.from(hill.vertices),
        indices: Array.from(hill.indices),
      },
      decorativeHills: TOWN_LAYOUT.terrain.decorativeHills.map((hillSpec, index) => ({
        id: `terrain.decorative-hill.${index}`,
        ...hillSpec,
      })),
      plaza: { id: 'terrain.plaza', ...TOWN_LAYOUT.plaza },
      pond: { id: 'terrain.pond', ...TOWN_LAYOUT.pond },
    },
    paths: TOWN_LAYOUT.paths.map(pathSamples),
    pathAprons: TOWN_LAYOUT.pathAprons,
    colliders: worldColliders(),
    interactions: [
      { id: 'interaction.ledger', ...TOWN_LAYOUT.landmarks.ledger, radius: TOWN_INTERACTION_CONTRACT.ledger.radius },
      { id: 'interaction.bell', ...TOWN_LAYOUT.landmarks.bell, radius: TOWN_INTERACTION_CONTRACT.bell.radius },
      ...Object.entries(TOWN_LAYOUT.dayOne).map(([id, position]) => ({
        id: `interaction.day-one.${id}`,
        ...position,
        radius: 0.7,
        role: 'day-one-anchor',
      })),
    ],
    guides: {
      spawn: { id: 'guide.spawn', ...TOWN_LAYOUT.spawn },
      storyRoutes: Object.entries(TOWN_LAYOUT.storyRoutes).map(([id, points]) => ({
        id: `guide.story-route.${id}`,
        points,
      })),
      grassExclusions: TOWN_LAYOUT.grassExclusions,
      bellPrecinct: TOWN_LAYOUT.terrain.bellPrecinct,
    },
    counts: {
      assets: assetPlacements().length,
      paths: TOWN_LAYOUT.paths.length,
      colliders: worldColliders().length,
      interactions: Object.keys(TOWN_LAYOUT.dayOne).length + 2,
    },
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(stable(input), null, 2)}\n`);
  process.stdout.write(`PIZZA_LAB_WORLD_INPUT=${OUTPUT_PATH}\n`);
  process.stdout.write(`PIZZA_LAB_WORLD_LAYOUT_SHA256=${manifest.layoutSha256}\n`);
}

await main();
