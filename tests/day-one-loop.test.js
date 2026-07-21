import test from 'node:test';
import assert from 'node:assert/strict';

import { DAY_ONE_V01 } from '../src/content/day-one-v01.js';
import { STEWARDSHIP_V01 } from '../src/content/stewardship-v01.js';
import { DayOneDirector } from '../src/game/DayOneDirector.js';
import { GameSession, GAME_ITEM_IDS } from '../src/game/GameSession.js';
import { selectDayOneState } from '../src/game/dayOneState.js';

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

function activateDay(session, { signed = true } = {}) {
  session.transact((draft) => {
    draft.phase = 'day-routine';
    draft.playerName = signed ? 'Juniper Vale' : null;
    draft.eventsSeen.push('arrival-letter-seen', DAY_ONE_V01.events.stewardMet);
    if (signed) draft.eventsSeen.push(DAY_ONE_V01.events.ledgerSigned);
  });
}

function createActiveDay(options = {}) {
  const storage = options.storage ?? new MemoryStorage();
  let now = 100;
  const session = new GameSession({ storage, now: () => ++now });
  activateDay(session);
  const director = new DayOneDirector({ session, ...options.director });
  return { director, session, storage };
}

test('Day One unlocks after enrollment and points wood gathering at the real Axe and trees', () => {
  const session = new GameSession({ storage: null });
  const director = new DayOneDirector({ session });

  assert.equal(director.isInteractableEnabled(DAY_ONE_V01.ids.woodlot), false);
  assert.equal(director.currentObjective().id, DAY_ONE_V01.objectives.meetSteward.id);

  activateDay(session, { signed: false });
  assert.equal(director.currentObjective().id, DAY_ONE_V01.objectives.signLedger.id);

  session.transact((draft) => {
    draft.playerName = 'Juniper Vale';
    draft.eventsSeen.push(DAY_ONE_V01.events.ledgerSigned);
  });
  let objective = director.currentObjective();
  assert.equal(objective.id, DAY_ONE_V01.objectives.gatherWood.id);
  assert.equal(objective.target.id, STEWARDSHIP_V01.ids.axePickup);

  session.transact((draft) => {
    draft.player.tools.owned.push(STEWARDSHIP_V01.tools.axe);
    draft.player.equipment.axe = STEWARDSHIP_V01.tools.axe;
  });
  objective = director.currentObjective();
  assert.equal(objective.target.id, STEWARDSHIP_V01.trees[0].id);
});

test('the first-afternoon loop consumes global inventory and persists one coherent save', async () => {
  const { director, session, storage } = createActiveDay();

  await director.interact(DAY_ONE_V01.ids.woodlot);
  await director.interact(DAY_ONE_V01.ids.woodlot);
  await director.interact(DAY_ONE_V01.ids.woodlot);
  let state = selectDayOneState(session.snapshot());
  assert.equal(state.inventory.wood, 6);
  assert.equal(state.activity.woodGathered, 6);
  assert.equal(session.snapshot().activities.woodcutting.woodHarvested, 6);

  await director.interact(DAY_ONE_V01.ids.fishingSpot);
  state = selectDayOneState(session.snapshot());
  assert.equal(state.inventory.rawFish, 1);
  assert.equal(state.activity.fishCaught, 1);
  assert.equal(session.snapshot().activities.fishing.totalCaught, 1);

  await director.interact(DAY_ONE_V01.ids.campfire);
  assert.equal(session.snapshot().world.camp.fireLit, true);
  await director.interact(DAY_ONE_V01.ids.campfire);
  assert.equal(selectDayOneState(session.snapshot()).inventory.cookedFish, 1);
  await director.interact(DAY_ONE_V01.ids.campfire);
  assert.equal(selectDayOneState(session.snapshot()).activity.mealsEaten, 1);

  await director.interact(DAY_ONE_V01.ids.garden);
  await director.interact(DAY_ONE_V01.ids.garden);
  await director.interact(DAY_ONE_V01.ids.shelter);

  state = selectDayOneState(session.snapshot());
  assert.equal(state.complete, true);
  assert.equal(state.inventory.wood, 1);
  assert.equal(state.inventory.rawFish + state.inventory.cookedFish, 0);
  assert.equal(state.garden.watered, true);
  assert.equal(state.camp.shelterRepaired, true);
  assert.equal(session.hasEvent(DAY_ONE_V01.events.afternoonComplete), true);

  const restored = new GameSession({ storage });
  assert.deepEqual(restored.snapshot(), session.snapshot());
  assert.equal(selectDayOneState(restored.snapshot()).complete, true);
});

test('the readable Ledger derives its historical account from global consequences', async () => {
  const { director, session } = createActiveDay();
  await director.interact(DAY_ONE_V01.ids.woodlot);
  await director.interact(DAY_ONE_V01.ids.fishingSpot);

  const record = director.ledgerRecordFor();
  assert.match(record.entry, /WOOD GATHERED · 2 \/ 6/);
  assert.match(record.entry, /PONDFISH CAUGHT · 1 \/ 1/);
  assert.match(record.entry, /CAMPFIRE LIT · AWAITING/);
  assert.equal(record.signature, 'Juniper Vale');
  assert.equal(session.snapshot().player.inventory.stackables[GAME_ITEM_IDS.wood], 2);
});

test('exhaustion atomically recovers the player, retains inventory, and records debt', async () => {
  const statuses = [];
  let recoveryPayload = null;
  const { director, session, storage } = createActiveDay({
    director: {
      onStatus: (message) => statuses.push(message),
      onPassOut: async (payload) => {
        recoveryPayload = payload;
        const saved = JSON.parse(storage.getItem(session.storageKey));
        assert.equal(saved.player.passedOutCount, 1);
      },
    },
  });
  session.transact((draft) => {
    draft.player.meters.energy = 0;
    draft.player.economy.coins = 2;
    draft.player.inventory.stackables[GAME_ITEM_IDS.wood] = 3;
    draft.activities.woodcutting.woodHarvested = 3;
    draft.chapters.dayOne.account.woodGathered = 3;
  });

  await director.interact(DAY_ONE_V01.ids.woodlot);
  const state = selectDayOneState(session.snapshot());
  assert.equal(state.energy, DAY_ONE_V01.tuning.meters.recoveryEnergy);
  assert.equal(state.inventory.wood, 3);
  assert.equal(state.coins, 0);
  assert.equal(state.doctorDebt, 2);
  assert.equal(state.passedOutCount, 1);
  assert.equal(recoveryPayload.recoverySite, 'gate');
  assert.match(statuses.at(-1), /owe 2 more/);
});

test('a repaired shelter becomes the nonlethal recovery point', async () => {
  let recoveryPayload = null;
  const { director, session } = createActiveDay({
    director: { onPassOut: async (payload) => { recoveryPayload = payload; } },
  });
  session.transact((draft) => {
    draft.player.inventory.stackables[GAME_ITEM_IDS.wood] = DAY_ONE_V01.tuning.shelterWoodCost;
    draft.activities.woodcutting.woodHarvested = DAY_ONE_V01.tuning.shelterWoodCost;
    draft.chapters.dayOne.account.woodGathered = DAY_ONE_V01.tuning.shelterWoodCost;
  });
  await director.interact(DAY_ONE_V01.ids.shelter);
  session.transact((draft) => { draft.player.meters.energy = 0; });
  await director.interact(DAY_ONE_V01.ids.woodlot);
  assert.equal(recoveryPayload.recoverySite, 'shelter');
  assert.equal(recoveryPayload.snapshot.world.camp.shelterRepaired, true);
});

test('lighting, cooking, and eating cost no energy and cannot softlock an exhausted player', async () => {
  const { director, session } = createActiveDay();
  session.transact((draft) => {
    draft.player.meters.energy = 0;
    draft.player.inventory.stackables[GAME_ITEM_IDS.wood] = 1;
    draft.activities.woodcutting.woodHarvested = 1;
    draft.chapters.dayOne.account.woodGathered = 1;
    draft.activities.fishing.totalCaught = 1;
    draft.activities.fishing.caughtBySpecies['fish.pond-dace'] = 1;
    draft.activities.fishing.largestCmBySpecies['fish.pond-dace'] = 18;
    draft.chapters.dayOne.account.fishCaught = 1;
    draft.player.inventory.specimens['catch-0001'] = {
      itemId: 'fish.pond-dace', condition: 'raw', lengthCm: 18, quality: 'ordinary', caughtAt: 'pond',
    };
    draft.player.inventory.nextSpecimenSequence = 2;
  });

  await director.interact(DAY_ONE_V01.ids.campfire);
  await director.interact(DAY_ONE_V01.ids.campfire);
  assert.equal(selectDayOneState(session.snapshot()).energy, 0);
  await director.interact(DAY_ONE_V01.ids.campfire);
  assert.ok(selectDayOneState(session.snapshot()).energy > 0);
});

test('a stale garden action never spends a seed or commits twice', async () => {
  let commit;
  const actionController = {
    async run(_action, options) {
      commit = options.onCommit;
      return { committed: false };
    },
  };
  const { director, session } = createActiveDay({ director: { actionController } });
  const pending = director.interact(DAY_ONE_V01.ids.garden);
  await pending;
  const before = session.snapshot();
  assert.deepEqual(session.snapshot(), before);
  const first = commit();
  const second = commit();
  assert.equal(first.applied, true);
  assert.equal(second.applied, false);
  assert.equal(selectDayOneState(session.snapshot()).inventory.seeds, 0);
  assert.equal(session.snapshot().activities.gardening.seedsPlanted, 1);
});

test('projection listener failures cannot turn a committed global action into failure', async () => {
  const { director, session } = createActiveDay();
  const originalWarn = console.warn;
  console.warn = () => {};
  const unsubscribe = session.subscribe(() => { throw new Error('projection failed'); });
  try {
    await director.interact(DAY_ONE_V01.ids.woodlot);
  } finally {
    unsubscribe();
    console.warn = originalWarn;
  }
  assert.equal(selectDayOneState(session.snapshot()).inventory.wood, 2);
});

test('unsupported old save shapes reset instead of migrating hidden chapter inventory', () => {
  const storage = new MemoryStorage();
  storage.setItem('thornvale.game-session-v1', JSON.stringify({
    version: 4,
    phase: 'day-routine',
    dayOne: { complete: true },
  }));
  const session = new GameSession({ storage });
  assert.equal(session.phase, 'arrival');
  assert.equal(Object.hasOwn(session.snapshot(), 'dayOne'), false);
  assert.equal(storage.getItem('thornvale.game-session-v1'), null);
});
