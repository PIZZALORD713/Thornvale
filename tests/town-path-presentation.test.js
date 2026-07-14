import test from 'node:test';
import assert from 'node:assert/strict';

import {
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
} from 'three';
import { TOWN_LAYOUT, TOWN_PATH_PROFILES } from '../src/config/town.js';
import { sampleMoundHeight } from '../src/utils/terrain-surface.js';
import {
  createPathsAndPlaza,
  TOWN_PALETTE,
} from '../src/visuals/CozyTownKit.js';
import { isGrassPlacementAllowed } from '../src/visuals/BreathingGrass.js';
import { generateReclaimedPaverPlacements } from '../src/visuals/ReclaimedPaverPaths.js';

test('soft town routes retain varied walked-meadow profiles instead of one dirt ribbon', () => {
  const profiles = new Set(TOWN_LAYOUT.paths.map(({ profile }) => profile).filter(Boolean));
  assert.ok(
    profiles.size >= 4,
    `expected at least four distinct path profiles; received ${[...profiles].join(', ') || 'none'}`,
  );
  assert.ok(TOWN_LAYOUT.paths.every(({ profile }) => profiles.has(profile)));

  for (const key of ['walkedGrass', 'walkedGrassLight', 'walkedMoss']) {
    const hsl = {};
    new Color(TOWN_PALETTE[key]).getHSL(hsl);
    assert.ok(
      hsl.h >= 0.18 && hsl.h <= 0.45,
      `${key} should remain in Thornvale's green meadow family`,
    );
  }

  const root = createPathsAndPlaza(TOWN_LAYOUT);
  const routeIds = [
    'pond',
    'forest-edge-camp',
    'north-garden-walk',
    'south-orchard-walk',
  ];
  const configuredSoftRouteIds = TOWN_LAYOUT.paths
    .filter(({ profile }) => TOWN_PATH_PROFILES[profile]?.family !== 'reclaimed-pavers')
    .map(({ id }) => id);
  assert.deepEqual(configuredSoftRouteIds, routeIds, 'only the wild route family should stay soft');
  const outer = root.getObjectByName('walked_meadow_outer');
  const inner = root.getObjectByName('walked_meadow_inner');
  const shoulders = root.getObjectByName('walked_meadow_shoulders');
  const stones = root.getObjectByName('walked_meadow_stones');
  for (const [layer, expectedName] of [
    [outer, 'outer'],
    [inner, 'inner'],
    [shoulders, 'shoulders'],
    [stones, 'stones'],
  ]) {
    assert.ok(layer instanceof Mesh, `${expectedName} should be a merged or instanced mesh`);
    assert.equal(layer.userData.pathLayer, expectedName);
    assert.deepEqual(layer.userData.routeIds, routeIds);
  }

  assert.ok(shoulders instanceof InstancedMesh);
  assert.ok(inner instanceof InstancedMesh, 'the center wear should be broken into patches, not a ribbon');
  assert.ok(stones instanceof InstancedMesh);
  assert.ok(inner.count > shoulders.count, 'walked patches should carry the route more than its edge accents');
  assert.ok(shoulders.count > stones.count, 'soft shoulder breakup should outweigh stone accents');
  assert.equal(root.getObjectByName('cozy_path'), undefined);
  assert.equal(root.getObjectByName('cozy_path_edge'), undefined);

  const plaza = root.getObjectByName('cozy_plaza');
  const routeMaterials = new Set([outer.material, inner.material, shoulders.material, stones.material]);
  assert.ok(plaza);
  assert.equal(routeMaterials.has(plaza.material), false, 'the plaza should not reuse a path surface');
});

test('flat path layers have stable depth tiers instead of competing with the meadow', () => {
  const root = createPathsAndPlaza(TOWN_LAYOUT);
  const outer = root.getObjectByName('walked_meadow_outer');
  const inner = root.getObjectByName('walked_meadow_inner');
  const shoulders = root.getObjectByName('walked_meadow_shoulders');
  const matrix = new Matrix4();
  inner.getMatrixAt(0, matrix);
  const innerY = matrix.elements[13];
  shoulders.getMatrixAt(0, matrix);
  const shoulderY = matrix.elements[13];

  assert.ok(outer.position.y >= 0.032, 'the base must clear every large meadow color patch');
  assert.ok(innerY - outer.position.y >= 0.007, 'wear patches need a separate depth tier');
  assert.ok(shoulderY - innerY >= 0.006, 'shoulder dapples need a separate depth tier');
  assert.deepEqual(
    [outer.renderOrder, inner.renderOrder, shoulders.renderOrder],
    [1, 2, 3],
  );
  for (const layer of [outer, inner, shoulders]) {
    assert.equal(layer.material.polygonOffset, true);
    assert.ok(layer.material.polygonOffsetFactor < 0);
    assert.ok(layer.material.polygonOffsetUnits < 0);
  }
});

test('the provisional camp has prop clearances but no rendered dirt pad', () => {
  assert.equal(
    TOWN_LAYOUT.paths.some(({ id }) => id === 'provisional-camp-clearing'),
    false,
    'the broad camp-clearing ribbon must not be rendered as a path',
  );

  const campApproach = TOWN_LAYOUT.paths.find(({ id }) => id === 'forest-edge-camp');
  assert.ok(campApproach);
  assert.ok(campApproach.width <= 1, 'the camp approach should read as a foot trail');
  assert.equal(campApproach.profile, 'forest-footpath');

  const campExclusions = (TOWN_LAYOUT.grassExclusions || [])
    .filter(({ id }) => id.startsWith('day-one-'));
  assert.ok(campExclusions.length >= 5, 'camp props need local grass clearance, not one broad pad');
  assert.ok(
    campExclusions.every(({ radius }) => radius <= 2.5),
    'camp clearances should remain small enough to preserve grass between stations',
  );

  for (const site of ['campfire', 'garden', 'shelter', 'woodlot', 'campRecovery']) {
    const anchor = TOWN_LAYOUT.dayOne[site];
    assert.equal(
      isGrassPlacementAllowed(anchor.x, anchor.z, TOWN_LAYOUT),
      false,
      `${site} should be protected from decorative grass`,
    );
  }
});

test('maintained routes use one batched reclaimed-paver family while wild routes remain soft', () => {
  const root = createPathsAndPlaza(TOWN_LAYOUT);
  const pavers = root.getObjectByName('reclaimed_warm_pavers');
  const placements = generateReclaimedPaverPlacements(TOWN_LAYOUT);
  const repeatedPlacements = generateReclaimedPaverPlacements(TOWN_LAYOUT);
  const maintainedRouteIds = TOWN_LAYOUT.paths
    .filter(({ profile }) => TOWN_PATH_PROFILES[profile]?.family === 'reclaimed-pavers')
    .map(({ id }) => id);
  const maintainedApronIds = (TOWN_LAYOUT.pathAprons || [])
    .filter(({ profile }) => TOWN_PATH_PROFILES[profile]?.family === 'reclaimed-pavers')
    .map(({ id }) => id);
  const expectedRouteIds = [
    'arrival',
    'berry-bakery',
    'lavender-library',
    'mint-tea-house',
    'rose-post-office',
    'bell-hill-ritual',
    'bell-hill-apron',
  ];
  const reclaimedDraws = [];
  root.traverse((object) => {
    if (object instanceof InstancedMesh && object.userData.surfaceFamily === 'reclaimed-pavers') {
      reclaimedDraws.push(object);
    }
  });

  assert.ok(pavers instanceof InstancedMesh, 'warm reclaimed pavers should be one instanced draw');
  assert.equal(reclaimedDraws.length, 1, 'the entire reclaimed family should remain one draw');
  assert.strictEqual(reclaimedDraws[0], pavers);
  assert.equal(pavers.userData.surfaceFamily, 'reclaimed-pavers');
  assert.deepEqual([...maintainedRouteIds, ...maintainedApronIds], expectedRouteIds);
  assert.deepEqual(pavers.userData.routeIds, expectedRouteIds);
  assert.deepEqual(repeatedPlacements, placements, 'the same layout must produce the same paver field');
  assert.equal(pavers.count, placements.length);
  assert.ok(pavers.count >= 100, 'the paver family should visibly carry the maintained routes');
  assert.ok(pavers.count <= 900, `the paver family exceeds its 900-instance budget: ${pavers.count}`);

  const toneCounts = pavers.userData.toneCounts;
  const countedTones = Object.values(toneCounts).reduce((total, count) => total + count, 0);
  assert.equal(countedTones, pavers.count);
  assert.ok(
    toneCounts['warm-brick'] / pavers.count >= 0.65,
    `warm brick should remain the clear bias; received ${toneCounts['warm-brick']}/${pavers.count}`,
  );
  assert.ok(toneCounts['warm-brick'] > toneCounts['deep-clay'] + toneCounts['repair-stone']);
  assert.ok(toneCounts['repair-stone'] > 0, 'reclaimed paving needs visible repair-stone variation');

  pavers.geometry.computeBoundingBox();
  assert.ok(
    pavers.geometry.boundingBox?.max.y > pavers.geometry.boundingBox?.min.y,
    'pavers must have physical thickness instead of competing coplanar decals',
  );
  assert.equal(pavers.geometry.getIndex().count / 3, 20, 'the shared chamfered paver must stay at 20 triangles');
  assert.equal(pavers.material.polygonOffset, false, 'solid pavers must use geometry, not depth bias');
  assert.ok(placements.every(({ thickness }) => thickness > 0.07));

  const hill = TOWN_LAYOUT.terrain.bellHill;
  const ritualHillPlacements = placements
    .filter(({ routeId, x, z }) => (
      routeId.startsWith('bell-hill')
      && sampleMoundHeight(hill, x, z) > 0
    ));
  assert.ok(
    ritualHillPlacements.length >= 20,
    'the ritual route needs enough slope-bound pavers to prove its terrain fit',
  );
  for (const placement of ritualHillPlacements) {
    const sampledSurfaceY = Math.max(0, sampleMoundHeight(hill, placement.x, placement.z));
    const bottomClearance = placement.bottomY - sampledSurfaceY;
    assert.ok(
      bottomClearance >= 0.01 && bottomClearance <= 0.025,
      `${placement.routeId} paver bottom clears the hill by ${bottomClearance.toFixed(4)}m`,
    );
  }
});
