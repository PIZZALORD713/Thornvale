import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_GAME_SESSION_STORAGE_KEY,
  GAME_ITEM_IDS,
  GAME_SESSION_VERSION,
  GAME_TOOL_IDS,
  GameSession,
  createDefaultGameSession,
  dayOneRequirementsMet,
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

function addPlayerTree(draft, overrides = {}) {
  draft.world.trees.byId['tree.player.0001'] = {
    definitionId: 'tree.common',
    stage: 'seedling',
    hitCount: 0,
    plantingSiteId: 'planting.grove.01',
    ...overrides,
  };
  draft.world.trees.nextPlayerTreeSequence = 2;
}

test('the clean schema promotes player, world, activity, and chapter state globally', () => {
  const state = createDefaultGameSession(42);

  assert.equal(state.version, 1);
  assert.equal(GAME_SESSION_VERSION, 1);
  assert.equal(DEFAULT_GAME_SESSION_STORAGE_KEY, 'thornvale.game-session-v1');
  assert.equal(Object.hasOwn(state, 'dayOne'), false);
  assert.deepEqual(state.player.inventory.stackables, {
    [GAME_ITEM_IDS.wood]: 0,
    [GAME_ITEM_IDS.gardenSeed]: 1,
    [GAME_ITEM_IDS.treeSeed]: 0,
    [GAME_ITEM_IDS.wormBait]: 0,
  });
  assert.deepEqual(state.player.tools.owned, [GAME_TOOL_IDS.simpleRod]);
  assert.equal(state.player.equipment.axe, null);
  assert.equal(state.player.equipment.rod, GAME_TOOL_IDS.simpleRod);
  assert.equal(state.world.trees.byId['tree.grove.01'].stage, 'mature');
  assert.deepEqual(state.activities.woodcutting, {
    woodHarvested: 0,
    treesFelled: 0,
    treesPlanted: 0,
  });
  assert.equal(state.chapters.dayOne.complete, false);
  assert.equal(dayOneRequirementsMet(state), false);
});

test('the new storage key ignores legacy state and exact-version failures reset safely', () => {
  const storage = new MemoryStorage();
  storage.setItem('thornvale.core-hook-v03', JSON.stringify({
    version: 4,
    phase: 'resolution',
  }));

  const clean = new GameSession({ storage, now: () => 10 });
  assert.equal(clean.storageKey, DEFAULT_GAME_SESSION_STORAGE_KEY);
  assert.equal(clean.phase, 'arrival');
  assert.notEqual(storage.getItem('thornvale.core-hook-v03'), null);

  const unsupported = createDefaultGameSession(11);
  unsupported.version = 2;
  storage.setItem(DEFAULT_GAME_SESSION_STORAGE_KEY, JSON.stringify(unsupported));
  const recovered = new GameSession({ storage, now: () => 12 });
  assert.equal(recovered.phase, 'arrival');
  assert.equal(storage.getItem(DEFAULT_GAME_SESSION_STORAGE_KEY), null);
  assert.match(recovered.lastStorageError.message, /unsupported|invalid/i);

  storage.setItem(DEFAULT_GAME_SESSION_STORAGE_KEY, '{not json');
  const malformed = new GameSession({ storage, now: () => 13 });
  assert.equal(malformed.phase, 'arrival');
  assert.equal(storage.getItem(DEFAULT_GAME_SESSION_STORAGE_KEY), null);
});

test('invalid inventory, loadout, and tree transactions leave the prior state untouched', () => {
  const session = new GameSession({ storage: null, now: () => 20 });
  const before = session.snapshot();

  assert.throws(() => {
    session.transact((draft) => {
      draft.player.inventory.stackables[GAME_ITEM_IDS.wood] = -1;
    });
  }, /invalid state/i);
  assert.deepEqual(session.snapshot(), before);

  assert.throws(() => {
    session.transact((draft) => {
      draft.player.equipment.axe = GAME_TOOL_IDS.friendsiesAxe;
    });
  }, /invalid state/i);
  assert.deepEqual(session.snapshot(), before);

  assert.throws(() => {
    session.transact((draft) => {
      draft.player.equipment.bait = GAME_ITEM_IDS.wormBait;
    });
  }, /invalid state/i);
  assert.deepEqual(session.snapshot(), before);

  assert.throws(() => {
    session.transact((draft) => {
      draft.world.trees.byId['tree.player.1'] = {
        definitionId: 'tree.common',
        stage: 'seedling',
        hitCount: 0,
        plantingSiteId: 'planting.grove.01',
      };
      draft.world.trees.byId['tree.player.2'] = {
        definitionId: 'tree.common',
        stage: 'seedling',
        hitCount: 0,
        plantingSiteId: 'planting.grove.01',
      };
      draft.world.trees.nextPlayerTreeSequence = 3;
    });
  }, /invalid state/i);
  assert.deepEqual(session.snapshot(), before);
});

test('v1 tree lifecycle rejects impossible transaction shapes without changing state', () => {
  const invalidMutations = [
    ['authored seedling', (draft) => {
      draft.world.trees.byId['tree.grove.01'].stage = 'seedling';
    }],
    ['fully hit mature tree', (draft) => {
      draft.world.trees.byId['tree.grove.01'].hitCount = 3;
    }],
    ['early stump', (draft) => {
      draft.world.trees.byId['tree.grove.01'].stage = 'stump';
      draft.world.trees.byId['tree.grove.01'].hitCount = 2;
    }],
    ['over-hit stump', (draft) => {
      draft.world.trees.byId['tree.grove.01'].stage = 'stump';
      draft.world.trees.byId['tree.grove.01'].hitCount = 4;
    }],
    ['mature player tree', (draft) => {
      addPlayerTree(draft, { stage: 'mature' });
    }],
    ['player tree at an unauthored site', (draft) => {
      addPlayerTree(draft, { plantingSiteId: 'planting.unknown.01' });
    }],
    ['player tree with an unauthored definition', (draft) => {
      addPlayerTree(draft, { definitionId: 'tree.impossible' });
    }],
    ['unknown non-player tree', (draft) => {
      draft.world.trees.byId['tree.unknown.01'] = {
        definitionId: 'tree.common',
        stage: 'mature',
        hitCount: 0,
        plantingSiteId: null,
      };
    }],
  ];

  for (const [label, mutate] of invalidMutations) {
    const session = new GameSession({ storage: null, now: () => 21 });
    const before = session.snapshot();
    assert.throws(() => session.transact(mutate), /invalid state/i, label);
    assert.deepEqual(session.snapshot(), before, label);
  }
});

test('impossible persisted tree shapes reset the whole save safely', () => {
  const invalidSaves = [
    ['authored seedling', (draft) => {
      draft.world.trees.byId['tree.grove.01'].stage = 'seedling';
    }],
    ['over-hit authored tree', (draft) => {
      draft.world.trees.byId['tree.grove.01'].stage = 'stump';
      draft.world.trees.byId['tree.grove.01'].hitCount = 4;
    }],
    ['mature player tree', (draft) => {
      addPlayerTree(draft, { stage: 'mature' });
    }],
    ['player tree at an unauthored site', (draft) => {
      addPlayerTree(draft, { plantingSiteId: 'planting.unknown.01' });
    }],
  ];

  for (const [label, mutate] of invalidSaves) {
    const storage = new MemoryStorage();
    const persisted = createDefaultGameSession(22);
    mutate(persisted);
    storage.setItem(DEFAULT_GAME_SESSION_STORAGE_KEY, JSON.stringify(persisted));

    const recovered = new GameSession({ storage, now: () => 23 });
    assert.deepEqual(
      recovered.snapshot().world.trees.byId,
      createDefaultGameSession(23).world.trees.byId,
      label,
    );
    assert.equal(storage.getItem(DEFAULT_GAME_SESSION_STORAGE_KEY), null, label);
    assert.match(recovered.lastStorageError.message, /unsupported|invalid/i, label);
  }
});

test('a v1 player-planted seedling at the authored planting site remains valid', () => {
  const storage = new MemoryStorage();
  const session = new GameSession({ storage, now: () => 24 });

  session.transact((draft) => addPlayerTree(draft));

  const restored = new GameSession({ storage, now: () => 25 }).snapshot();
  assert.deepEqual(restored.world.trees.byId['tree.player.0001'], {
    definitionId: 'tree.common',
    stage: 'seedling',
    hitCount: 0,
    plantingSiteId: 'planting.grove.01',
  });
  assert.equal(restored.world.trees.nextPlayerTreeSequence, 2);
});

test('global tool, tree, resource, and fish consequences round-trip together', () => {
  const storage = new MemoryStorage();
  let now = 100;
  const session = new GameSession({ storage, now: () => ++now });

  session.transact((draft) => {
    draft.player.tools.owned.push(GAME_TOOL_IDS.friendsiesAxe);
    draft.player.equipment.axe = GAME_TOOL_IDS.friendsiesAxe;

    draft.world.trees.byId['tree.grove.01'].stage = 'stump';
    draft.world.trees.byId['tree.grove.01'].hitCount = 3;
    draft.player.inventory.stackables[GAME_ITEM_IDS.wood] = 2;
    draft.player.inventory.stackables[GAME_ITEM_IDS.treeSeed] = 1;
    draft.activities.woodcutting.woodHarvested = 2;
    draft.activities.woodcutting.treesFelled = 1;

    draft.player.inventory.specimens['catch-0001'] = {
      itemId: 'fish.pond-dace',
      condition: 'raw',
      lengthCm: 18,
      quality: 'ordinary',
      caughtAt: 'pond.shallows',
    };
    draft.player.inventory.nextSpecimenSequence = 2;
    draft.activities.fishing.totalCaught = 1;
    draft.activities.fishing.caughtBySpecies['fish.pond-dace'] = 1;
    draft.activities.fishing.largestCmBySpecies['fish.pond-dace'] = 18;
  });

  const restored = new GameSession({ storage, now: () => ++now });
  const state = restored.snapshot();
  assert.equal(state.player.equipment.axe, GAME_TOOL_IDS.friendsiesAxe);
  assert.equal(state.world.trees.byId['tree.grove.01'].stage, 'stump');
  assert.equal(state.player.inventory.stackables[GAME_ITEM_IDS.wood], 2);
  assert.equal(state.player.inventory.stackables[GAME_ITEM_IDS.treeSeed], 1);
  assert.equal(state.activities.woodcutting.treesFelled, 1);
  assert.deepEqual(state.player.inventory.specimens['catch-0001'], {
    itemId: 'fish.pond-dace',
    condition: 'raw',
    lengthCm: 18,
    quality: 'ordinary',
    caughtAt: 'pond.shallows',
  });
  assert.equal(state.activities.fishing.largestCmBySpecies['fish.pond-dace'], 18);
});

test('Day One completion is derived from global consequences and gates dusk', () => {
  const session = new GameSession({ storage: null, now: () => 300 });

  assert.throws(() => {
    session.transact((draft) => {
      draft.phase = 'dusk';
      draft.eventsSeen.push(
        'arrival-letter-seen',
        'steward-lumen-met',
        'community-ledger-signed',
        'dusk-bell-rung',
      );
    });
  }, /invalid state/i);

  session.transact((draft) => {
    draft.phase = 'day-routine';
    draft.eventsSeen.push(
      'arrival-letter-seen',
      'steward-lumen-met',
      'community-ledger-signed',
    );
    Object.assign(draft.chapters.dayOne.account, {
      woodGathered: 6,
      fishCaught: 1,
      mealsCooked: 1,
      mealsEaten: 1,
      seedsPlanted: 1,
    });
    draft.activities.woodcutting.woodHarvested = 6;
    draft.activities.fishing.totalCaught = 1;
    draft.activities.fishing.caughtBySpecies['fish.pond-dace'] = 1;
    draft.activities.fishing.largestCmBySpecies['fish.pond-dace'] = 18;
    draft.activities.cooking.mealsCooked = 1;
    draft.activities.cooking.mealsEaten = 1;
    draft.activities.gardening.seedsPlanted = 1;
    draft.world.garden.planted = true;
    draft.world.garden.watered = true;
    draft.world.camp.shelterRepaired = true;
    draft.chapters.dayOne.complete = true;
  });

  assert.equal(dayOneRequirementsMet(session.snapshot()), true);
  assert.equal(session.snapshot().chapters.dayOne.complete, true);
  assert.equal(session.hasEvent(DAY_ONE_V01_EVENT), true);

  session.transact((draft) => {
    draft.phase = 'dusk';
    draft.eventsSeen.push('dusk-bell-rung');
  });
  assert.equal(session.phase, 'dusk');
});

const DAY_ONE_V01_EVENT = 'first-afternoon-complete';
