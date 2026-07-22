import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  LEGACY_TOWN_LAYOUT,
  TOWN_LAYOUT,
} from '../src/config/town.js';
import { DAY_ONE_V01 } from '../src/content/day-one-v01.js';
import { resolveCurrentRecoveryPoint } from '../src/game/PlayerRecovery.js';

const SOURCE_MANIFEST_URL = new URL(
  '../assets-src/pizza-lab/world-stage/thornvale-world-stage-v1.json',
  import.meta.url,
);
const RUNTIME_MANIFEST_URL = new URL(
  '../src/content/generated/thornvale-world-stage-v1.json',
  import.meta.url,
);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertFiniteNumbers(value, path = 'layout') {
  if (typeof value === 'number') {
    assert.ok(Number.isFinite(value), `${path} must be finite`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertFiniteNumbers(child, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      assertFiniteNumbers(child, `${path}.${key}`);
    }
  }
}

test('World Stage source and runtime manifests are byte-for-byte equivalent', async () => {
  const [sourceBytes, runtimeBytes] = await Promise.all([
    readFile(SOURCE_MANIFEST_URL),
    readFile(RUNTIME_MANIFEST_URL),
  ]);

  assert.deepEqual(runtimeBytes, sourceBytes);
  assert.deepEqual(JSON.parse(runtimeBytes), JSON.parse(sourceBytes));
});

test('World Stage v1 is an untouched observational equivalent of the legacy town layout', () => {
  assert.deepEqual(TOWN_LAYOUT, LEGACY_TOWN_LAYOUT);
});

test('World Stage source hashes and layout hash cover the checked-in inputs', async () => {
  const manifest = JSON.parse(await readFile(SOURCE_MANIFEST_URL, 'utf8'));

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.id, 'thornvale-world-stage-v1');
  assert.equal(manifest.coordinateSpace, 'three-y-up');
  assert.equal(manifest.blenderSpace, 'z-up-negative-y-front');
  assert.equal(
    manifest.layoutSha256,
    sha256(JSON.stringify(manifest.layout)),
    'the declared layout hash must cover the exact canonical layout snapshot',
  );

  assert.deepEqual(
    manifest.sources.map(({ id }) => id),
    ['cottages', 'village-dressing', 'arrival-plaza'],
  );
  for (const source of manifest.sources) {
    const bytes = await readFile(new URL(`../${source.path}`, import.meta.url));
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.equal(sha256(bytes), source.sha256, `${source.id} hash must match ${source.path}`);
  }
});

test('World Stage v1 retains the complete static town composition contract', () => {
  assert.deepEqual(Object.keys(TOWN_LAYOUT).sort(), [
    'authoredProps',
    'buildings',
    'dayOne',
    'gate',
    'grassExclusions',
    'landmarks',
    'meadowRadius',
    'natureRadius',
    'pathAprons',
    'paths',
    'physicsGroundHalfExtent',
    'plaza',
    'pond',
    'spawn',
    'storyRoutes',
    'terrain',
  ]);
  assert.deepEqual(
    TOWN_LAYOUT.buildings.map(({ id }) => id),
    ['berry-bakery', 'lavender-library', 'mint-tea-house', 'rose-post-office'],
  );
  assert.deepEqual(
    TOWN_LAYOUT.paths.map(({ id }) => id),
    [
      'arrival',
      'berry-bakery',
      'lavender-library',
      'mint-tea-house',
      'rose-post-office',
      'pond',
      'forest-edge-camp',
      'bell-hill-ritual',
      'bell-kept-meadow',
      'north-garden-walk',
      'south-orchard-walk',
    ],
  );
  assert.deepEqual(Object.keys(TOWN_LAYOUT.authoredProps).sort(), [
    'gardenArch',
    'stoneWell',
    'wayfinder',
  ]);
  assert.deepEqual(Object.keys(TOWN_LAYOUT.landmarks).sort(), ['bell', 'ledger']);
  assert.deepEqual(Object.keys(TOWN_LAYOUT.storyRoutes).sort(), ['alter', 'comply']);
  assert.deepEqual(Object.keys(TOWN_LAYOUT.terrain).sort(), [
    'bellHill',
    'bellPrecinct',
    'decorativeHills',
  ]);
  assert.equal(TOWN_LAYOUT.terrain.bellHill.walkable, true);
  assert.ok(TOWN_LAYOUT.terrain.decorativeHills.length > 0);
  assert.ok(TOWN_LAYOUT.pathAprons.some(({ id }) => id === 'bell-hill-apron'));
  assertFiniteNumbers(TOWN_LAYOUT);
});

test('World Stage keeps Day One stations, approaches, and recovery behavior on their authored anchors', () => {
  assert.strictEqual(TOWN_LAYOUT.dayOne, DAY_ONE_V01.anchors);

  const campApproach = TOWN_LAYOUT.paths.find(({ id }) => id === 'forest-edge-camp');
  const pondApproach = TOWN_LAYOUT.paths.find(({ id }) => id === 'pond');
  assert.deepEqual(campApproach.points.at(-1), [
    DAY_ONE_V01.anchors.campRecovery.x,
    DAY_ONE_V01.anchors.campRecovery.z,
  ]);
  assert.deepEqual(pondApproach.points.at(-1), [
    DAY_ONE_V01.anchors.fishingSpot.x,
    DAY_ONE_V01.anchors.fishingSpot.z,
  ]);
  assert.deepEqual(
    TOWN_LAYOUT.grassExclusions.map(({ site }) => site).sort(),
    ['camp', 'campRecovery', 'campfire', 'garden', 'shelter', 'woodlot'],
  );

  assert.deepEqual(
    resolveCurrentRecoveryPoint(
      { world: { camp: { shelterRepaired: false } } },
      TOWN_LAYOUT.spawn,
      TOWN_LAYOUT.dayOne.campRecovery,
    ),
    TOWN_LAYOUT.spawn,
  );
  assert.deepEqual(
    resolveCurrentRecoveryPoint(
      { world: { camp: { shelterRepaired: true } } },
      TOWN_LAYOUT.spawn,
      TOWN_LAYOUT.dayOne.campRecovery,
    ),
    DAY_ONE_V01.anchors.campRecovery,
  );
});
