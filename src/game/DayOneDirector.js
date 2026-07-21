import { DAY_ONE_INTERACTION_IDS, DAY_ONE_V01 } from '../content/day-one-v01.js';
import { STEWARDSHIP_V01 } from '../content/stewardship-v01.js';
import {
  GameSession,
  GAME_ITEM_IDS,
  dayOneRequirementsMet,
} from './GameSession.js';
import { findFishSpecimenId, selectDayOneState } from './dayOneState.js';

const HANDLED_IDS = new Set(Object.values(DAY_ONE_INTERACTION_IDS));

function fillMessage(template, values) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function pushUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function nourishmentLabel(value) {
  if (value >= 75) return 'Well fed';
  if (value >= 45) return 'Peckish';
  if (value >= 20) return 'Hungry';
  return 'Empty';
}

function energyLabel(value) {
  if (value >= 70) return 'Rested';
  if (value >= 25) return 'Tiring';
  return 'Spent';
}

function addPondFish(draft) {
  const inventory = draft.player.inventory;
  const fish = STEWARDSHIP_V01.fishing.easyFish;
  const id = `catch-${String(inventory.nextSpecimenSequence).padStart(4, '0')}`;
  inventory.nextSpecimenSequence += 1;
  inventory.specimens[id] = {
    itemId: fish.itemId,
    condition: 'raw',
    lengthCm: fish.sizeCm,
    quality: fish.quality,
    caughtAt: fish.caughtAt,
  };
  return id;
}

/**
 * Authoritative controller for Thornvale's bounded first-afternoon loop.
 * Chapter values are a projection over global state, never a second inventory.
 */
export class DayOneDirector {
  constructor({
    session = new GameSession(),
    content = DAY_ONE_V01,
    actionController = null,
    onPassOut = null,
    onStatus = null,
  } = {}) {
    this.session = session;
    this.content = content;
    this.actionController = actionController;
    this.onPassOut = typeof onPassOut === 'function' ? onPassOut : null;
    this.onStatus = typeof onStatus === 'function' ? onStatus : null;
    this.disposed = false;
    this.busy = false;
  }

  handles(id) {
    return HANDLED_IDS.has(id);
  }

  isInteractableEnabled(id) {
    if (this.disposed || this.busy || !this.handles(id)) return false;
    const snapshot = this.session.snapshot();
    if (!this._isActive(snapshot)) return false;
    const state = selectDayOneState(snapshot);
    const tuning = this.content.tuning;
    switch (id) {
      case this.content.ids.woodlot:
        return state.inventory.wood < tuning.woodInventoryLimit;
      case this.content.ids.fishingSpot:
        return state.activity.fishCaught < tuning.fishCatchLimit;
      case this.content.ids.campfire:
        return true;
      case this.content.ids.garden:
        return !state.garden.watered;
      case this.content.ids.shelter:
        return !state.camp.shelterRepaired;
      default:
        return false;
    }
  }

  promptFor(id) {
    if (!this.handles(id)) return '';
    const state = selectDayOneState(this.session.snapshot());
    const { prompts, tuning } = this.content;
    switch (id) {
      case this.content.ids.woodlot:
        return state.inventory.wood >= tuning.woodInventoryLimit ? prompts.woodFull : prompts.chop;
      case this.content.ids.fishingSpot:
        return state.activity.fishCaught >= tuning.fishCatchLimit ? prompts.fishFinished : prompts.fish;
      case this.content.ids.campfire:
        if (!state.camp.fireLit) {
          return state.inventory.wood >= tuning.fireWoodCost ? prompts.lightFire : prompts.needFireWood;
        }
        if (state.inventory.cookedFish > 0) return prompts.eatFish;
        if (state.inventory.rawFish > 0) return prompts.cookFish;
        return prompts.warmHands;
      case this.content.ids.garden:
        if (state.garden.watered) return prompts.gardenDone;
        if (state.garden.planted) return prompts.water;
        return state.inventory.seeds > 0 ? prompts.plant : prompts.needSeed;
      case this.content.ids.shelter:
        if (state.camp.shelterRepaired) return prompts.shelterDone;
        return state.inventory.wood >= tuning.shelterWoodCost
          ? prompts.repairShelter
          : prompts.needShelterWood;
      default:
        return '';
    }
  }

  async interact(id, context = null) {
    if (this.disposed || !this.handles(id)) return null;
    if (this.busy) return this.content.messages.busy;
    if (!this._isActive(this.session.snapshot())) return this.content.messages.inactive;
    this.busy = true;
    try {
      switch (id) {
        case this.content.ids.woodlot: return await this._chopWood(context);
        case this.content.ids.fishingSpot: return await this._catchFish(context);
        case this.content.ids.campfire: return await this._useCampfire(context);
        case this.content.ids.garden: return await this._tendGarden(context);
        case this.content.ids.shelter: return await this._repairShelter(context);
        default: return null;
      }
    } finally {
      this.busy = false;
    }
  }

  currentObjective(snapshot = this.session.snapshot()) {
    const state = selectDayOneState(snapshot);
    const { objectives, tuning } = this.content;
    if (!snapshot.eventsSeen?.includes(this.content.events.stewardMet)) return objectives.meetSteward;
    if (!snapshot.eventsSeen.includes(this.content.events.ledgerSigned)) return objectives.signLedger;
    if (state.complete) return null;
    if (state.activity.woodGathered < tuning.requirements.woodGathered) {
      return this._woodObjective(objectives.gatherWood, snapshot);
    }
    if (state.activity.mealsEaten < tuning.requirements.mealsEaten) {
      if (state.inventory.cookedFish > 0) return objectives.eatFish;
      if (state.inventory.rawFish > 0) return state.camp.fireLit ? objectives.cookFish : objectives.lightFire;
      return objectives.catchFish;
    }
    if (!state.garden.planted) return objectives.plantSeed;
    if (!state.garden.watered) return objectives.waterSeed;
    if (!state.camp.shelterRepaired) {
      return state.inventory.wood >= tuning.shelterWoodCost
        ? objectives.repairShelter
        : this._woodObjective(objectives.gatherShelterWood, snapshot);
    }
    return null;
  }

  isComplete(snapshot = this.session.snapshot()) {
    return snapshot.chapters?.dayOne?.complete === true;
  }

  recoverFromExhaustion() {
    if (this.disposed) return null;
    return this._passOut();
  }

  ledgerRecordFor(snapshot = this.session.snapshot()) {
    const state = selectDayOneState(snapshot);
    const record = this.content.ledgerRecord;
    const requirements = this.content.tuning.requirements;
    const mark = (complete) => (complete ? record.recorded : record.awaiting);
    const garden = state.garden.watered
      ? record.watered
      : state.garden.planted ? record.planted : record.awaiting;
    return {
      ...record,
      entry: [
        `${record.labels.wood} · ${state.activity.woodGathered} / ${requirements.woodGathered}`,
        `${record.labels.fish} · ${state.activity.fishCaught} / 1`,
        `${record.labels.fire} · ${mark(state.camp.fireLit)}`,
        `${record.labels.cooked} · ${state.activity.mealsCooked} / ${requirements.mealsEaten}`,
        `${record.labels.eaten} · ${state.activity.mealsEaten} / ${requirements.mealsEaten}`,
        `${record.labels.garden} · ${garden}`,
        `${record.labels.shelter} · ${mark(state.camp.shelterRepaired)}`,
      ].join('\n'),
      signature: snapshot.playerName || record.signature,
    };
  }

  actionFor(id, snapshot = this.session.snapshot()) {
    if (!this._isActive(snapshot)) return null;
    const state = selectDayOneState(snapshot);
    const { actions, tuning } = this.content;
    switch (id) {
      case this.content.ids.woodlot:
        return state.inventory.wood < tuning.woodInventoryLimit ? actions?.chopWood || null : null;
      case this.content.ids.fishingSpot:
        return null;
      case this.content.ids.campfire:
        if (!state.camp.fireLit) return state.inventory.wood >= tuning.fireWoodCost ? actions?.lightFire || null : null;
        if (state.inventory.cookedFish > 0) return actions?.eatFish || null;
        if (state.inventory.rawFish > 0) return actions?.cookFish || null;
        return null;
      case this.content.ids.garden:
        if (!state.garden.planted && state.inventory.seeds > 0) return actions?.plantSeed || null;
        if (state.garden.planted && !state.garden.watered) return actions?.waterSeed || null;
        return null;
      case this.content.ids.shelter:
        return !state.camp.shelterRepaired && state.inventory.wood >= tuning.shelterWoodCost
          ? actions?.repairShelter || null
          : null;
      default:
        return null;
    }
  }

  stateForHud(snapshot = this.session.snapshot()) {
    const state = selectDayOneState(snapshot);
    const max = this.content.tuning.meters.max;
    return {
      active: this._isActive(snapshot),
      complete: state.complete,
      nourishment: {
        name: 'Nourishment', label: nourishmentLabel(state.nourishment), value: state.nourishment, max,
        valueText: `${nourishmentLabel(state.nourishment)}, ${state.nourishment} of ${max}`,
      },
      energy: {
        name: 'Energy', label: energyLabel(state.energy), value: state.energy, max,
        valueText: `${energyLabel(state.energy)}, ${state.energy} of ${max}`,
      },
      essentials: {
        wood: state.inventory.wood,
        fish: state.inventory.rawFish + state.inventory.cookedFish,
        rawFish: state.inventory.rawFish,
        cookedFish: state.inventory.cookedFish,
        seeds: state.inventory.seeds,
        treeSeeds: snapshot.player.inventory.stackables[GAME_ITEM_IDS.treeSeed],
        coins: state.coins,
        doctorDebt: state.doctorDebt,
      },
      announcement: state.doctorDebt > 0 ? `Doctor’s tab: ${state.doctorDebt} coins` : '',
    };
  }

  dispose() {
    this.disposed = true;
    this.busy = false;
    this.onPassOut = null;
    this.onStatus = null;
    this.actionController = null;
  }

  _woodObjective(objective, snapshot) {
    const ownsAxe = snapshot.player.tools.owned.includes(STEWARDSHIP_V01.tools.axe);
    const targetId = ownsAxe
      ? STEWARDSHIP_V01.trees.find((tree) => snapshot.world.trees.byId[tree.id]?.stage === 'mature')?.id
      : STEWARDSHIP_V01.ids.axePickup;
    if (!targetId) return objective;
    const findAxe = 'Find the fRiENDSiES axe beside your grove.';
    return {
      ...objective,
      text: ownsAxe ? objective.text : findAxe,
      detail: ownsAxe ? objective.detail : findAxe,
      target: { kind: 'interactable', id: targetId },
    };
  }

  _isActive(snapshot) {
    const events = snapshot.eventsSeen || [];
    return events.includes(this.content.events.stewardMet)
      && events.includes(this.content.events.ledgerSigned)
      && snapshot.chapters?.dayOne?.complete !== true;
  }

  async _chopWood(context = null) {
    const tuning = this.content.tuning;
    const before = selectDayOneState(this.session.snapshot());
    if (before.inventory.wood >= tuning.woodInventoryLimit) return this._announce(this.content.messages.woodFull);
    return this._performLabor(tuning.labor.chop, (draft) => {
      const stackables = draft.player.inventory.stackables;
      const amount = Math.min(tuning.woodPerChop, tuning.woodInventoryLimit - stackables[GAME_ITEM_IDS.wood]);
      stackables[GAME_ITEM_IDS.wood] += amount;
      draft.activities.woodcutting.woodHarvested += amount;
      draft.chapters.dayOne.account.woodGathered += amount;
    }, this.content.messages.wood, this.content.actions?.chopWood, {
      context,
      validate: (current) => current.inventory.wood < tuning.woodInventoryLimit,
    });
  }

  async _catchFish(context = null) {
    const tuning = this.content.tuning;
    const before = selectDayOneState(this.session.snapshot());
    if (before.activity.fishCaught >= tuning.fishCatchLimit) return this._announce(this.content.messages.fishFinished);
    return this._performLabor(tuning.labor.fish, (draft) => {
      addPondFish(draft);
      const fish = STEWARDSHIP_V01.fishing.easyFish;
      const activity = draft.activities.fishing;
      activity.totalCaught += 1;
      activity.caughtBySpecies[fish.speciesId] = (activity.caughtBySpecies[fish.speciesId] || 0) + 1;
      activity.largestCmBySpecies[fish.speciesId] = Math.max(
        activity.largestCmBySpecies[fish.speciesId] || 0,
        fish.sizeCm,
      );
      draft.chapters.dayOne.account.fishCaught += 1;
    }, this.content.messages.fish, null, {
      context,
      validate: (current) => current.activity.fishCaught < tuning.fishCatchLimit,
    });
  }

  async _useCampfire(context = null) {
    const state = selectDayOneState(this.session.snapshot());
    const tuning = this.content.tuning;
    if (!state.camp.fireLit) {
      if (state.inventory.wood < tuning.fireWoodCost) return this._announce(this.content.messages.needFireWood);
      return this._performAction(this.content.actions?.lightFire, (draft) => {
        draft.player.inventory.stackables[GAME_ITEM_IDS.wood] -= tuning.fireWoodCost;
        draft.world.camp.fireLit = true;
      }, this.content.messages.fire, {
        context,
        validate: (current) => !current.camp.fireLit && current.inventory.wood >= tuning.fireWoodCost,
      });
    }
    if (state.inventory.cookedFish > 0) {
      return this._performAction(this.content.actions?.eatFish, (draft) => {
        const fishId = findFishSpecimenId(draft, 'cooked');
        if (fishId) delete draft.player.inventory.specimens[fishId];
        draft.activities.cooking.mealsEaten += 1;
        draft.chapters.dayOne.account.mealsEaten += 1;
        draft.player.meters.energy = Math.min(tuning.meters.max, draft.player.meters.energy + tuning.mealRecovery.energy);
        draft.player.meters.nourishment = Math.min(tuning.meters.max, draft.player.meters.nourishment + tuning.mealRecovery.nourishment);
      }, this.content.messages.ateFish, {
        context,
        validate: (current) => current.camp.fireLit && current.inventory.cookedFish > 0,
      });
    }
    if (state.inventory.rawFish > 0) {
      return this._performAction(this.content.actions?.cookFish, (draft) => {
        const fishId = findFishSpecimenId(draft, 'raw');
        if (fishId) draft.player.inventory.specimens[fishId].condition = 'cooked';
        draft.activities.cooking.mealsCooked += 1;
        draft.chapters.dayOne.account.mealsCooked += 1;
      }, this.content.messages.cookedFish, {
        context,
        validate: (current) => current.camp.fireLit && current.inventory.rawFish > 0,
      });
    }
    return this._announce(this.content.messages.nothingToCook);
  }

  async _tendGarden(context = null) {
    const state = selectDayOneState(this.session.snapshot());
    if (state.garden.watered) return this._announce(this.content.messages.gardenDone);
    if (!state.garden.planted) {
      if (state.inventory.seeds < 1) return this._announce(this.content.messages.needSeed);
      return this._performLabor(this.content.tuning.labor.plant, (draft) => {
        draft.player.inventory.stackables[GAME_ITEM_IDS.gardenSeed] -= 1;
        draft.activities.gardening.seedsPlanted += 1;
        draft.chapters.dayOne.account.seedsPlanted += 1;
        draft.world.garden.planted = true;
      }, this.content.messages.planted, this.content.actions?.plantSeed, {
        context,
        validate: (current) => current.inventory.seeds >= 1 && !current.garden.planted && !current.garden.watered,
      });
    }
    return this._performLabor(this.content.tuning.labor.water, (draft) => {
      draft.world.garden.watered = true;
    }, this.content.messages.watered, this.content.actions?.waterSeed, {
      context,
      validate: (current) => current.garden.planted && !current.garden.watered,
    });
  }

  async _repairShelter(context = null) {
    const state = selectDayOneState(this.session.snapshot());
    const tuning = this.content.tuning;
    if (state.camp.shelterRepaired) return this._announce(this.content.messages.shelterDone);
    if (state.inventory.wood < tuning.shelterWoodCost) return this._announce(this.content.messages.needShelterWood);
    return this._performLabor(tuning.labor.repairShelter, (draft) => {
      draft.player.inventory.stackables[GAME_ITEM_IDS.wood] -= tuning.shelterWoodCost;
      draft.world.camp.shelterRepaired = true;
    }, this.content.messages.shelter, this.content.actions?.repairShelter, {
      context,
      validate: (current) => !current.camp.shelterRepaired && current.inventory.wood >= tuning.shelterWoodCost,
    });
  }

  async _performLabor(cost, applyAction, successMessage, action = null, { validate = null, context = null } = {}) {
    const before = selectDayOneState(this.session.snapshot());
    if (before.energy < cost.energy) return this._passOut();
    return this._performAction(action, (draft) => {
      draft.player.meters.energy = Math.max(0, draft.player.meters.energy - cost.energy);
      draft.player.meters.nourishment = Math.max(0, draft.player.meters.nourishment - cost.nourishment);
      applyAction(draft);
    }, successMessage, {
      context,
      validate: (current) => current.energy >= cost.energy && (!validate || validate(current)),
    });
  }

  async _performAction(action, applyAction, successMessage, { validate = null, context = null } = {}) {
    const completedNow = { value: false };
    const commit = () => {
      const current = selectDayOneState(this.session.snapshot());
      if (validate && !validate(current)) return Object.freeze({ applied: false, reason: 'stale-state' });
      const snapshot = this.session.transact((draft) => {
        applyAction(draft);
        completedNow.value = this._finishIfReady(draft);
      });
      return Object.freeze({ applied: true, snapshot });
    };
    if (action && this.actionController) {
      const outcome = await this.actionController.run(action, { onCommit: commit, context });
      if (!outcome.committed) return this._announce(this.content.messages.busy);
      if (outcome.commitResult?.applied === false) return this._announce(this.content.messages.actionChanged);
    } else {
      const outcome = commit();
      if (!outcome.applied) return this._announce(this.content.messages.actionChanged);
    }
    return this._announce(this._withCompletion(successMessage, completedNow.value));
  }

  async _passOut() {
    const tuning = this.content.tuning;
    let paid = 0;
    let debtAdded = 0;
    const snapshot = this.session.transact((draft) => {
      paid = Math.min(draft.player.economy.coins, tuning.doctorFee);
      debtAdded = tuning.doctorFee - paid;
      draft.player.economy.coins -= paid;
      draft.player.economy.doctorDebt += debtAdded;
      draft.player.meters.energy = tuning.meters.recoveryEnergy;
      draft.player.meters.nourishment = tuning.meters.recoveryNourishment;
      draft.player.passedOutCount += 1;
    });
    const recoverySite = snapshot.world.camp.shelterRepaired ? 'shelter' : 'gate';
    const recoveryMessages = recoverySite === 'shelter'
      ? { paid: this.content.messages.passedOutShelterPaid, debt: this.content.messages.passedOutShelterDebt }
      : { paid: this.content.messages.passedOutGatePaid, debt: this.content.messages.passedOutGateDebt };
    const message = debtAdded > 0
      ? fillMessage(recoveryMessages.debt, { paid, debt: debtAdded })
      : fillMessage(recoveryMessages.paid, { fee: paid });
    if (this.onPassOut) await this.onPassOut({ snapshot, paid, debtAdded, fee: tuning.doctorFee, recoverySite });
    return this._announce(message, snapshot);
  }

  _finishIfReady(draft) {
    const chapter = draft.chapters.dayOne;
    if (chapter.complete || !dayOneRequirementsMet(draft)) return false;
    chapter.complete = true;
    pushUnique(draft.eventsSeen, this.content.events.afternoonComplete);
    return true;
  }

  _withCompletion(message, completedNow) {
    return completedNow ? `${message} ${this.content.messages.complete}` : message;
  }

  _announce(message, snapshot = this.session.snapshot()) {
    this.onStatus?.(message, snapshot);
    return message;
  }
}
