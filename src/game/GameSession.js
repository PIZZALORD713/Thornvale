import { DAY_ONE_V01 } from '../content/day-one-v01.js';

export const GAME_SESSION_VERSION = 4;
export const DEFAULT_GAME_SESSION_STORAGE_KEY = 'thornvale.core-hook-v03';
export const MAX_PLAYER_NAME_LENGTH = 40;

export const GAME_PHASES = Object.freeze([
  'arrival',
  'day-routine',
  'dusk',
  'night-investigation',
  'intervention',
  'resolution',
]);

const PHASE_SET = new Set(GAME_PHASES);
const RELATIONSHIP_STATES = new Set(['guarded', 'warm', 'corrective']);
const ENDING_STATES = new Set(['assimilate', 'escape']);
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

function clampNeighborliness(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.min(100, Math.max(0, Math.round(numeric)));
}

function clampInteger(value, fallback, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniqueStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item) => typeof item === 'string' && item.length > 0))];
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function pushUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

export function createDefaultDayOneState() {
  const tuning = DAY_ONE_V01.tuning;
  return {
    nourishment: tuning.meters.startingNourishment,
    energy: tuning.meters.startingEnergy,
    coins: tuning.startingCoins,
    doctorDebt: 0,
    inventory: {
      ...tuning.startingInventory,
    },
    activity: {
      woodGathered: 0,
      fishCaught: 0,
      mealsCooked: 0,
      mealsEaten: 0,
      seedsPlanted: 0,
    },
    garden: {
      planted: false,
      watered: false,
    },
    camp: {
      fireLit: false,
      shelterRepaired: false,
    },
    passedOutCount: 0,
    complete: false,
  };
}

export function createCompletedDayOneState() {
  const state = createDefaultDayOneState();
  const requirements = DAY_ONE_V01.tuning.requirements;
  state.inventory.seeds = Math.max(0, state.inventory.seeds - 1);
  state.activity.woodGathered = requirements.woodGathered;
  state.activity.fishCaught = 1;
  state.activity.mealsCooked = requirements.mealsEaten;
  state.activity.mealsEaten = requirements.mealsEaten;
  state.activity.seedsPlanted = 1;
  state.garden.planted = true;
  state.garden.watered = true;
  state.camp.fireLit = true;
  state.camp.shelterRepaired = true;
  state.complete = true;
  return state;
}

export function dayOneRequirementsMet(state) {
  const requirements = DAY_ONE_V01.tuning.requirements;
  return Boolean(
    state
    && state.activity?.woodGathered >= requirements.woodGathered
    && state.activity?.mealsEaten >= requirements.mealsEaten
    && state.garden?.planted === requirements.gardenPlanted
    && state.garden?.watered === requirements.gardenWatered
    && state.camp?.shelterRepaired === requirements.shelterRepaired
  );
}

function sanitizeDayOneState(raw, { forceComplete = false } = {}) {
  const defaults = createDefaultDayOneState();
  const source = isPlainObject(raw) ? raw : defaults;
  const inventorySource = isPlainObject(source.inventory) ? source.inventory : {};
  const activitySource = isPlainObject(source.activity) ? source.activity : {};
  const gardenSource = isPlainObject(source.garden) ? source.garden : {};
  const campSource = isPlainObject(source.camp) ? source.camp : {};
  const tuning = DAY_ONE_V01.tuning;
  const meterMax = tuning.meters.max;

  const rawFish = clampInteger(
    inventorySource.rawFish,
    defaults.inventory.rawFish,
    0,
    tuning.fishCatchLimit,
  );
  const cookedFish = clampInteger(
    inventorySource.cookedFish,
    defaults.inventory.cookedFish,
    0,
    Math.max(0, tuning.fishCatchLimit - rawFish),
  );

  const state = {
    nourishment: clampInteger(
      source.nourishment,
      defaults.nourishment,
      0,
      meterMax,
    ),
    energy: clampInteger(source.energy, defaults.energy, 0, meterMax),
    coins: clampInteger(source.coins, defaults.coins),
    doctorDebt: clampInteger(source.doctorDebt, defaults.doctorDebt),
    inventory: {
      wood: clampInteger(
        inventorySource.wood,
        defaults.inventory.wood,
        0,
        tuning.woodInventoryLimit,
      ),
      rawFish,
      cookedFish,
      seeds: clampInteger(inventorySource.seeds, defaults.inventory.seeds, 0, 99),
    },
    activity: {
      woodGathered: clampInteger(activitySource.woodGathered, 0),
      fishCaught: clampInteger(activitySource.fishCaught, 0),
      mealsCooked: clampInteger(activitySource.mealsCooked, 0),
      mealsEaten: clampInteger(activitySource.mealsEaten, 0),
      seedsPlanted: clampInteger(activitySource.seedsPlanted, 0),
    },
    garden: {
      planted: gardenSource.planted === true,
      watered: gardenSource.watered === true,
    },
    camp: {
      fireLit: campSource.fireLit === true,
      shelterRepaired: campSource.shelterRepaired === true,
    },
    passedOutCount: clampInteger(source.passedOutCount, 0),
    complete: false,
  };

  // Keep durable progress coherent even after a partial or hand-edited save.
  // These counters intentionally remember resources that have already been
  // consumed by the fire, meal, seed bed, or shelter.
  if (state.garden.watered) state.garden.planted = true;
  if (state.garden.planted) state.activity.seedsPlanted = Math.max(1, state.activity.seedsPlanted);
  if (state.activity.mealsEaten > 0) {
    state.activity.mealsCooked = Math.max(state.activity.mealsCooked, state.activity.mealsEaten);
  }
  if (state.activity.mealsCooked > 0) state.camp.fireLit = true;
  state.activity.fishCaught = Math.max(
    state.activity.fishCaught,
    state.inventory.rawFish
      + state.inventory.cookedFish
      + state.activity.mealsEaten,
  );
  state.activity.woodGathered = Math.max(
    state.activity.woodGathered,
    state.inventory.wood
      + (state.camp.fireLit ? tuning.fireWoodCost : 0)
      + (state.camp.shelterRepaired ? tuning.shelterWoodCost : 0),
  );

  if (forceComplete) {
    const requirements = tuning.requirements;
    state.activity.woodGathered = Math.max(
      state.activity.woodGathered,
      requirements.woodGathered,
    );
    state.activity.fishCaught = Math.max(state.activity.fishCaught, 1);
    state.activity.mealsCooked = Math.max(
      state.activity.mealsCooked,
      requirements.mealsEaten,
    );
    state.activity.mealsEaten = Math.max(
      state.activity.mealsEaten,
      requirements.mealsEaten,
    );
    state.activity.seedsPlanted = Math.max(state.activity.seedsPlanted, 1);
    state.garden.planted = true;
    state.garden.watered = true;
    state.camp.fireLit = true;
    state.camp.shelterRepaired = true;
  }

  state.complete = Boolean(source.complete || forceComplete) && dayOneRequirementsMet(state);
  return state;
}

export function normalizePlayerName(value) {
  if (typeof value !== 'string') return '';
  const normalized = value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return Array.from(normalized).slice(0, MAX_PLAYER_NAME_LENGTH).join('');
}

function cleanChoices(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, choice]) => typeof key === 'string' && key.length > 0 && typeof choice === 'string',
    ),
  );
}

function resolveDefaultStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function createDefaultGameSession(now = Date.now()) {
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
    dayOne: createDefaultDayOneState(),
    updatedAt: Number.isFinite(Number(now)) ? Number(now) : Date.now(),
  };
}

function migrateState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const incomingVersion = raw.version == null ? 0 : Number(raw.version);
  if (!Number.isInteger(incomingVersion) || incomingVersion > GAME_SESSION_VERSION) return null;

  // Schema 0 was the unversioned prototype shape. Its supported fields map
  // directly into the current schema; unknown data is intentionally discarded.
  let migrated;
  if (incomingVersion === 0) {
    migrated = {
      ...raw,
      playerName: normalizePlayerName(raw.playerName) || null,
      relationship: raw.relationship || {
        steward: raw.stewardRelationship || 'guarded',
      },
    };
  } else if (incomingVersion === 1) {
    migrated = {
      ...raw,
      playerName: normalizePlayerName(raw.playerName) || null,
    };
  } else {
    migrated = { ...raw };
  }

  if (incomingVersion < 3) {
    const hasPassedFirstAfternoon = uniqueStrings(raw.eventsSeen).includes(
      DAY_ONE_V01.events.ledgerSigned,
    );
    migrated.dayOne = hasPassedFirstAfternoon
      ? createCompletedDayOneState()
      : createDefaultDayOneState();
  }

  if (
    incomingVersion < 4
    && uniqueStrings(raw.eventsSeen).includes(DAY_ONE_V01.events.ledgerSigned)
  ) {
    // Before schema 4 the Ledger could only be signed after every Day One
    // requirement. Preserve that historical fact while allowing new signed
    // saves to contain an afternoon that is still in progress.
    migrated.dayOne = sanitizeDayOneState(migrated.dayOne, { forceComplete: true });
  }

  migrated.version = GAME_SESSION_VERSION;
  return migrated;
}

function sanitizeState(raw, now) {
  const migrated = migrateState(raw);
  if (!migrated) return null;

  const stewardRelationship = migrated.relationship?.steward;
  if (migrated.ending != null && !ENDING_STATES.has(migrated.ending)) return null;
  const ending = migrated.ending ?? null;
  const choices = cleanChoices(migrated.choices);
  let eventsSeen = uniqueStrings(migrated.eventsSeen);
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
  if (migrated.phase === 'resolution' && !ledgerChoice) return null;
  if (ledgerChoice && migrated.phase !== 'resolution') return null;
  if (eventsSeen.includes('ledger-record-choice-made') !== Boolean(ledgerChoice)) return null;
  if (eventsSeen.includes('core-hook-ending-seen') !== Boolean(ending)) return null;
  if (ending) {
    const expectedChoice = ending === 'assimilate' ? 'comply' : 'alter';
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
  if (migrated.phase !== expectedPhase) return null;

  const dayOne = sanitizeDayOneState(migrated.dayOne);
  if (!dayOne.complete && eventSet.has('dusk-bell-rung')) {
    // The Bell cannot be reached before the signed afternoon account closes.
    // Reject an impossible v4 transaction instead of preserving story progress
    // that bypassed the authoritative Day One requirements.
    return null;
  }
  if (dayOne.complete) {
    pushUnique(eventsSeen, DAY_ONE_V01.events.afternoonComplete);
  } else {
    eventsSeen = eventsSeen.filter((event) => event !== DAY_ONE_V01.events.afternoonComplete);
  }

  return {
    version: GAME_SESSION_VERSION,
    phase: PHASE_SET.has(migrated.phase) ? migrated.phase : 'arrival',
    neighborliness: clampNeighborliness(migrated.neighborliness),
    relationship: {
      steward: RELATIONSHIP_STATES.has(stewardRelationship)
        ? stewardRelationship
        : 'guarded',
    },
    playerName: normalizePlayerName(migrated.playerName) || null,
    rulesKnown: uniqueStrings(migrated.rulesKnown),
    choices,
    eventsSeen,
    ending,
    dayOne,
    updatedAt: Number.isFinite(Number(migrated.updatedAt))
      ? Number(migrated.updatedAt)
      : now,
  };
}

/**
 * Small, versioned state owner for the Core Hook Proof.
 *
 * State remains JSON-only by design so it can be inspected in development,
 * persisted to localStorage, and exercised without Three.js or the browser UI.
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

  get dayOne() {
    return clone(this._state.dayOne);
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
        if (!draft.eventsSeen.includes('ledger-record-choice-made')) {
          draft.eventsSeen.push('ledger-record-choice-made');
        }
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
      if (ending && !draft.eventsSeen.includes(eventId)) draft.eventsSeen.push(eventId);
      if (!ending) draft.eventsSeen = draft.eventsSeen.filter((event) => event !== eventId);
    });
  }

  setNeighborliness(value) {
    const next = clampNeighborliness(value);
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

      const parsed = JSON.parse(serialized);
      const next = sanitizeState(parsed, this.now());
      if (!next) throw new TypeError('Unsupported or invalid save schema');

      if (parsed.version !== GAME_SESSION_VERSION) {
        this.storage.setItem(this.storageKey, JSON.stringify(next));
      }
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
