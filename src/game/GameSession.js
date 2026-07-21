import { DAY_ONE_V01 } from '../content/day-one-v01.js';
import { STEWARDSHIP_V01 } from '../content/stewardship-v01.js';

export const GAME_SESSION_VERSION = 1;
export const DEFAULT_GAME_SESSION_STORAGE_KEY = 'thornvale.game-session-v1';
export const MAX_PLAYER_NAME_LENGTH = 40;

export const GAME_ITEM_IDS = Object.freeze({
  wood: 'resource.wood',
  gardenSeed: 'seed.garden.common',
  treeSeed: 'seed.tree.common',
  wormBait: 'bait.worm',
});

export const GAME_TOOL_IDS = Object.freeze({
  friendsiesAxe: 'tool.axe.friendsies',
  simpleRod: 'tool.rod.simple',
});

export const TREE_STAGES = Object.freeze([
  'seedling',
  'sapling',
  'young',
  'mature',
  'stump',
]);

export const GAME_PHASES = Object.freeze([
  'arrival',
  'day-routine',
  'dusk',
  'night-investigation',
  'intervention',
  'resolution',
]);

const PHASE_SET = new Set(GAME_PHASES);
const TREE_STAGE_SET = new Set(TREE_STAGES);
const RELATIONSHIP_STATES = new Set(['guarded', 'warm', 'corrective']);
const ENDING_STATES = new Set(['assimilate', 'escape']);
const FISH_CONDITIONS = new Set(['raw', 'cooked']);
const CORE_EVENT_ORDER = Object.freeze([
  'arrival-letter-seen',
  'steward-lumen-met',
  'community-ledger-signed',
  'dusk-bell-rung',
  'night-bell-rang-itself',
  'false-ledger-record-seen',
  'steward-correction-heard',
  'ledger-record-choice-made',
  'core-hook-ending-seen',
]);
const AUTHORED_TREE_DEFINITIONS = new Map(
  STEWARDSHIP_V01.trees.map((tree) => [tree.id, tree]),
);
const AUTHORED_PLANTING_SITES = new Map(
  STEWARDSHIP_V01.plantingSites.map((site) => [site.id, site]),
);
const DEFAULT_TREE_IDS = Object.freeze([...AUTHORED_TREE_DEFINITIONS.keys()]);
const REQUIRED_STACKABLE_IDS = Object.freeze(Object.values(GAME_ITEM_IDS));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonNegativeInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function isPositiveInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
  return Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return null;
  if (value.some((item) => typeof item !== 'string' || item.length === 0)) return null;
  return [...new Set(value)];
}

function pushUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function cleanChoices(value) {
  if (!isPlainObject(value)) return null;
  const entries = Object.entries(value);
  if (entries.some(([key, choice]) => !key || typeof choice !== 'string' || !choice)) return null;
  return Object.fromEntries(entries);
}

function clampNeighborliness(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function resolveDefaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function createDefaultTrees() {
  return Object.fromEntries(DEFAULT_TREE_IDS.map((id) => {
    const definition = AUTHORED_TREE_DEFINITIONS.get(id);
    return [id, {
      definitionId: definition.definitionId,
      stage: definition.stage,
      hitCount: definition.hitCount,
      plantingSiteId: definition.plantingSiteId,
    }];
  }));
}

export function normalizePlayerName(value) {
  if (typeof value !== 'string') return '';
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(normalized).slice(0, MAX_PLAYER_NAME_LENGTH).join('');
}

export function createDefaultGameSession(now = Date.now()) {
  const tuning = DAY_ONE_V01.tuning;
  const timestamp = Number(now);
  return {
    version: GAME_SESSION_VERSION,
    phase: 'arrival',
    neighborliness: 50,
    relationship: {
      steward: 'guarded',
    },
    playerName: null,
    rulesKnown: [],
    choices: {},
    eventsSeen: [],
    ending: null,
    player: {
      meters: {
        nourishment: tuning.meters.startingNourishment,
        energy: tuning.meters.startingEnergy,
      },
      economy: {
        coins: tuning.startingCoins,
        doctorDebt: 0,
      },
      inventory: {
        stackables: {
          [GAME_ITEM_IDS.wood]: 0,
          [GAME_ITEM_IDS.gardenSeed]: 1,
          [GAME_ITEM_IDS.treeSeed]: 0,
          [GAME_ITEM_IDS.wormBait]: 0,
        },
        specimens: {},
        nextSpecimenSequence: 1,
      },
      tools: {
        owned: [GAME_TOOL_IDS.simpleRod],
        upgrades: {},
      },
      equipment: {
        axe: null,
        rod: GAME_TOOL_IDS.simpleRod,
        bait: null,
      },
      passedOutCount: 0,
    },
    world: {
      camp: {
        fireLit: false,
        shelterRepaired: false,
      },
      garden: {
        planted: false,
        watered: false,
      },
      trees: {
        nextPlayerTreeSequence: 1,
        byId: createDefaultTrees(),
      },
    },
    activities: {
      woodcutting: {
        woodHarvested: 0,
        treesFelled: 0,
        treesPlanted: 0,
      },
      fishing: {
        totalCaught: 0,
        caughtBySpecies: {},
        largestCmBySpecies: {},
      },
      cooking: {
        mealsCooked: 0,
        mealsEaten: 0,
      },
      gardening: {
        seedsPlanted: 0,
      },
    },
    chapters: {
      dayOne: {
        complete: false,
        account: {
          woodGathered: 0,
          fishCaught: 0,
          mealsCooked: 0,
          mealsEaten: 0,
          seedsPlanted: 0,
        },
      },
    },
    updatedAt: Number.isFinite(timestamp) ? timestamp : Date.now(),
  };
}

export function dayOneRequirementsMet(state) {
  const requirements = DAY_ONE_V01.tuning.requirements;
  const account = state?.chapters?.dayOne?.account;
  return Boolean(
    account
    && account.woodGathered >= requirements.woodGathered
    && account.mealsEaten >= requirements.mealsEaten
    && state.world?.garden?.planted === requirements.gardenPlanted
    && state.world?.garden?.watered === requirements.gardenWatered
    && state.world?.camp?.shelterRepaired === requirements.shelterRepaired
  );
}

function sanitizePlayer(raw) {
  if (!isPlainObject(raw)) return null;
  const { meters, economy, inventory, tools, equipment } = raw;
  if (
    !isPlainObject(meters)
    || !isPlainObject(economy)
    || !isPlainObject(inventory)
    || !isPlainObject(tools)
    || !isPlainObject(equipment)
  ) return null;

  const meterMax = DAY_ONE_V01.tuning.meters.max;
  if (
    !isNonNegativeInteger(meters.nourishment, meterMax)
    || !isNonNegativeInteger(meters.energy, meterMax)
    || !isNonNegativeInteger(economy.coins)
    || !isNonNegativeInteger(economy.doctorDebt)
    || !isNonNegativeInteger(raw.passedOutCount)
  ) return null;

  if (!isPlainObject(inventory.stackables) || !isPlainObject(inventory.specimens)) return null;
  const stackableEntries = Object.entries(inventory.stackables);
  if (stackableEntries.some(([id, count]) => !id || !isNonNegativeInteger(count))) return null;
  if (REQUIRED_STACKABLE_IDS.some((id) => !Object.hasOwn(inventory.stackables, id))) return null;

  let largestSpecimenSequence = 0;
  const specimens = {};
  for (const [id, specimen] of Object.entries(inventory.specimens)) {
    const match = /^catch-(\d{4,})$/.exec(id);
    if (!match || !isPlainObject(specimen)) return null;
    const sequence = Number(match[1]);
    if (!isPositiveInteger(sequence)) return null;
    largestSpecimenSequence = Math.max(largestSpecimenSequence, sequence);
    if (
      typeof specimen.itemId !== 'string'
      || !specimen.itemId.startsWith('fish.')
      || !FISH_CONDITIONS.has(specimen.condition)
      || !isPositiveInteger(specimen.lengthCm, 500)
      || typeof specimen.quality !== 'string'
      || !specimen.quality
      || typeof specimen.caughtAt !== 'string'
      || !specimen.caughtAt
    ) return null;
    specimens[id] = {
      itemId: specimen.itemId,
      condition: specimen.condition,
      lengthCm: specimen.lengthCm,
      quality: specimen.quality,
      caughtAt: specimen.caughtAt,
    };
  }
  if (
    !isPositiveInteger(inventory.nextSpecimenSequence)
    || inventory.nextSpecimenSequence <= largestSpecimenSequence
  ) return null;

  const owned = uniqueStrings(tools.owned);
  if (!owned || owned.some((id) => !id.startsWith('tool.'))) return null;
  if (!isPlainObject(tools.upgrades)) return null;
  const upgrades = {};
  for (const [toolId, toolUpgrades] of Object.entries(tools.upgrades)) {
    const cleaned = uniqueStrings(toolUpgrades);
    if (
      !owned.includes(toolId)
      || !cleaned
      || cleaned.some((id) => !id.startsWith('upgrade.'))
    ) return null;
    upgrades[toolId] = cleaned;
  }

  const axe = equipment.axe ?? null;
  const rod = equipment.rod ?? null;
  const bait = equipment.bait ?? null;
  if (axe !== null && (!owned.includes(axe) || !axe.startsWith('tool.axe.'))) return null;
  if (rod !== null && (!owned.includes(rod) || !rod.startsWith('tool.rod.'))) return null;
  if (
    bait !== null
    && (
      typeof bait !== 'string'
      || !bait.startsWith('bait.')
      || !isPositiveInteger(inventory.stackables[bait])
    )
  ) return null;

  return {
    meters: { nourishment: meters.nourishment, energy: meters.energy },
    economy: { coins: economy.coins, doctorDebt: economy.doctorDebt },
    inventory: {
      stackables: Object.fromEntries(stackableEntries),
      specimens,
      nextSpecimenSequence: inventory.nextSpecimenSequence,
    },
    tools: { owned, upgrades },
    equipment: { axe, rod, bait },
    passedOutCount: raw.passedOutCount,
  };
}

function sanitizeWorld(raw) {
  if (!isPlainObject(raw)) return null;
  const { camp, garden, trees } = raw;
  if (!isPlainObject(camp) || !isPlainObject(garden) || !isPlainObject(trees)) return null;
  if (
    typeof camp.fireLit !== 'boolean'
    || typeof camp.shelterRepaired !== 'boolean'
    || typeof garden.planted !== 'boolean'
    || typeof garden.watered !== 'boolean'
    || (garden.watered && !garden.planted)
    || !isPositiveInteger(trees.nextPlayerTreeSequence)
    || !isPlainObject(trees.byId)
  ) return null;
  if (DEFAULT_TREE_IDS.some((id) => !Object.hasOwn(trees.byId, id))) return null;

  let largestPlayerSequence = 0;
  const occupiedPlantingSites = new Set();
  const byId = {};
  for (const [id, tree] of Object.entries(trees.byId)) {
    if (!id.startsWith('tree.') || !isPlainObject(tree)) return null;
    if (
      typeof tree.definitionId !== 'string'
      || !tree.definitionId.startsWith('tree.')
      || !TREE_STAGE_SET.has(tree.stage)
      || !isNonNegativeInteger(tree.hitCount)
    ) return null;

    const authoredDefinition = AUTHORED_TREE_DEFINITIONS.get(id);
    const playerMatch = /^tree\.player\.(\d+)$/.exec(id);
    const plantingSiteId = tree.plantingSiteId ?? null;
    if (authoredDefinition) {
      const requiredHits = authoredDefinition.requiredHits;
      if (
        tree.definitionId !== authoredDefinition.definitionId
        || plantingSiteId !== null
        || (tree.stage !== 'mature' && tree.stage !== 'stump')
        || tree.hitCount > requiredHits
        || (tree.stage === 'mature' && tree.hitCount >= requiredHits)
        || (tree.stage === 'stump' && tree.hitCount !== requiredHits)
      ) return null;
    } else if (playerMatch) {
      const sequence = Number(playerMatch[1]);
      if (!isPositiveInteger(sequence)) return null;
      largestPlayerSequence = Math.max(largestPlayerSequence, sequence);
      if (typeof plantingSiteId !== 'string' || !plantingSiteId) return null;
      const plantingSite = AUTHORED_PLANTING_SITES.get(plantingSiteId);
      if (
        !plantingSite
        || tree.definitionId !== plantingSite.plantedDefinitionId
        || tree.stage !== 'seedling'
        || tree.stage !== plantingSite.plantedStage
        || tree.hitCount !== 0
      ) return null;
    } else {
      return null;
    }
    if (plantingSiteId !== null) {
      if (occupiedPlantingSites.has(plantingSiteId)) return null;
      occupiedPlantingSites.add(plantingSiteId);
    }
    byId[id] = {
      definitionId: tree.definitionId,
      stage: tree.stage,
      hitCount: tree.hitCount,
      plantingSiteId,
    };
  }
  if (trees.nextPlayerTreeSequence <= largestPlayerSequence) return null;

  return {
    camp: { fireLit: camp.fireLit, shelterRepaired: camp.shelterRepaired },
    garden: { planted: garden.planted, watered: garden.watered },
    trees: { nextPlayerTreeSequence: trees.nextPlayerTreeSequence, byId },
  };
}

function sanitizeCountMap(raw, { positive = false } = {}) {
  if (!isPlainObject(raw)) return null;
  const entries = Object.entries(raw);
  if (entries.some(([id, count]) => (
    !id.startsWith('fish.')
    || !(positive ? isPositiveInteger(count, 500) : isNonNegativeInteger(count))
  ))) return null;
  return Object.fromEntries(entries);
}

function sanitizeActivities(raw) {
  if (!isPlainObject(raw)) return null;
  const { woodcutting, fishing, cooking, gardening } = raw;
  if (
    !isPlainObject(woodcutting)
    || !isPlainObject(fishing)
    || !isPlainObject(cooking)
    || !isPlainObject(gardening)
  ) return null;
  const counters = [
    woodcutting.woodHarvested,
    woodcutting.treesFelled,
    woodcutting.treesPlanted,
    fishing.totalCaught,
    cooking.mealsCooked,
    cooking.mealsEaten,
    gardening.seedsPlanted,
  ];
  if (counters.some((value) => !isNonNegativeInteger(value))) return null;
  if (cooking.mealsEaten > cooking.mealsCooked) return null;

  const caughtBySpecies = sanitizeCountMap(fishing.caughtBySpecies);
  const largestCmBySpecies = sanitizeCountMap(fishing.largestCmBySpecies, { positive: true });
  if (!caughtBySpecies || !largestCmBySpecies) return null;
  const caughtTotal = Object.values(caughtBySpecies).reduce((sum, count) => sum + count, 0);
  if (caughtTotal !== fishing.totalCaught) return null;
  if (Object.keys(largestCmBySpecies).some((id) => !isPositiveInteger(caughtBySpecies[id]))) return null;

  return {
    woodcutting: {
      woodHarvested: woodcutting.woodHarvested,
      treesFelled: woodcutting.treesFelled,
      treesPlanted: woodcutting.treesPlanted,
    },
    fishing: {
      totalCaught: fishing.totalCaught,
      caughtBySpecies,
      largestCmBySpecies,
    },
    cooking: {
      mealsCooked: cooking.mealsCooked,
      mealsEaten: cooking.mealsEaten,
    },
    gardening: {
      seedsPlanted: gardening.seedsPlanted,
    },
  };
}

function sanitizeChapters(raw) {
  if (!isPlainObject(raw) || !isPlainObject(raw.dayOne)) return null;
  const { dayOne } = raw;
  if (typeof dayOne.complete !== 'boolean' || !isPlainObject(dayOne.account)) return null;
  const account = dayOne.account;
  const counters = [
    account.woodGathered,
    account.fishCaught,
    account.mealsCooked,
    account.mealsEaten,
    account.seedsPlanted,
  ];
  if (counters.some((value) => !isNonNegativeInteger(value))) return null;
  if (account.mealsEaten > account.mealsCooked || account.mealsCooked > account.fishCaught) return null;
  return {
    dayOne: {
      complete: dayOne.complete,
      account: {
        woodGathered: account.woodGathered,
        fishCaught: account.fishCaught,
        mealsCooked: account.mealsCooked,
        mealsEaten: account.mealsEaten,
        seedsPlanted: account.seedsPlanted,
      },
    },
  };
}

function sanitizeState(raw, now) {
  if (!isPlainObject(raw) || raw.version !== GAME_SESSION_VERSION) return null;
  if (!PHASE_SET.has(raw.phase)) return null;
  const neighborliness = clampNeighborliness(raw.neighborliness);
  if (neighborliness === null) return null;
  if (!isPlainObject(raw.relationship) || !RELATIONSHIP_STATES.has(raw.relationship.steward)) {
    return null;
  }
  if (raw.ending !== null && !ENDING_STATES.has(raw.ending)) return null;

  const rulesKnown = uniqueStrings(raw.rulesKnown);
  const choices = cleanChoices(raw.choices);
  let eventsSeen = uniqueStrings(raw.eventsSeen);
  if (!rulesKnown || !choices || !eventsSeen) return null;

  const eventSet = new Set(eventsSeen);
  const highestKnownEvent = CORE_EVENT_ORDER.reduce(
    (highest, eventId, index) => (eventSet.has(eventId) ? index : highest),
    -1,
  );
  for (let index = 0; index <= highestKnownEvent; index += 1) {
    if (!eventSet.has(CORE_EVENT_ORDER[index])) return null;
  }

  const ledgerChoice = choices.ledger_record ?? null;
  if (ledgerChoice && ledgerChoice !== 'comply' && ledgerChoice !== 'alter') return null;
  if (raw.phase === 'resolution' && !ledgerChoice) return null;
  if (ledgerChoice && raw.phase !== 'resolution') return null;
  if (eventSet.has('ledger-record-choice-made') !== Boolean(ledgerChoice)) return null;
  if (eventSet.has('core-hook-ending-seen') !== Boolean(raw.ending)) return null;
  if (raw.ending) {
    const expectedChoice = raw.ending === 'assimilate' ? 'comply' : 'alter';
    if (ledgerChoice !== expectedChoice) return null;
  }

  const expectedPhase = ledgerChoice
    ? 'resolution'
    : eventSet.has('false-ledger-record-seen')
      ? 'intervention'
      : eventSet.has('night-bell-rang-itself')
        ? 'night-investigation'
        : eventSet.has('dusk-bell-rung')
          ? 'dusk'
          : eventSet.has('steward-lumen-met')
            ? 'day-routine'
            : 'arrival';
  if (raw.phase !== expectedPhase) return null;

  const player = sanitizePlayer(raw.player);
  const world = sanitizeWorld(raw.world);
  const activities = sanitizeActivities(raw.activities);
  const chapters = sanitizeChapters(raw.chapters);
  if (!player || !world || !activities || !chapters) return null;

  const state = {
    version: GAME_SESSION_VERSION,
    phase: raw.phase,
    neighborliness,
    relationship: { steward: raw.relationship.steward },
    playerName: normalizePlayerName(raw.playerName) || null,
    rulesKnown,
    choices,
    eventsSeen,
    ending: raw.ending,
    player,
    world,
    activities,
    chapters,
    updatedAt: Number.isFinite(Number(raw.updatedAt)) ? Number(raw.updatedAt) : now,
  };

  const account = chapters.dayOne.account;
  if (
    account.woodGathered > activities.woodcutting.woodHarvested
    || account.fishCaught > activities.fishing.totalCaught
    || account.mealsCooked > activities.cooking.mealsCooked
    || account.mealsEaten > activities.cooking.mealsEaten
    || account.seedsPlanted > activities.gardening.seedsPlanted
    || player.inventory.stackables[GAME_ITEM_IDS.wood] > activities.woodcutting.woodHarvested
    || Object.keys(player.inventory.specimens).length > activities.fishing.totalCaught
  ) return null;

  const requirementsMet = dayOneRequirementsMet(state);
  if (chapters.dayOne.complete !== requirementsMet) return null;
  if (!chapters.dayOne.complete && eventSet.has('dusk-bell-rung')) return null;
  if (chapters.dayOne.complete) {
    pushUnique(eventsSeen, DAY_ONE_V01.events.afternoonComplete);
  } else {
    eventsSeen = eventsSeen.filter((event) => event !== DAY_ONE_V01.events.afternoonComplete);
  }
  state.eventsSeen = eventsSeen;
  return state;
}

/**
 * JSON-only authority for story, player, world, activity, and chapter state.
 * Presentation systems consume cloned snapshots and emit intent through a
 * transaction; they never own committed consequences.
 */
export class GameSession {
  constructor({
    storage = resolveDefaultStorage(),
    storageKey = DEFAULT_GAME_SESSION_STORAGE_KEY,
    now = () => Date.now(),
  } = {}) {
    this.storage = storage;
    this.storageKey = storageKey;
    this.now = typeof now === 'function' ? now : () => Date.now();
    this.listeners = new Set();
    this.lastStorageError = null;
    this._state = this._load();
  }

  get phase() {
    return this._state.phase;
  }

  get neighborliness() {
    return this._state.neighborliness;
  }

  get ending() {
    return this._state.ending;
  }

  get stewardRelationship() {
    return this._state.relationship.steward;
  }

  get playerName() {
    return this._state.playerName;
  }

  snapshot() {
    return clone(this._state);
  }

  hasEvent(eventId) {
    return this._state.eventsSeen.includes(eventId);
  }

  knowsRule(ruleId) {
    return this._state.rulesKnown.includes(ruleId);
  }

  getChoice(choiceId) {
    return this._state.choices[choiceId] ?? null;
  }

  setPlayerName(value) {
    const playerName = normalizePlayerName(value);
    if (!playerName) throw new TypeError('Player name must contain at least one visible character');
    if (this._state.playerName === playerName) return this.snapshot();
    return this.transact((draft) => {
      draft.playerName = playerName;
    });
  }

  setPhase(phase) {
    if (!PHASE_SET.has(phase)) throw new TypeError(`Unknown game phase: ${phase}`);
    if (this._state.phase === phase) return this.snapshot();
    return this.transact((draft) => {
      draft.phase = phase;
    });
  }

  setRelationship(characterId, relationship) {
    if (characterId !== 'steward') throw new TypeError(`Unknown relationship: ${characterId}`);
    if (!RELATIONSHIP_STATES.has(relationship)) {
      throw new TypeError(`Unknown steward relationship state: ${relationship}`);
    }
    if (this._state.relationship.steward === relationship) return this.snapshot();
    return this.transact((draft) => {
      draft.relationship.steward = relationship;
    });
  }

  markEvent(eventId) {
    if (typeof eventId !== 'string' || eventId.length === 0) {
      throw new TypeError('eventId must be a non-empty string');
    }
    if (this.hasEvent(eventId)) return false;
    this.transact((draft) => {
      draft.eventsSeen.push(eventId);
    });
    return true;
  }

  discoverRule(ruleId) {
    if (typeof ruleId !== 'string' || ruleId.length === 0) {
      throw new TypeError('ruleId must be a non-empty string');
    }
    if (this.knowsRule(ruleId)) return false;
    this.transact((draft) => {
      draft.rulesKnown.push(ruleId);
    });
    return true;
  }

  setChoice(choiceId, value) {
    if (typeof choiceId !== 'string' || choiceId.length === 0) {
      throw new TypeError('choiceId must be a non-empty string');
    }
    if (typeof value !== 'string' || value.length === 0) {
      throw new TypeError('choice value must be a non-empty string');
    }
    if (this.getChoice(choiceId) === value) return this.snapshot();
    return this.transact((draft) => {
      draft.choices[choiceId] = value;
      if (choiceId === 'ledger_record') {
        if (value !== 'comply' && value !== 'alter') {
          throw new TypeError(`Unknown Ledger choice: ${value}`);
        }
        draft.phase = 'resolution';
        pushUnique(draft.eventsSeen, 'ledger-record-choice-made');
      }
    });
  }

  setEnding(ending) {
    if (ending !== null && !ENDING_STATES.has(ending)) {
      throw new TypeError(`Unknown ending: ${ending}`);
    }
    if (this._state.ending === ending) return this.snapshot();
    return this.transact((draft) => {
      draft.ending = ending;
      const eventId = 'core-hook-ending-seen';
      if (ending) pushUnique(draft.eventsSeen, eventId);
      else draft.eventsSeen = draft.eventsSeen.filter((event) => event !== eventId);
    });
  }

  setNeighborliness(value) {
    const next = clampNeighborliness(value);
    if (next === null) throw new TypeError('Neighborliness must be finite');
    if (this._state.neighborliness === next) return next;
    this.transact((draft) => {
      draft.neighborliness = next;
    });
    return next;
  }

  adjustNeighborliness(amount) {
    const delta = Number(amount);
    if (!Number.isFinite(delta)) throw new TypeError('Neighborliness change must be finite');
    return this.setNeighborliness(this._state.neighborliness + delta);
  }

  transact(mutator) {
    if (typeof mutator !== 'function') throw new TypeError('mutator must be a function');
    const draft = this.snapshot();
    mutator(draft);
    draft.version = GAME_SESSION_VERSION;
    draft.updatedAt = this.now();
    const next = sanitizeState(draft, draft.updatedAt);
    if (!next) throw new TypeError('GameSession transaction produced invalid state');
    this._state = next;
    this.save();
    this._emit();
    return this.snapshot();
  }

  save() {
    if (!this.storage?.setItem) return false;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this._state));
      this.lastStorageError = null;
      return true;
    } catch (error) {
      this.lastStorageError = error;
      return false;
    }
  }

  reset() {
    this._state = createDefaultGameSession(this.now());
    if (this.storage?.removeItem) {
      try {
        this.storage.removeItem(this.storageKey);
        this.lastStorageError = null;
      } catch (error) {
        this.lastStorageError = error;
      }
    }
    this._emit();
    return this.snapshot();
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('listener must be a function');
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose() {
    this.listeners.clear();
  }

  _load() {
    const fallback = createDefaultGameSession(this.now());
    if (!this.storage?.getItem) return fallback;
    try {
      const serialized = this.storage.getItem(this.storageKey);
      if (!serialized) return fallback;
      const next = sanitizeState(JSON.parse(serialized), this.now());
      if (!next) throw new TypeError('Unsupported or invalid save schema');
      return next;
    } catch (error) {
      this.lastStorageError = error;
      try {
        this.storage.removeItem?.(this.storageKey);
      } catch {
        // An unavailable storage backend should never prevent a local session.
      }
      return fallback;
    }
  }

  _emit() {
    const state = this.snapshot();
    for (const listener of [...this.listeners]) {
      try {
        listener(state);
      } catch (error) {
        console.warn('[GameSession] Subscriber failed.', error);
      }
    }
  }
}
