import assert from 'node:assert/strict';
import test from 'node:test';

import { STEWARDSHIP_V01 } from '../src/content/stewardship-v01.js';
import { FishingController } from '../src/game/FishingController.js';

function clone(value) {
  return structuredClone(value);
}

class FakeSession {
  constructor(state = createState()) {
    this.state = clone(state);
    this.transactions = 0;
  }

  snapshot() {
    return clone(this.state);
  }

  transact(mutator) {
    const draft = this.snapshot();
    mutator(draft);
    this.state = draft;
    this.transactions += 1;
    return this.snapshot();
  }
}

class FakeInput {
  constructor() {
    this.pressed = false;
    this.held = false;
  }

  tap() {
    this.pressed = true;
  }

  consumeActionPress(action) {
    assert.equal(action, 'interact');
    const pressed = this.pressed;
    this.pressed = false;
    return pressed;
  }

  isActionHeld(action) {
    assert.equal(action, 'interact');
    return this.held;
  }
}

function createState() {
  return {
    player: {
      meters: { energy: 82, nourishment: 72 },
      economy: { coins: 8, doctorDebt: 0 },
      inventory: {
        stackables: {
          'resource.wood': 0,
          'seed.garden.common': 1,
          'seed.tree.common': 0,
          'bait.worm': 0,
        },
        specimens: {},
        nextSpecimenSequence: 1,
      },
      tools: { owned: ['tool.rod.simple'], upgrades: {} },
      equipment: { axe: null, rod: 'tool.rod.simple', bait: null },
    },
    activities: {
      woodcutting: { woodHarvested: 0, treesFelled: 0, treesPlanted: 0 },
      fishing: { totalCaught: 0, caughtBySpecies: {}, largestCmBySpecies: {} },
      cooking: { mealsCooked: 0, mealsEaten: 0 },
      gardening: { seedsPlanted: 0 },
    },
  };
}

function advance(controller, input, seconds, hz = 60) {
  const frames = Math.ceil(seconds * hz);
  for (let frame = 0; frame < frames && controller.active; frame += 1) {
    controller.update(1 / hz, input);
  }
}

function reachPhase(controller, input, phase, { hz = 60, limitSeconds = 8 } = {}) {
  const frames = Math.ceil(limitSeconds * hz);
  for (let frame = 0; frame < frames; frame += 1) {
    if (controller.phase === phase) return;
    controller.update(1 / hz, input);
  }
  assert.fail(`Fishing never reached ${phase}; stopped at ${controller.phase}`);
}

function hookFish(controller, input, hz = 60) {
  reachPhase(controller, input, 'bite', { hz });
  input.tap();
  controller.update(1 / hz, input);
  assert.equal(controller.phase, 'struggle');
}

function landFish(controller, input, hz = 60) {
  hookFish(controller, input, hz);
  const frames = hz * 15;
  for (let frame = 0; frame < frames && controller.phase === 'struggle'; frame += 1) {
    input.held = controller.tension < 0.58;
    controller.update(1 / hz, input);
  }
  input.held = false;
  assert.equal(controller.phase, 'landing');
  input.tap();
  controller.update(1 / hz, input);
  assert.equal(controller.phase, 'landed');
}

test('fishing start is synchronous, requires the equipped simple rod, and locks movement', () => {
  const missingRod = createState();
  missingRod.player.equipment.rod = null;
  const blocked = new FishingController({ session: new FakeSession(missingRod) });
  assert.deepEqual(blocked.start(), {
    started: false,
    reason: 'rod-required',
    message: STEWARDSHIP_V01.messages.rodRequired,
  });

  const locks = [];
  const session = new FakeSession();
  const controller = new FishingController({
    session,
    control: {
      setActionLocked(locked, options) { locks.push({ locked, options }); },
    },
  });
  const started = controller.start({ targetPosition: { x: 16.4, y: 0.25, z: 4 } });
  assert.equal(started.started, true);
  assert.equal(started instanceof Promise, false);
  assert.equal(controller.phase, 'cast');
  assert.equal(controller.active, true);
  assert.equal(locks[0].locked, true);

  controller.cancel('test');
  assert.deepEqual(locks.map(({ locked }) => locked), [true, false]);
});

test('a committed cast consumes one equipped bait exactly once and saves no timing state', () => {
  const state = createState();
  state.player.inventory.stackables['bait.worm'] = 1;
  state.player.equipment.bait = 'bait.worm';
  const session = new FakeSession(state);
  const controller = new FishingController({ session });

  const started = controller.start();
  assert.equal(started.baitConsumed, 'bait.worm');
  assert.equal(session.state.player.inventory.stackables['bait.worm'], 0);
  assert.equal(session.state.player.equipment.bait, null);
  assert.equal(session.transactions, 1);
  assert.equal('fishingPhase' in session.state, false);
  assert.equal(JSON.stringify(session.state).includes('tension'), false);

  const duplicate = controller.start();
  assert.equal(duplicate.started, false);
  assert.equal(duplicate.reason, 'already-active');
  assert.equal(session.transactions, 1);
});

test('the deterministic first movement is a false nibble and an early hook awards nothing', () => {
  const session = new FakeSession();
  const input = new FakeInput();
  const controller = new FishingController({ session });
  controller.start();

  reachPhase(controller, input, 'false-nibble');
  input.tap();
  controller.update(1 / 60, input);

  assert.equal(controller.phase, 'escaped');
  assert.equal(controller.outcome.reason, 'false-nibble-hook');
  assert.equal(session.state.activities.fishing.totalCaught, 0);
  assert.deepEqual(session.state.player.inventory.specimens, {});
});

test('missing the true bite window returns to a retryable escaped state without reward', () => {
  const session = new FakeSession();
  const input = new FakeInput();
  const controller = new FishingController({ session });
  controller.start();
  reachPhase(controller, input, 'bite');
  advance(controller, input, STEWARDSHIP_V01.fishing.timing.hookWindow + 0.2);

  assert.equal(controller.phase, 'escaped');
  assert.equal(controller.outcome.reason, 'missed-bite');
  assert.equal(controller.active, false);
  assert.equal(session.state.activities.fishing.totalCaught, 0);
  assert.equal(controller.start().started, true);
});

test('holding continuously breaks the line before landing and awards no fish', () => {
  const session = new FakeSession();
  const input = new FakeInput();
  const controller = new FishingController({ session });
  controller.start();
  hookFish(controller, input);
  input.held = true;
  advance(controller, input, 5);

  assert.equal(controller.phase, 'escaped');
  assert.equal(controller.outcome.reason, 'line-broke');
  assert.equal(session.state.activities.fishing.totalCaught, 0);
  assert.deepEqual(session.state.player.inventory.specimens, {});
});

for (const hz of [60, 120, 144]) {
  test(`hook, tension management, and landing commit one specimen at ${hz} Hz`, () => {
    const session = new FakeSession();
    const input = new FakeInput();
    const controller = new FishingController({ session });
    controller.start();
    landFish(controller, input, hz);

    assert.equal(controller.active, false);
    assert.equal(controller.outcome.kind, 'landed');
    assert.equal(controller.outcome.specimenId, 'catch-0001');
    assert.deepEqual(session.state.player.inventory.specimens['catch-0001'], {
      itemId: 'fish.pond-dace',
      condition: 'raw',
      lengthCm: 18,
      quality: 'ordinary',
      caughtAt: 'pond.shallows',
    });
    assert.equal(session.state.player.inventory.nextSpecimenSequence, 2);
    assert.deepEqual(session.state.activities.fishing, {
      totalCaught: 1,
      caughtBySpecies: { 'fish.pond-dace': 1 },
      largestCmBySpecies: { 'fish.pond-dace': 18 },
    });

    controller.update(2, input);
    assert.equal(session.state.activities.fishing.totalCaught, 1);
    assert.equal(Object.keys(session.state.player.inventory.specimens).length, 1);
  });
}

test('later catches update lifetime fishing totals without rewriting the completed Day One account', () => {
  const state = createState();
  state.player.inventory.specimens['catch-0001'] = {
    itemId: 'fish.pond-dace',
    condition: 'raw',
    lengthCm: 18,
    quality: 'ordinary',
    caughtAt: 'pond.shallows',
  };
  state.player.inventory.nextSpecimenSequence = 2;
  state.activities.fishing = {
    totalCaught: 1,
    caughtBySpecies: { 'fish.pond-dace': 1 },
    largestCmBySpecies: { 'fish.pond-dace': 18 },
  };
  state.chapters = {
    dayOne: {
      complete: true,
      account: {
        woodGathered: 6,
        fishCaught: 1,
        mealsCooked: 1,
        mealsEaten: 1,
        seedsPlanted: 1,
      },
    },
  };
  const session = new FakeSession(state);
  const input = new FakeInput();
  const controller = new FishingController({ session });
  controller.start();
  landFish(controller, input);

  assert.equal(session.state.activities.fishing.totalCaught, 2);
  assert.equal(session.state.player.inventory.nextSpecimenSequence, 3);
  assert.deepEqual(session.state.chapters.dayOne.account, state.chapters.dayOne.account);
});
