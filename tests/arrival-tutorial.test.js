import test from 'node:test';
import assert from 'node:assert/strict';

import { ARRIVAL_PROLOGUE_V1 } from '../src/config/arrival-prologue.js';
import { ArrivalTutorial } from '../src/game/ArrivalTutorial.js';

const EVENTS = ARRIVAL_PROLOGUE_V1.events ?? {
  arrivalMemorySeen: 'arrival-trusted-memory-seen',
  crossroadsReached: 'arrival-crossroads-reached',
  arrivalResponseChosen: 'arrival-response-chosen',
  stewardMet: 'steward-lumen-met',
};

const MEMORY_SEEN = 'arrival-trusted-memory-seen';
const CROSSROADS_REACHED = 'arrival-crossroads-reached';
const RESPONSE_CHOSEN = 'arrival-response-chosen';
const STEWARD_MET = 'steward-lumen-met';
const SPAWN = ARRIVAL_PROLOGUE_V1.anchors.spawn;

function update(tutorial, overrides = {}) {
  return tutorial.update({
    yaw: 0,
    position: SPAWN,
    eventsSeen: [MEMORY_SEEN],
    ...overrides,
  });
}

test('arrival teaching observes Look then Move before offering Hint at the crossroads', () => {
  const tutorial = new ArrivalTutorial({ eventIds: EVENTS });

  const blocked = update(tutorial, { eventsSeen: [], inputActive: false });
  assert.equal(blocked.step, null);
  assert.equal(blocked.cue, null);

  const look = update(tutorial);
  assert.equal(look.step, 'look');
  assert.deepEqual(look.cue, {
    id: 'look',
    key: 'Mouse',
    text: 'Look into the storm',
  });

  update(tutorial, { yaw: Math.PI / 18 });
  const move = update(tutorial, { yaw: Math.PI / 9 });
  assert.equal(move.step, 'move');
  assert.equal(move.cue.key, 'WASD');

  const moving = update(tutorial, { yaw: Math.PI / 9, position: { ...SPAWN, x: SPAWN.x + 3 } });
  assert.equal(moving.step, null, 'Hint waits for authoritative crossroads progress');

  const armed = update(tutorial, {
    yaw: Math.PI / 9,
    position: { ...SPAWN, x: SPAWN.x + 3 },
    eventsSeen: [MEMORY_SEEN, CROSSROADS_REACHED],
    hintReady: false,
  });
  assert.equal(armed.step, 'hint');
  assert.equal(armed.cue, null, 'the objective may update before Hint emphasis is ready');

  const hint = update(tutorial, {
    yaw: Math.PI / 9,
    position: { ...SPAWN, x: SPAWN.x + 3 },
    eventsSeen: [MEMORY_SEEN, CROSSROADS_REACHED],
  });
  assert.equal(hint.step, 'hint');
  assert.equal(hint.cue.key, 'H');
  assert.equal(Object.isFrozen(hint), true);
  assert.equal(Object.isFrozen(hint.progress), true);
});

test('cumulative yaw uses wrapped deltas and rewards attention in either direction', () => {
  const tutorial = new ArrivalTutorial();
  update(tutorial, { yaw: Math.PI - 0.08 });
  update(tutorial, { yaw: -Math.PI + 0.08 });
  const result = update(tutorial, { yaw: Math.PI - 0.11 });

  assert.ok(result.progress.lookYaw > ARRIVAL_PROLOGUE_V1.tutorial.lookYawRadians);
  assert.equal(result.step, 'move');
});

test('moving three metres skips stale Look and Move cues without gating a confident player', () => {
  const tutorial = new ArrivalTutorial();
  const result = update(tutorial, {
    position: { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z - 3 },
  });

  assert.equal(result.step, null);
  assert.equal(result.cue, null);
  assert.equal(result.progress.moveDistance, 3);
});

test('an early successful Hint use completes that beat without consuming it twice', () => {
  const tutorial = new ArrivalTutorial();
  update(tutorial, { hintSucceeded: true });
  const result = update(tutorial, {
    eventsSeen: [MEMORY_SEEN, CROSSROADS_REACHED],
  });

  assert.equal(result.step, null);
  assert.equal(result.cue, null);
  assert.equal(result.complete, false, 'tutorial observation does not advance arrival state');
});

test('touch copy is selected without changing progress and proximity UI suppresses stacking', () => {
  const tutorial = new ArrivalTutorial();
  const touch = update(tutorial, { controlMode: 'touch' });
  assert.equal(touch.step, 'look');
  assert.deepEqual(touch.cue, {
    id: 'look',
    key: 'Drag',
    text: 'Look into the storm',
  });

  const near = update(tutorial, { controlMode: 'touch', nearInteraction: true });
  assert.equal(near.step, 'look');
  assert.equal(near.cue, null);
});

test('existing arrival events resume at Hint or clear teaching after the relationship beat', () => {
  const crossroadsReload = new ArrivalTutorial();
  const hint = update(crossroadsReload, {
    eventsSeen: [CROSSROADS_REACHED],
  });
  assert.equal(hint.step, 'hint');

  const responseReload = new ArrivalTutorial();
  const response = update(responseReload, {
    eventsSeen: [MEMORY_SEEN, CROSSROADS_REACHED, RESPONSE_CHOSEN],
  });
  assert.equal(response.step, null);
  assert.equal(response.cue, null);
  assert.equal(response.complete, true);

  const establishedSave = new ArrivalTutorial();
  const complete = update(establishedSave, {
    eventsSeen: [STEWARD_MET],
  });
  assert.equal(complete.step, null);
  assert.equal(complete.active, false);
  assert.equal(complete.complete, true);
});
