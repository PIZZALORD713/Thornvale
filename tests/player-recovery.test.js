import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAYER_FALL_RECOVERY_Y,
  hasPlayerFallenOutOfWorld,
  resolveCurrentRecoveryPoint,
} from '../src/game/PlayerRecovery.js';

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
