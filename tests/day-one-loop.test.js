import test from 'node:test';
import assert from 'node:assert/strict';

import { DAY_ONE_V01 } from '../src/content/day-one-v01.js';
import { DayOneDirector } from '../src/game/DayOneDirector.js';
import { DayOneActionController } from '../src/game/DayOneActionController.js';
import {
  GAME_SESSION_VERSION,
  GameSession,
} from '../src/game/GameSession.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

function createActiveDay({ storage = new MemoryStorage(), ...directorOptions } = {}) {
  let now = 100;
  const session = new GameSession({ storage, now: () => ++now });
  session.transact((draft) => {
    draft.phase = 'day-routine';
    draft.eventsSeen.push('arrival-letter-seen', DAY_ONE_V01.events.stewardMet);
  });
  const director = new DayOneDirector({ session, ...directorOptions });
  return { director, session, storage };
}

test('Day One starts only after meeting the steward and exposes deterministic objectives', async () => {
  const session = new GameSession({ storage: null });
  const director = new DayOneDirector({ session });

  assert.equal(director.handles(DAY_ONE_V01.ids.woodlot), true);
  assert.equal(director.handles('ledger'), false);
  assert.equal(director.isInteractableEnabled(DAY_ONE_V01.ids.woodlot), false);
  assert.equal(director.currentObjective().id, 'day-one-meet-steward');

  session.transact((draft) => {
    draft.phase = 'day-routine';
    draft.eventsSeen.push('arrival-letter-seen', DAY_ONE_V01.events.stewardMet);
  });

  assert.equal(director.isInteractableEnabled(DAY_ONE_V01.ids.woodlot), true);
  assert.equal(director.promptFor(DAY_ONE_V01.ids.woodlot), DAY_ONE_V01.prompts.chop);
  assert.equal(director.currentObjective().id, 'day-one-gather-wood');
});

test('the complete first-afternoon loop preserves spent-resource progress and survives reload', async () => {
  const { director, session, storage } = createActiveDay();

  await director.interact(DAY_ONE_V01.ids.woodlot);
  await director.interact(DAY_ONE_V01.ids.woodlot);
  await director.interact(DAY_ONE_V01.ids.woodlot);
  let state = session.dayOne;
  assert.equal(state.inventory.wood, 6);
  assert.equal(state.activity.woodGathered, 6);
  assert.equal(director.currentObjective().id, 'day-one-catch-fish');

  await director.interact(DAY_ONE_V01.ids.fishingSpot);
  state = session.dayOne;
  assert.equal(state.inventory.rawFish, 1);
  assert.equal(state.activity.fishCaught, 1);
  assert.equal(director.currentObjective().id, 'day-one-light-fire');

  await director.interact(DAY_ONE_V01.ids.campfire);
  assert.equal(session.dayOne.inventory.wood, 5);
  assert.equal(session.dayOne.camp.fireLit, true);
  assert.equal(director.promptFor(DAY_ONE_V01.ids.campfire), DAY_ONE_V01.prompts.cookFish);

  await director.interact(DAY_ONE_V01.ids.campfire);
  assert.deepEqual(
    {
      raw: session.dayOne.inventory.rawFish,
      cooked: session.dayOne.inventory.cookedFish,
      cookedTotal: session.dayOne.activity.mealsCooked,
    },
    { raw: 0, cooked: 1, cookedTotal: 1 },
  );

  await director.interact(DAY_ONE_V01.ids.campfire);
  state = session.dayOne;
  assert.equal(state.activity.mealsEaten, 1);
  assert.equal(state.inventory.cookedFish, 0);
  assert.ok(state.energy > 20, 'the meal should restore labor energy');
  assert.ok(state.nourishment > 49, 'the meal should restore nourishment');

  await director.interact(DAY_ONE_V01.ids.garden);
  assert.equal(session.dayOne.garden.planted, true);
  assert.equal(session.dayOne.inventory.seeds, 0);
  await director.interact(DAY_ONE_V01.ids.garden);
  assert.equal(session.dayOne.garden.watered, true);

  const completionMessage = await director.interact(DAY_ONE_V01.ids.shelter);
  state = session.dayOne;
  assert.equal(state.camp.shelterRepaired, true);
  assert.equal(state.inventory.wood, 1);
  assert.equal(
    state.activity.woodGathered,
    6,
    'durable gathered total must not fall when fire and shelter consume wood',
  );
  assert.equal(state.complete, true);
  assert.equal(session.hasEvent(DAY_ONE_V01.events.afternoonComplete), true);
  assert.match(completionMessage, /Community Ledger waits/);
  assert.equal(director.currentObjective().id, 'day-one-sign-ledger');

  const restored = new GameSession({ storage });
  assert.equal(restored.dayOne.complete, true);
  assert.equal(restored.dayOne.activity.woodGathered, 6);
  assert.equal(restored.dayOne.inventory.wood, 1);
  assert.equal(restored.hasEvent(DAY_ONE_V01.events.afternoonComplete), true);

  const hudState = director.stateForHud();
  assert.equal(hudState.nourishment.name, 'Nourishment');
  assert.match(hudState.nourishment.valueText, /of 100/);
  assert.equal(hudState.energy.name, 'Energy');
  assert.deepEqual(hudState.essentials, {
    wood: 1,
    fish: 0,
    rawFish: 0,
    cookedFish: 0,
    seeds: 0,
    coins: 8,
    doctorDebt: 0,
  });
});

test('exhaustion is an atomic, nonlethal recovery that retains progress and records doctor debt', async () => {
  const storage = new MemoryStorage();
  const locks = [];
  const actionController = new DayOneActionController({
    control: {
      setActionLocked(locked) {
        locks.push(locked);
      },
    },
  });
  let callbackPayload = null;
  let releaseRecovery;
  const recoveryGate = new Promise((resolve) => {
    releaseRecovery = resolve;
  });
  const { director, session } = createActiveDay({
    storage,
    actionController,
    async onPassOut(payload) {
      callbackPayload = payload;
      const saved = JSON.parse(storage.getItem(session.storageKey));
      assert.equal(saved.dayOne.passedOutCount, 1, 'callback runs after save');
      await recoveryGate;
    },
  });
  session.transact((draft) => {
    draft.dayOne.energy = 5;
    draft.dayOne.nourishment = 12;
    draft.dayOne.coins = 2;
    draft.dayOne.inventory.wood = 3;
    draft.dayOne.activity.woodGathered = 4;
  });

  const recovery = director.interact(DAY_ONE_V01.ids.woodlot);
  await Promise.resolve();
  assert.equal(director.isInteractableEnabled(DAY_ONE_V01.ids.woodlot), false);
  assert.equal(
    await director.interact(DAY_ONE_V01.ids.woodlot),
    DAY_ONE_V01.messages.busy,
    'a second key press cannot mutate while recovery presentation is pending',
  );

  let state = session.dayOne;
  assert.equal(state.inventory.wood, 3);
  assert.equal(state.activity.woodGathered, 4);
  assert.equal(state.energy, DAY_ONE_V01.tuning.meters.recoveryEnergy);
  assert.equal(state.nourishment, DAY_ONE_V01.tuning.meters.recoveryNourishment);
  assert.equal(state.coins, 0);
  assert.equal(state.doctorDebt, 2);
  assert.equal(state.passedOutCount, 1);
  assert.equal(callbackPayload.paid, 2);
  assert.equal(callbackPayload.debtAdded, 2);
  assert.equal(actionController.isActive, false, 'pass-out recovery bypasses the labor clock');
  assert.deepEqual(locks, [], 'pass-out recovery does not leave an action movement lock behind');

  releaseRecovery();
  const message = await recovery;
  assert.match(message, /now owe 2 more/);
  assert.equal(director.isInteractableEnabled(DAY_ONE_V01.ids.woodlot), true);

  state = session.dayOne;
  assert.equal(state.inventory.wood, 3, 'the failed labor action is not replayed after recovery');
});

test('lighting, cooking, and eating cost no energy so an exhausted player cannot softlock', async () => {
  const { director, session } = createActiveDay();
  session.transact((draft) => {
    draft.dayOne.energy = 0;
    draft.dayOne.nourishment = 0;
    draft.dayOne.inventory.wood = 1;
    draft.dayOne.inventory.rawFish = 1;
    draft.dayOne.activity.woodGathered = 1;
    draft.dayOne.activity.fishCaught = 1;
  });

  const emptyHud = director.stateForHud();
  assert.equal(emptyHud.energy.label, 'Spent');
  assert.equal(emptyHud.nourishment.label, 'Empty');

  await director.interact(DAY_ONE_V01.ids.campfire);
  assert.equal(session.dayOne.energy, 0);
  await director.interact(DAY_ONE_V01.ids.campfire);
  assert.equal(session.dayOne.energy, 0);
  await director.interact(DAY_ONE_V01.ids.campfire);

  const state = session.dayOne;
  assert.equal(state.passedOutCount, 0);
  assert.equal(state.inventory.cookedFish, 0);
  assert.equal(state.activity.mealsEaten, 1);
  assert.equal(state.energy, DAY_ONE_V01.tuning.mealRecovery.energy);
  assert.equal(state.nourishment, DAY_ONE_V01.tuning.mealRecovery.nourishment);
  assert.equal(director.stateForHud().energy.label, 'Tiring');
  assert.equal(director.stateForHud().nourishment.label, 'Peckish');
});

test('every remaining Day One chore locks movement and commits exactly once at its visible cue', async () => {
  const cases = [
    {
      name: 'chop wood',
      id: DAY_ONE_V01.ids.woodlot,
      actionKey: 'chopWood',
      verify(state) {
        assert.equal(state.inventory.wood, 2);
        assert.equal(state.activity.woodGathered, 2);
      },
    },
    {
      name: 'catch fish',
      id: DAY_ONE_V01.ids.fishingSpot,
      actionKey: 'catchFish',
      verify(state) {
        assert.equal(state.inventory.rawFish, 1);
        assert.equal(state.activity.fishCaught, 1);
      },
    },
    {
      name: 'light fire at zero energy',
      id: DAY_ONE_V01.ids.campfire,
      actionKey: 'lightFire',
      prepare(state) {
        state.energy = 0;
        state.nourishment = 0;
        state.inventory.wood = 1;
      },
      verify(state) {
        assert.equal(state.camp.fireLit, true);
        assert.equal(state.inventory.wood, 0);
        assert.equal(state.energy, 0);
        assert.equal(state.passedOutCount, 0);
      },
    },
    {
      name: 'cook fish at zero energy',
      id: DAY_ONE_V01.ids.campfire,
      actionKey: 'cookFish',
      prepare(state) {
        state.energy = 0;
        state.nourishment = 0;
        state.camp.fireLit = true;
        state.inventory.rawFish = 1;
      },
      verify(state) {
        assert.equal(state.inventory.rawFish, 0);
        assert.equal(state.inventory.cookedFish, 1);
        assert.equal(state.activity.mealsCooked, 1);
        assert.equal(state.energy, 0);
        assert.equal(state.passedOutCount, 0);
      },
    },
    {
      name: 'eat fish at zero energy',
      id: DAY_ONE_V01.ids.campfire,
      actionKey: 'eatFish',
      prepare(state) {
        state.energy = 0;
        state.nourishment = 0;
        state.camp.fireLit = true;
        state.inventory.cookedFish = 1;
      },
      verify(state) {
        assert.equal(state.inventory.cookedFish, 0);
        assert.equal(state.activity.mealsEaten, 1);
        assert.equal(state.energy, DAY_ONE_V01.tuning.mealRecovery.energy);
        assert.equal(state.nourishment, DAY_ONE_V01.tuning.mealRecovery.nourishment);
        assert.equal(state.passedOutCount, 0);
      },
    },
    {
      name: 'repair shelter',
      id: DAY_ONE_V01.ids.shelter,
      actionKey: 'repairShelter',
      prepare(state) {
        state.inventory.wood = DAY_ONE_V01.tuning.shelterWoodCost;
      },
      verify(state) {
        assert.equal(state.inventory.wood, 0);
        assert.equal(state.camp.shelterRepaired, true);
      },
    },
  ];

  for (const chore of cases) {
    const locks = [];
    const actionController = new DayOneActionController({
      control: {
        setActionLocked(locked, options) {
          locks.push({ locked, options });
        },
      },
    });
    const { director, session } = createActiveDay({ actionController });
    if (chore.prepare) {
      session.transact((draft) => chore.prepare(draft.dayOne));
    }
    const action = DAY_ONE_V01.actions[chore.actionKey];
    assert.equal(director.actionFor(chore.id), action, chore.name);
    const before = session.dayOne;
    const context = { targetPosition: { x: 4, y: 0, z: -2 } };
    const result = director.interact(chore.id, context);

    assert.equal(actionController.snapshot.id, action.id, chore.name);
    assert.equal(locks.length, 1, chore.name);
    assert.equal(locks[0].locked, true, chore.name);
    assert.equal(locks[0].options.context, context, chore.name);
    actionController.update(action.commitTime - 0.01);
    assert.deepEqual(session.dayOne, before, `${chore.name} changed before contact`);

    actionController.update(0.02);
    chore.verify(session.dayOne);
    const afterContact = session.dayOne;
    actionController.update(action.duration);
    await result;
    actionController.update(action.duration * 2);

    assert.deepEqual(session.dayOne, afterContact, `${chore.name} committed more than once`);
    assert.deepEqual(locks.map(({ locked }) => locked), [true, false], chore.name);
  }
});

test('v2 saves backfill Day One only when the Ledger was already signed', () => {
  const storage = new MemoryStorage();
  const base = {
    version: 2,
    phase: 'day-routine',
    neighborliness: 55,
    relationship: { steward: 'warm' },
    playerName: null,
    rulesKnown: [],
    choices: {},
    ending: null,
    updatedAt: 42,
  };

  storage.setItem('thornvale.core-hook-v03', JSON.stringify({
    ...base,
    eventsSeen: ['arrival-letter-seen', DAY_ONE_V01.events.stewardMet],
  }));
  let migrated = new GameSession({ storage });
  assert.equal(migrated.snapshot().version, GAME_SESSION_VERSION);
  assert.equal(migrated.dayOne.complete, false);
  assert.equal(migrated.hasEvent(DAY_ONE_V01.events.afternoonComplete), false);

  storage.setItem('thornvale.core-hook-v03', JSON.stringify({
    ...base,
    eventsSeen: [
      'arrival-letter-seen',
      DAY_ONE_V01.events.stewardMet,
      DAY_ONE_V01.events.ledgerSigned,
    ],
  }));
  migrated = new GameSession({ storage });
  assert.equal(migrated.dayOne.complete, true);
  assert.equal(migrated.dayOne.activity.woodGathered, 6);
  assert.equal(migrated.dayOne.activity.mealsEaten, 1);
  assert.equal(migrated.dayOne.garden.watered, true);
  assert.equal(migrated.dayOne.camp.shelterRepaired, true);
  assert.equal(migrated.hasEvent(DAY_ONE_V01.events.afternoonComplete), true);
  assert.equal(JSON.parse(storage.getItem(migrated.storageKey)).version, GAME_SESSION_VERSION);
});

test('Ledger signing closes Day One interactions without discarding the completed slice', async () => {
  const { director, session } = createActiveDay();
  session.transact((draft) => {
    const state = draft.dayOne;
    state.activity.woodGathered = 6;
    state.activity.fishCaught = 1;
    state.activity.mealsCooked = 1;
    state.activity.mealsEaten = 1;
    state.activity.seedsPlanted = 1;
    state.garden.planted = true;
    state.garden.watered = true;
    state.camp.fireLit = true;
    state.camp.shelterRepaired = true;
    state.complete = true;
    draft.eventsSeen.push(DAY_ONE_V01.events.afternoonComplete);
  });
  session.transact((draft) => {
    draft.eventsSeen.push(DAY_ONE_V01.events.ledgerSigned);
  });

  assert.equal(director.isComplete(), true);
  assert.equal(director.isInteractableEnabled(DAY_ONE_V01.ids.woodlot), false);
  assert.equal(director.currentObjective(), null);
  assert.match(
    await director.interact(DAY_ONE_V01.ids.woodlot),
    /after you meet Thornvale’s steward/,
  );
  assert.equal(session.dayOne.complete, true);
});

test('planting and watering remain unchanged until their visible commit cues', async () => {
  const actionController = new DayOneActionController();
  const { director, session } = createActiveDay({ actionController });
  const startingEnergy = session.dayOne.energy;

  const planting = director.interact(DAY_ONE_V01.ids.garden);
  assert.equal(actionController.snapshot.id, DAY_ONE_V01.actions.plantSeed.id);
  actionController.update(2.29);
  assert.equal(session.dayOne.garden.planted, false);
  assert.equal(session.dayOne.inventory.seeds, 1);
  assert.equal(session.dayOne.energy, startingEnergy);

  actionController.update(0.02);
  assert.equal(session.dayOne.garden.planted, true);
  assert.equal(session.dayOne.inventory.seeds, 0);
  assert.equal(session.dayOne.energy, startingEnergy - DAY_ONE_V01.tuning.labor.plant.energy);
  actionController.update(1);
  assert.match(await planting, /settles into the dark soil/);

  const beforeWater = session.dayOne.energy;
  const watering = director.interact(DAY_ONE_V01.ids.garden);
  actionController.update(2.34);
  assert.equal(session.dayOne.garden.watered, false);
  assert.equal(session.dayOne.energy, beforeWater);

  actionController.update(0.02);
  assert.equal(session.dayOne.garden.watered, true);
  assert.equal(session.dayOne.energy, beforeWater - DAY_ONE_V01.tuning.labor.water.energy);
  actionController.update(1);
  assert.match(await watering, /soil darkens/);
});

test('a garden action revalidates its resources at contact and exits stale state gracefully', async () => {
  const actionController = new DayOneActionController();
  const { director, session } = createActiveDay({ actionController });
  const startingEnergy = session.dayOne.energy;

  const planting = director.interact(DAY_ONE_V01.ids.garden);
  session.transact((draft) => {
    draft.dayOne.inventory.seeds = 0;
  });
  actionController.update(4);

  assert.equal(await planting, DAY_ONE_V01.messages.actionChanged);
  assert.equal(session.dayOne.garden.planted, false);
  assert.equal(session.dayOne.activity.seedsPlanted, 0);
  assert.equal(session.dayOne.energy, startingEnergy);
});

test('a failing GameSession projection listener cannot turn a committed action into failure', async () => {
  const actionController = new DayOneActionController();
  const { director, session, storage } = createActiveDay({ actionController });
  let warnings = 0;
  const originalWarn = console.warn;
  console.warn = () => { warnings += 1; };
  session.subscribe(() => {
    throw new Error('projection failed');
  });

  try {
    const planting = director.interact(DAY_ONE_V01.ids.garden);
    actionController.update(4);
    assert.match(await planting, /settles into the dark soil/);
    assert.equal(session.dayOne.garden.planted, true);
    assert.equal(JSON.parse(storage.getItem(session.storageKey)).dayOne.garden.planted, true);
    assert.ok(warnings >= 1);
  } finally {
    console.warn = originalWarn;
  }
});
