import assert from 'node:assert/strict';
import test from 'node:test';

import { disposeTownPresentation } from '../src/app/disposeTownPresentation.js';

test('town presentation teardown releases animator dependents before clearing the registry', () => {
  const events = [];
  const resources = {
    ambientLife: { dispose: () => events.push('ambient-life') },
    traitEchoes: { dispose: () => events.push('trait-echoes') },
    breathingGrass: { dispose: () => events.push('breathing-grass') },
    worldAnimator: { clear: () => events.push('world-animator') },
  };

  const released = disposeTownPresentation(resources);

  assert.deepEqual(events, [
    'ambient-life',
    'trait-echoes',
    'breathing-grass',
    'world-animator',
  ]);
  assert.deepEqual(released, {
    ambientLife: null,
    traitEchoes: null,
    breathingGrass: null,
    worldAnimator: null,
  });

  disposeTownPresentation(released);
  assert.equal(events.length, 4, 'released references make repeated app teardown a no-op');
});
