import assert from 'node:assert/strict';
import test from 'node:test';

import { recoverMissingCharacterVisuals } from '../src/app/recoverMissingCharacterVisuals.js';

test('total fRiENDSiES load failure installs independent code-native player and steward fallbacks', () => {
  const createdRoles = [];
  const installed = [];

  const recovered = recoverMissingCharacterVisuals({
    playerVisual: null,
    stewardVisual: null,
    storyEnabled: true,
    createFallback: (role) => {
      createdRoles.push(role);
      return { name: `${role}-safe-fallback`, role };
    },
    installPlayer: (visual) => installed.push(['player', visual]),
    installSteward: (visual) => installed.push(['steward', visual]),
  });

  assert.deepEqual(createdRoles, ['player', 'steward']);
  assert.deepEqual(installed, [
    ['player', recovered.playerVisual],
    ['steward', recovered.stewardVisual],
  ]);
  assert.equal(recovered.playerVisual.name, 'player-safe-fallback');
  assert.equal(recovered.stewardVisual.name, 'steward-safe-fallback');
  assert.equal(recovered.playerUsedSafeFallback, true);
  assert.equal(recovered.stewardUsedSafeFallback, true);
});

test('successful fRiENDSiES visuals remain first choice and never construct fallbacks', () => {
  const playerVisual = { name: 'friendsies-player' };
  const stewardVisual = { name: 'friendsies-steward' };
  let createCount = 0;

  const recovered = recoverMissingCharacterVisuals({
    playerVisual,
    stewardVisual,
    storyEnabled: true,
    createFallback: () => {
      createCount += 1;
      return { name: 'unexpected-fallback' };
    },
    installPlayer: () => assert.fail('player fallback must not be installed'),
    installSteward: () => assert.fail('steward fallback must not be installed'),
  });

  assert.equal(createCount, 0);
  assert.equal(recovered.playerVisual, playerVisual);
  assert.equal(recovered.stewardVisual, stewardVisual);
  assert.equal(recovered.playerUsedSafeFallback, false);
  assert.equal(recovered.stewardUsedSafeFallback, false);
});

test('story-disabled startup does not construct an unused steward fallback', () => {
  const createdRoles = [];

  const recovered = recoverMissingCharacterVisuals({
    playerVisual: null,
    stewardVisual: null,
    storyEnabled: false,
    createFallback: (role) => {
      createdRoles.push(role);
      return { name: `${role}-safe-fallback` };
    },
    installPlayer: () => {},
    installSteward: () => assert.fail('hidden steward fallback must not be installed'),
  });

  assert.deepEqual(createdRoles, ['player']);
  assert.equal(recovered.playerUsedSafeFallback, true);
  assert.equal(recovered.stewardVisual, null);
  assert.equal(recovered.stewardUsedSafeFallback, false);
});
