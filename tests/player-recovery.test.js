import test from 'node:test';
import assert from 'node:assert/strict';

import {
  distanceToReviewedCorridor,
  isArrivalFoldEligible,
  isWithinReviewedCorridor,
  PLAYER_FALL_RECOVERY_Y,
  hasPlayerFallenOutOfWorld,
  resolveCurrentRecoveryPoint,
} from '../src/game/PlayerRecovery.js';

const REVIEWED_ROUTES = [
  [
    [-18, 0, 56],
    [8.2, 0, 42.2],
  ],
  [
    [8.2, 0, 42.2],
    [0, 0, 10.45],
  ],
  [
    [8.2, 0, 42.2],
    [-11, 0, 49],
  ],
];

test('fall recovery triggers only after the player leaves the playable vertical bounds', () => {
  assert.equal(hasPlayerFallenOutOfWorld({ x: 0, y: 0, z: 0 }), false);
  assert.equal(hasPlayerFallenOutOfWorld({ x: 70, y: PLAYER_FALL_RECOVERY_Y, z: -80 }), false);
  assert.equal(hasPlayerFallenOutOfWorld({ x: 0, y: PLAYER_FALL_RECOVERY_Y - 0.01, z: 0 }), true);
  assert.equal(hasPlayerFallenOutOfWorld({ x: 0, y: Number.NaN, z: 0 }), true);
});

test('the current recovery point follows shelter repair without mutating session state', () => {
  const gate = { x: 0, y: 2, z: 14 };
  const shelter = { x: -29.3, y: 0.9, z: 3.8 };
  const beforeRepair = { world: { camp: { shelterRepaired: false } } };
  const afterRepair = { world: { camp: { shelterRepaired: true } } };

  assert.deepEqual(resolveCurrentRecoveryPoint(beforeRepair, gate, shelter), gate);
  assert.deepEqual(resolveCurrentRecoveryPoint(afterRepair, gate, shelter), shelter);
  assert.notStrictEqual(resolveCurrentRecoveryPoint(afterRepair, gate, shelter), shelter);
  assert.deepEqual(afterRepair, { world: { camp: { shelterRepaired: true } } });
});

test('non-story play and incomplete snapshots safely recover at the arrival spawn', () => {
  const gate = { x: 0, y: 2, z: 14 };
  const shelter = { x: -29.3, y: 0.9, z: 3.8 };

  assert.deepEqual(resolveCurrentRecoveryPoint(null, gate, shelter), gate);
  assert.deepEqual(resolveCurrentRecoveryPoint({}, gate, shelter), gate);
  assert.equal(resolveCurrentRecoveryPoint({}, null, shelter), null);
});

test('reviewed-corridor distance measures the nearest horizontal route segment', () => {
  assert.equal(distanceToReviewedCorridor({ x: -18, z: 56 }, REVIEWED_ROUTES), 0);
  assert.equal(
    distanceToReviewedCorridor({ x: 8.2, z: 42.2 }, REVIEWED_ROUTES),
    0,
  );
  assert.equal(
    distanceToReviewedCorridor(
      { x: 5, z: 5 },
      [[
        [0, 0, 0],
        [10, 0, 0],
      ]],
    ),
    5,
  );
  assert.equal(distanceToReviewedCorridor({ x: 0, z: 0 }, []), Infinity);
  assert.equal(distanceToReviewedCorridor({ x: Number.NaN, z: 0 }, REVIEWED_ROUTES), Infinity);
});

test('the 10 m leash keeps the reviewed wrong fork safe and folds only beyond it', () => {
  const wrongForkEnd = { x: -11, z: 49 };
  const straightRoute = [[
    [0, 0, 0],
    [10, 0, 0],
  ]];
  const exactBoundary = { x: 5, z: 10 };
  const beyondBoundary = { x: 5, z: 10.01 };

  assert.equal(isWithinReviewedCorridor(wrongForkEnd, REVIEWED_ROUTES, 10), true);
  assert.equal(isWithinReviewedCorridor(exactBoundary, straightRoute, 10), true);
  assert.equal(isWithinReviewedCorridor(beyondBoundary, straightRoute, 10), false);
  assert.equal(
    isArrivalFoldEligible({
      position: wrongForkEnd,
      reviewedRoutes: REVIEWED_ROUTES,
      leash: 10,
    }),
    false,
  );
  assert.equal(
    isArrivalFoldEligible({
      position: beyondBoundary,
      reviewedRoutes: straightRoute,
      leash: 10,
    }),
    true,
  );
});

test('fold eligibility remains presentation-only and respects completion, cooldown, and re-entry guards', () => {
  const position = { x: 70, y: 2, z: 70 };
  const input = {
    position,
    reviewedRoutes: REVIEWED_ROUTES,
    leash: 10,
    arrivalComplete: false,
    cooldownRemainingMs: 0,
    requiresCorridorReentry: false,
  };
  const before = structuredClone(input);

  assert.equal(isArrivalFoldEligible(input), true);
  assert.equal(isArrivalFoldEligible({ ...input, arrivalComplete: true }), false);
  assert.equal(isArrivalFoldEligible({ ...input, cooldownRemainingMs: 1 }), false);
  assert.equal(isArrivalFoldEligible({ ...input, requiresCorridorReentry: true }), false);
  assert.equal(isArrivalFoldEligible({ ...input, position: null }), false);
  assert.deepEqual(input, before, 'eligibility must not mutate session or guard inputs');
});
