import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isObjectiveHintPathSafe,
  OBJECTIVE_HINT_MAX_DISTANCE,
  OBJECTIVE_HINT_SAFE_ROUTE_IDS,
  OBJECTIVE_HINT_TARGETS,
  resolveObjectiveHintPath,
} from '../src/config/objective-hints.js';
import { TOWN_LAYOUT } from '../src/config/town.js';
import { CORE_HOOK_V03 } from '../src/content/core-hook-v03.js';
import { DAY_ONE_V01 } from '../src/content/day-one-v01.js';

const STEWARD_TARGETS = Object.freeze({
  'meet-steward': { x: 1.6, y: 0, z: 9.4 },
  'day-one-meet-steward': { x: 1.6, y: 0, z: 9.4 },
  'return-to-lumen': { x: -0.2, y: 0, z: 4.8 },
  'hear-correction': { x: 0.25, y: 0, z: 3.45 },
});

function targetFor(id, targetKey) {
  if (targetKey === 'steward') return STEWARD_TARGETS[id];
  if (targetKey === 'ledger') return TOWN_LAYOUT.landmarks.ledger;
  if (targetKey === 'bell') return TOWN_LAYOUT.landmarks.bell;
  return TOWN_LAYOUT.dayOne[targetKey];
}

function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function pathLength(points) {
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    total += Math.hypot(
      points[index + 1].x - points[index].x,
      points[index + 1].y - points[index].y,
      points[index + 1].z - points[index].z,
    );
  }
  return total;
}

function pointIndex(points, x, z, tolerance = 1e-6) {
  return points.findIndex((point) => (
    Math.abs(point.x - x) <= tolerance && Math.abs(point.z - z) <= tolerance
  ));
}

test('every active objective resolves to its configured safe target role', () => {
  const expectedTargets = {
    'meet-steward': 'steward',
    'day-one-meet-steward': 'steward',
    'sign-ledger': 'ledger',
    'day-one-sign-ledger': 'ledger',
    'settle-first-afternoon': 'campRecovery',
    'day-one-gather-wood': 'woodlot',
    'day-one-catch-fish': 'fishingSpot',
    'day-one-light-fire': 'campfire',
    'day-one-cook-fish': 'campfire',
    'day-one-eat-fish': 'campfire',
    'day-one-plant-seed': 'garden',
    'day-one-water-seed': 'garden',
    'day-one-gather-shelter-wood': 'woodlot',
    'day-one-repair-shelter': 'shelter',
    'ring-bell-at-dusk': 'bell',
    'return-to-lumen': 'steward',
    'inspect-ledger': 'ledger',
    'hear-correction': 'steward',
    'comply-complete': null,
    'alter-complete': null,
  };
  assert.deepEqual(OBJECTIVE_HINT_TARGETS, expectedTargets);
  assert.deepEqual(
    new Set(Object.keys(OBJECTIVE_HINT_TARGETS)),
    new Set([
      ...Object.values(CORE_HOOK_V03.objectives),
      ...Object.values(DAY_ONE_V01.objectives),
    ].map(({ id }) => id)),
    'the resolver contract must cover every authored objective exactly once',
  );

  for (const [id, targetKey] of Object.entries(OBJECTIVE_HINT_TARGETS)) {
    if (!targetKey) continue;
    const target = targetFor(id, targetKey);
    const points = resolveObjectiveHintPath({
      objective: { id },
      start: TOWN_LAYOUT.spawn,
      target,
      maxDistance: Infinity,
    });
    assert.ok(points?.length >= 2, `${id} should produce a route`);
    assert.equal(isObjectiveHintPathSafe(points), true, `${id} route must retain clearance`);
    assert.ok(points.flatMap(({ x, y, z }) => [x, y, z]).every(Number.isFinite));
    assert.ok(points.every(({ x, z }) => Math.hypot(x, z) <= TOWN_LAYOUT.meadowRadius));

    const destination = points.at(-1);
    const tolerance = targetKey === 'steward' ? 2.35 : 1e-6;
    assert.ok(
      distanceXZ(destination, target) <= tolerance,
      `${id} should end within its ${targetKey} arrival radius`,
    );
  }
});

test('resolution, unsupported, mismatched, and unreachable requests never invent a chord', () => {
  const start = TOWN_LAYOUT.spawn;
  const ledger = TOWN_LAYOUT.landmarks.ledger;
  assert.equal(resolveObjectiveHintPath({ objective: 'comply-complete', start, target: ledger }), null);
  assert.equal(resolveObjectiveHintPath({ objective: 'alter-complete', start, target: ledger }), null);
  assert.equal(resolveObjectiveHintPath({ objective: 'unknown-objective', start, target: ledger }), null);
  assert.equal(resolveObjectiveHintPath({ objective: null, start, target: ledger }), null);
  assert.equal(resolveObjectiveHintPath({
    objective: 'sign-ledger',
    start,
    target: ledger,
    layout: null,
  }), null);
  assert.equal(resolveObjectiveHintPath({ objective: 'sign-ledger', start, target: null }), null);
  assert.equal(resolveObjectiveHintPath({
    objective: 'sign-ledger',
    start,
    target: TOWN_LAYOUT.landmarks.bell,
  }), null, 'an objective cannot be redirected to another role');
  assert.equal(resolveObjectiveHintPath({
    objective: 'sign-ledger',
    start: { x: 1000, y: 0, z: 1000 },
    target: ledger,
  }), null, 'a remote player position must not receive a long unsafe connector');
  assert.equal(resolveObjectiveHintPath({
    objective: 'sign-ledger',
    start: { x: NaN, y: 0, z: 0 },
    target: ledger,
  }), null);
  assert.equal(resolveObjectiveHintPath({
    objective: 'sign-ledger',
    start,
    target: ledger,
    maxDistance: 0,
  }), null);
});

test('pond-to-camp guidance follows pond, plaza, rose, and forest corridors', () => {
  const start = TOWN_LAYOUT.dayOne.fishingSpot;
  const target = TOWN_LAYOUT.dayOne.campfire;
  const points = resolveObjectiveHintPath({
    objective: 'day-one-light-fire',
    start,
    target,
    maxDistance: Infinity,
  });
  assert.ok(points);

  const pondStartIndex = pointIndex(points, 4, 1.2);
  const plazaIndex = pointIndex(points, TOWN_LAYOUT.plaza.x, TOWN_LAYOUT.plaza.z);
  const roseStartIndex = pointIndex(points, -0.5, 2.1);
  const postOfficeIndex = pointIndex(points, -14.5, 9.6);
  const campJunctionIndex = pointIndex(points, -29.3, 3.8);
  assert.ok(pondStartIndex > 0, 'the pond route must be walked back toward town');
  assert.ok(plazaIndex > pondStartIndex, 'the route must enter the open plaza hub');
  assert.ok(roseStartIndex > plazaIndex, 'the route must take the rose-post-office lane');
  assert.ok(postOfficeIndex > roseStartIndex, 'the route must reach the forest path join');
  assert.ok(campJunctionIndex > postOfficeIndex, 'the route must follow the camp footpath');
  assert.equal(distanceXZ(points.at(-1), target), 0);
  assert.ok(
    pathLength(points) > distanceXZ(start, target) + 8,
    'the safe authored detour must not collapse into a direct pond-to-camp chord',
  );
  assert.equal(isObjectiveHintPathSafe(points), true);
});

test('Bell guidance preserves the authored three-dimensional hill surface', () => {
  const route = TOWN_LAYOUT.paths.find(({ id }) => id === 'bell-hill-ritual');
  const points = resolveObjectiveHintPath({
    objective: 'ring-bell-at-dusk',
    start: TOWN_LAYOUT.spawn,
    target: TOWN_LAYOUT.landmarks.bell,
    maxDistance: Infinity,
  });
  assert.ok(points);

  for (const [x, y, z] of route.points) {
    const index = pointIndex(points, x, z);
    assert.ok(index >= 0, `Bell route point ${x},${z} must remain in the hint path`);
    assert.ok(Math.abs(points[index].y - y) <= 1e-9, 'hill height must remain authored');
  }
  assert.equal(points.at(-1).x, TOWN_LAYOUT.landmarks.bell.x);
  assert.equal(points.at(-1).z, TOWN_LAYOUT.landmarks.bell.z);
  assert.equal(points.at(-1).y, route.points.at(-1)[1], 'trail ends on ground, not Bell center');
  assert.equal(isObjectiveHintPathSafe(points), true);
});

test('default guidance is bounded and excludes unvalidated connector routes', () => {
  assert.deepEqual(OBJECTIVE_HINT_SAFE_ROUTE_IDS, [
    'arrival',
    'berry-bakery',
    'lavender-library',
    'mint-tea-house',
    'rose-post-office',
    'pond',
    'forest-edge-camp',
    'bell-hill-ritual',
  ]);
  assert.equal(OBJECTIVE_HINT_SAFE_ROUTE_IDS.includes('north-garden-walk'), false);
  assert.equal(OBJECTIVE_HINT_SAFE_ROUTE_IDS.includes('south-orchard-walk'), false);

  const points = resolveObjectiveHintPath({
    objective: 'day-one-repair-shelter',
    start: TOWN_LAYOUT.spawn,
    target: TOWN_LAYOUT.dayOne.shelter,
  });
  assert.ok(points);
  assert.ok(pathLength(points) <= OBJECTIVE_HINT_MAX_DISTANCE + 1e-6);
  assert.ok(pathLength(points) >= OBJECTIVE_HINT_MAX_DISTANCE - 1e-6);
  assert.equal(isObjectiveHintPathSafe(points), true);
});
