import assert from 'node:assert/strict';
import test from 'node:test';

import {
  STEWARDSHIP_TREE_IDS,
  STEWARDSHIP_V01,
} from '../src/content/stewardship-v01.js';
import { DAY_ONE_V01 } from '../src/content/day-one-v01.js';
import { DayOneDirector } from '../src/game/DayOneDirector.js';
import { GameSession } from '../src/game/GameSession.js';
import { WoodcuttingDirector } from '../src/game/WoodcuttingDirector.js';

function clone(value) {
  return structuredClone(value);
}

class FakeSession {
  constructor(state = createState()) {
    this.state = clone(state);
  }

  snapshot() {
    return clone(this.state);
  }

  transact(mutator) {
    const draft = this.snapshot();
    mutator(draft);
    this.state = draft;
    return this.snapshot();
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
    world: {
      trees: {
        nextPlayerTreeSequence: 1,
        byId: Object.fromEntries(STEWARDSHIP_V01.trees.map((tree) => [tree.id, {
          definitionId: tree.definitionId,
          stage: tree.stage,
          hitCount: tree.hitCount,
          plantingSiteId: tree.plantingSiteId,
        }])),
      },
    },
    activities: {
      woodcutting: { woodHarvested: 0, treesFelled: 0, treesPlanted: 0 },
      fishing: { totalCaught: 0, caughtBySpecies: {}, largestCmBySpecies: {} },
      cooking: { mealsCooked: 0, mealsEaten: 0 },
      gardening: { seedsPlanted: 0 },
    },
  };
}

test('stewardship content exposes three stable authored trees and one planting site', () => {
  assert.deepEqual(STEWARDSHIP_TREE_IDS, [
    'tree.grove.01',
    'tree.grove.02',
    'tree.grove.03',
  ]);
  assert.equal(STEWARDSHIP_V01.trees.length, 3);
  assert.equal(STEWARDSHIP_V01.plantingSites.length, 1);
  for (const tree of STEWARDSHIP_V01.trees) {
    assert.equal(tree.requiredHits, 3);
    assert.equal(tree.rewards['resource.wood'], 6);
    assert.equal(tree.rewards['seed.tree.common'], 1);
    assert.equal(Object.isFrozen(tree), true);
  }
});

test('finding the axe globally owns and equips it before tree strikes become available', () => {
  const session = new FakeSession();
  const director = new WoodcuttingDirector({ session });
  const treeId = STEWARDSHIP_TREE_IDS[0];

  assert.equal(director.isInteractableEnabled(treeId), false);
  const blocked = director.strikeTree(treeId);
  assert.equal(blocked.applied, false);
  assert.equal(blocked.reason, 'axe-required');

  const pickup = director.collectAxe();
  assert.equal(pickup.applied, true);
  assert.deepEqual(session.state.player.tools.owned, [
    'tool.rod.simple',
    'tool.axe.friendsies',
  ]);
  assert.equal(session.state.player.equipment.axe, 'tool.axe.friendsies');
  assert.equal(director.isInteractableEnabled(treeId), true);

  const repeated = director.collectAxe();
  assert.equal(repeated.applied, false);
  assert.equal(session.state.player.tools.owned.filter(
    (id) => id === 'tool.axe.friendsies',
  ).length, 1);
});

test('a mature tree takes three committed contacts and pays its final reward exactly once', () => {
  const session = new FakeSession();
  const director = new WoodcuttingDirector({ session });
  const treeId = STEWARDSHIP_TREE_IDS[0];
  director.collectAxe();

  const first = director.strikeTree(treeId);
  const second = director.strikeTree(treeId);
  assert.deepEqual(
    [first.hitCount, second.hitCount, first.felled, second.felled],
    [1, 2, false, false],
  );
  assert.equal(session.state.player.inventory.stackables['resource.wood'], 0);
  assert.equal(session.state.player.inventory.stackables['seed.tree.common'], 0);

  const final = director.strikeTree(treeId);
  assert.equal(final.applied, true);
  assert.equal(final.felled, true);
  assert.equal(final.hitCount, 3);
  assert.equal(session.state.world.trees.byId[treeId].stage, 'stump');
  assert.equal(session.state.player.inventory.stackables['resource.wood'], 6);
  assert.equal(session.state.player.inventory.stackables['seed.tree.common'], 1);
  assert.deepEqual(session.state.activities.woodcutting, {
    woodHarvested: 6,
    treesFelled: 1,
    treesPlanted: 0,
  });
  assert.equal(session.state.player.meters.energy, 34);
  assert.equal(session.state.player.meters.nourishment, 54);

  const duplicate = director.strikeTree(treeId);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.reason, 'not-mature');
  assert.equal(session.state.player.inventory.stackables['resource.wood'], 6);
  assert.equal(session.state.player.inventory.stackables['seed.tree.common'], 1);
  assert.equal(session.state.activities.woodcutting.treesFelled, 1);
});

test('each authored tree has independent progress and a one-time harvest', () => {
  const session = new FakeSession();
  const director = new WoodcuttingDirector({
    session,
    laborCost: { energy: 0, nourishment: 0 },
  });
  director.collectAxe();

  for (const treeId of STEWARDSHIP_TREE_IDS) {
    for (let hit = 0; hit < 3; hit += 1) director.strikeTree(treeId);
  }

  assert.ok(STEWARDSHIP_TREE_IDS.every(
    (treeId) => session.state.world.trees.byId[treeId].stage === 'stump',
  ));
  assert.equal(session.state.player.inventory.stackables['resource.wood'], 18);
  assert.equal(session.state.player.inventory.stackables['seed.tree.common'], 3);
  assert.equal(session.state.activities.woodcutting.woodHarvested, 18);
  assert.equal(session.state.activities.woodcutting.treesFelled, 3);
});

test('woodcutting keeps the completed Day One account historical while lifetime totals continue', () => {
  const state = createState();
  const completedTree = STEWARDSHIP_TREE_IDS[0];
  state.world.trees.byId[completedTree].stage = 'stump';
  state.world.trees.byId[completedTree].hitCount = 3;
  state.activities.woodcutting.woodHarvested = 6;
  state.activities.woodcutting.treesFelled = 1;
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
  const director = new WoodcuttingDirector({ session });
  director.collectAxe();

  for (let hit = 0; hit < 3; hit += 1) {
    director.strikeTree(STEWARDSHIP_TREE_IDS[1]);
  }

  assert.equal(session.state.activities.woodcutting.woodHarvested, 12);
  assert.equal(session.state.activities.woodcutting.treesFelled, 2);
  assert.deepEqual(session.state.chapters.dayOne.account, state.chapters.dayOne.account);
});

test('an under-energy tree strike uses the standard recoverable pass-out transaction', async () => {
  const session = new GameSession({ storage: null, now: () => 101 });
  session.transact((draft) => {
    draft.player.meters.energy = DAY_ONE_V01.tuning.labor.chop.energy - 1;
  });
  let recoveryPayload = null;
  const dayOneDirector = new DayOneDirector({
    session,
    onPassOut: (payload) => { recoveryPayload = payload; },
  });
  const director = new WoodcuttingDirector({
    session,
    onExhausted: () => dayOneDirector.recoverFromExhaustion(),
  });
  director.collectAxe();

  const outcome = director.strikeTree(STEWARDSHIP_TREE_IDS[0]);
  await Promise.resolve();
  const snapshot = session.snapshot();

  assert.equal(outcome.applied, false);
  assert.equal(outcome.reason, 'exhausted');
  assert.equal(snapshot.world.trees.byId[STEWARDSHIP_TREE_IDS[0]].hitCount, 0);
  assert.equal(snapshot.player.passedOutCount, 1);
  assert.equal(snapshot.player.meters.energy, DAY_ONE_V01.tuning.meters.recoveryEnergy);
  assert.equal(snapshot.player.meters.nourishment, DAY_ONE_V01.tuning.meters.recoveryNourishment);
  assert.equal(snapshot.player.economy.coins, 4);
  assert.equal(snapshot.player.economy.doctorDebt, 0);
  assert.equal(recoveryPayload.recoverySite, 'gate');
});

test('planting consumes one tree seed and creates one persistent player tree at the authored site', () => {
  const session = new FakeSession();
  const director = new WoodcuttingDirector({ session });
  const siteId = STEWARDSHIP_V01.ids.plantingSite;
  director.collectAxe();
  for (let hit = 0; hit < 3; hit += 1) director.strikeTree(STEWARDSHIP_TREE_IDS[0]);

  const planted = director.plantTree(siteId);
  assert.equal(planted.applied, true);
  assert.equal(planted.treeId, 'tree.player.0001');
  assert.equal(session.state.player.inventory.stackables['seed.tree.common'], 0);
  assert.deepEqual(session.state.world.trees.byId['tree.player.0001'], {
    definitionId: 'tree.common',
    stage: 'seedling',
    hitCount: 0,
    plantingSiteId: siteId,
  });
  assert.equal(session.state.world.trees.nextPlayerTreeSequence, 2);
  assert.equal(session.state.activities.woodcutting.treesPlanted, 1);

  const duplicate = director.plantTree(siteId);
  assert.equal(duplicate.applied, false);
  assert.equal(duplicate.reason, 'occupied');
  assert.equal(Object.keys(session.state.world.trees.byId).filter(
    (id) => id.startsWith('tree.player.'),
  ).length, 1);
  assert.equal(session.state.activities.woodcutting.treesPlanted, 1);
});
