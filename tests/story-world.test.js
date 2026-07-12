import test from 'node:test';
import assert from 'node:assert/strict';

import { Matrix4, Scene, Vector3 } from 'three';
import {
  getBuildingBounds,
  getBuildingDoorApproach,
  TOWN_LAYOUT,
} from '../src/config/town.js';
import { STORY_ROUTES, StoryWorld } from '../src/visuals/StoryWorld.js';

function expandBounds(bounds, amount) {
  return {
    minX: bounds.minX - amount,
    maxX: bounds.maxX + amount,
    minZ: bounds.minZ - amount,
    maxZ: bounds.maxZ + amount,
  };
}

function segmentIntersectsBounds(start, end, bounds) {
  let tMin = 0;
  let tMax = 1;

  for (const axis of ['x', 'z']) {
    const min = bounds[`min${axis.toUpperCase()}`];
    const max = bounds[`max${axis.toUpperCase()}`];
    const delta = end[axis] - start[axis];

    if (Math.abs(delta) < 1e-9) {
      if (start[axis] < min || start[axis] > max) return false;
      continue;
    }

    const entry = (min - start[axis]) / delta;
    const exit = (max - start[axis]) / delta;
    tMin = Math.max(tMin, Math.min(entry, exit));
    tMax = Math.min(tMax, Math.max(entry, exit));
    if (tMin > tMax) return false;
  }

  return true;
}

test('story trails keep player clearance from every cottage collider', () => {
  // CharacterMotor uses a 0.35 m capsule radius; the remaining 0.45 m keeps
  // the glowing markers visibly separated from cottage walls and rooflines.
  for (const [routeId, points] of Object.entries(STORY_ROUTES)) {
    for (const building of TOWN_LAYOUT.buildings) {
      const clearanceBounds = expandBounds(getBuildingBounds(building), 0.8);
      for (let index = 0; index < points.length - 1; index += 1) {
        assert.equal(
          segmentIntersectsBounds(points[index], points[index + 1], clearanceBounds),
          false,
          `${routeId} segment ${index} enters ${building.id} clearance bounds`,
        );
      }
    }
  }
});

test('story-route markers remain a readable continuous trail around the detour', () => {
  const scene = new Scene();
  const storyWorld = new StoryWorld(scene, { reducedMotion: true }).init();
  storyWorld.setRoute('alter');

  const route = scene.getObjectByName('story_route_alter');
  const matrix = new Matrix4();
  const previous = new Vector3();
  const current = new Vector3();

  route.getMatrixAt(0, matrix);
  previous.setFromMatrixPosition(matrix);
  for (let index = 1; index < route.count; index += 1) {
    route.getMatrixAt(index, matrix);
    current.setFromMatrixPosition(matrix);
    const horizontalGap = Math.hypot(current.x - previous.x, current.z - previous.z);
    assert.ok(horizontalGap < 0.95, `route marker gap ${horizontalGap.toFixed(3)} m is too large`);
    previous.copy(current);
  }

  storyWorld.dispose();
});

test('the compliant cottage route ends on the expanded tea-house doorstep', () => {
  const teaHouse = TOWN_LAYOUT.buildings.find((building) => building.id === 'mint-tea-house');
  const teaHouseBounds = getBuildingBounds('mint-tea-house');
  const approach = getBuildingDoorApproach('mint-tea-house');
  const destination = STORY_ROUTES.comply.at(-1);
  assert.equal(destination.x, approach.x);
  assert.equal(destination.z, approach.z);
  assert.ok(destination.z < teaHouseBounds.minZ);
  assert.ok(teaHouseBounds.minZ - destination.z >= 0.35);
  const porch = teaHouse.porchCollider;
  const porchCenterZ = teaHouse.position.z + porch.offsetZ;
  assert.ok(Math.abs(destination.x - teaHouse.position.x) <= porch.size.x * 0.5);
  assert.ok(Math.abs(destination.z - porchCenterZ) <= porch.size.z * 0.5);
  assert.ok(
    destination.y > porch.size.y * 1.5,
    'final route marker should float above the veranda surface',
  );
});

test('expanded cottages leave a generous ring around the story plaza', () => {
  for (const building of TOWN_LAYOUT.buildings) {
    const bounds = getBuildingBounds(building);
    const nearestX = Math.max(bounds.minX, Math.min(TOWN_LAYOUT.plaza.x, bounds.maxX));
    const nearestZ = Math.max(bounds.minZ, Math.min(TOWN_LAYOUT.plaza.z, bounds.maxZ));
    const plazaClearance = Math.hypot(
      nearestX - TOWN_LAYOUT.plaza.x,
      nearestZ - TOWN_LAYOUT.plaza.z,
    ) - TOWN_LAYOUT.plaza.radius;
    assert.ok(
      plazaClearance >= 4,
      `${building.id} leaves only ${plazaClearance.toFixed(2)} m beyond the plaza edge`,
    );
  }
});

test('the authored garden arch clears the tea-house render envelope', () => {
  const teaHouseBounds = getBuildingBounds('mint-tea-house');
  const arch = TOWN_LAYOUT.authoredProps.gardenArch;
  const nearestX = Math.max(teaHouseBounds.minX, Math.min(arch.x, teaHouseBounds.maxX));
  const nearestZ = Math.max(teaHouseBounds.minZ, Math.min(arch.z, teaHouseBounds.maxZ));
  const centerClearance = Math.hypot(arch.x - nearestX, arch.z - nearestZ);
  assert.ok(
    centerClearance >= 2.5,
    `garden arch center leaves only ${centerClearance.toFixed(2)} m from tea-house walls`,
  );
});
