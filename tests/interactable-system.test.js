import assert from 'node:assert/strict';
import test from 'node:test';

import { InteractableSystem } from '../src/game/InteractableSystem.js';

test('one in-flight interaction blocks overlapping E presses globally', async () => {
  let calls = 0;
  let release;
  const first = new Promise((resolve) => { release = resolve; });
  const hud = {
    showPrompt() {},
    hidePrompt() {},
    setStatus() {},
  };
  const system = new InteractableSystem(hud);
  system.register({
    id: 'garden',
    position: { distanceTo: () => 0 },
    radius: 2,
    prompt: 'Tend garden',
    onInteract() {
      calls += 1;
      return calls === 1 ? first : 'done';
    },
  });
  const input = { consumeKeyPress: () => true };

  system.update({}, input);
  system.update({}, input);
  await Promise.resolve();
  assert.equal(calls, 1);

  release('planted');
  const firstInteraction = system.inFlight;
  await firstInteraction;
  system.update({}, input);
  await Promise.resolve();
  assert.equal(calls, 2);
});

test('a synchronous interaction throw is contained by the in-flight failure path', async () => {
  const statuses = [];
  const system = new InteractableSystem({
    showPrompt() {},
    hidePrompt() {},
    setStatus(message) { statuses.push(message); },
  });
  system.register({
    id: 'garden',
    position: { distanceTo: () => 0 },
    radius: 2,
    prompt: 'Tend garden',
    onInteract() {
      throw new Error('synchronous failure');
    },
  });

  const originalError = console.error;
  console.error = () => {};
  try {
    assert.doesNotThrow(() => system.update({}, { consumeKeyPress: () => true }));
    const interaction = system.inFlight;
    await interaction;
    assert.equal(system.inFlight, null);
    assert.deepEqual(statuses, ['The valley lost its train of thought. Please try again.']);
  } finally {
    console.error = originalError;
  }
});
