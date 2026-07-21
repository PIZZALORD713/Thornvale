import { DAY_ONE_V01 } from '../content/day-one-v01.js';
import { STEWARDSHIP_V01 } from '../content/stewardship-v01.js';
import { dayOneRequirementsMet } from './GameSession.js';

function includes(value, item) {
  return Array.isArray(value) && value.includes(item);
}

function increment(object, key, amount = 1) {
  object[key] = Math.max(0, Number(object[key]) || 0) + amount;
}

function result(kind, values = {}) {
  return Object.freeze({ kind, ...values });
}

/**
 * Authoritative v1 woodcutting and tree-planting rules.
 *
 * Animation code calls these methods at its visible contact cue. The director
 * owns no timer or Three.js object; every applied contact is one synchronous
 * GameSession transaction, and a stump can never pay its reward twice.
 */
export class WoodcuttingDirector {
  constructor({
    session,
    content = STEWARDSHIP_V01,
    onStatus = null,
    onExhausted = null,
    laborCost = DAY_ONE_V01.tuning.labor.chop,
  } = {}) {
    if (!session?.snapshot || !session?.transact) {
      throw new TypeError('WoodcuttingDirector requires a transactional session');
    }
    this.session = session;
    this.content = content;
    this.onStatus = typeof onStatus === 'function' ? onStatus : null;
    this.onExhausted = typeof onExhausted === 'function' ? onExhausted : null;
    this.laborCost = {
      energy: Math.max(0, Number(laborCost?.energy) || 0),
      nourishment: Math.max(0, Number(laborCost?.nourishment) || 0),
    };
    this.treeDefinitions = new Map(content.trees.map((tree) => [tree.id, tree]));
    this.plantingSites = new Map(content.plantingSites.map((site) => [site.id, site]));
  }

  handles(id) {
    return id === this.content.ids.axePickup
      || this.treeDefinitions.has(id)
      || this.plantingSites.has(id);
  }

  isInteractableEnabled(id, snapshot = this.session.snapshot()) {
    if (id === this.content.ids.axePickup) return !this._ownsAxe(snapshot);
    if (this.treeDefinitions.has(id)) {
      return this._hasEquippedAxe(snapshot)
        && snapshot.world?.trees?.byId?.[id]?.stage === 'mature';
    }
    if (this.plantingSites.has(id)) {
      return this._treeSeedCount(snapshot) > 0 && !this._treeAtSite(snapshot, id);
    }
    return false;
  }

  promptFor(id, snapshot = this.session.snapshot()) {
    if (id === this.content.ids.axePickup) {
      return this._ownsAxe(snapshot) ? 'Equip the fRiENDSiES axe' : 'Pick up the fRiENDSiES axe';
    }
    if (this.treeDefinitions.has(id)) {
      const tree = snapshot.world?.trees?.byId?.[id];
      if (tree?.stage === 'stump') return 'The tree is now a stump';
      if (!this._ownsAxe(snapshot)) return 'Find an axe before cutting this tree';
      if (!this._hasEquippedAxe(snapshot)) return 'Equip the fRiENDSiES axe';
      const requiredHits = this.treeDefinitions.get(id).requiredHits;
      const remaining = Math.max(1, requiredHits - (Number(tree?.hitCount) || 0));
      return remaining === 1 ? 'Give the tree its final chop' : `Chop the tree · ${remaining} strikes remain`;
    }
    if (this.plantingSites.has(id)) {
      if (this._treeAtSite(snapshot, id)) return 'A seedling is growing here';
      return this._treeSeedCount(snapshot) > 0
        ? 'Plant a replacement tree'
        : 'Find a mature tree seed';
    }
    return '';
  }

  canAffordStrike(snapshot = this.session.snapshot()) {
    return Math.max(0, Number(snapshot.player?.meters?.energy) || 0) >= this.laborCost.energy;
  }

  interact(id) {
    if (id === this.content.ids.axePickup) return this.collectAxe();
    if (this.treeDefinitions.has(id)) return this.strikeTree(id);
    if (this.plantingSites.has(id)) return this.plantTree(id);
    return result('unhandled', { applied: false, id });
  }

  collectAxe() {
    const axeId = this.content.tools.axe;
    const before = this.session.snapshot();
    if (this._ownsAxe(before) && before.player?.equipment?.axe === axeId) {
      return this._announce(result('axe-pickup', {
        applied: false,
        reason: 'already-owned',
        toolId: axeId,
        message: this.content.messages.axeAlreadyOwned,
      }));
    }

    let applied = false;
    const snapshot = this.session.transact((draft) => {
      const owned = draft.player.tools.owned;
      if (!owned.includes(axeId)) {
        owned.push(axeId);
        applied = true;
      }
      if (draft.player.equipment.axe !== axeId) {
        draft.player.equipment.axe = axeId;
        applied = true;
      }
    });
    return this._announce(result('axe-pickup', {
      applied,
      toolId: axeId,
      snapshot,
      message: this.content.messages.axeFound,
    }));
  }

  strikeTree(treeId) {
    const definition = this.treeDefinitions.get(treeId);
    if (!definition) return result('tree-strike', { applied: false, reason: 'unknown-tree', treeId });

    const before = this.session.snapshot();
    if (!this._hasEquippedAxe(before)) {
      return this._announce(result('tree-strike', {
        applied: false,
        reason: 'axe-required',
        treeId,
        message: this.content.messages.axeRequired,
      }));
    }
    if (before.world?.trees?.byId?.[treeId]?.stage !== 'mature') {
      return this._announce(result('tree-strike', {
        applied: false,
        reason: 'not-mature',
        treeId,
        message: this.content.messages.treeSpent,
      }));
    }
    if (!this.canAffordStrike(before)) {
      this._beginExhaustionRecovery();
      return result('tree-strike', {
        applied: false,
        reason: 'exhausted',
        treeId,
      });
    }

    let applied = false;
    let felled = false;
    let hitCount = Number(before.world.trees.byId[treeId].hitCount) || 0;
    const snapshot = this.session.transact((draft) => {
      const tree = draft.world.trees.byId[treeId];
      if (
        !tree
        || tree.stage !== 'mature'
        || !this._hasEquippedAxe(draft)
        || !this.canAffordStrike(draft)
      ) return;

      draft.player.meters.energy = Math.max(
        0,
        draft.player.meters.energy - this.laborCost.energy,
      );
      draft.player.meters.nourishment = Math.max(
        0,
        draft.player.meters.nourishment - this.laborCost.nourishment,
      );
      hitCount = Math.min(definition.requiredHits, (Number(tree.hitCount) || 0) + 1);
      tree.hitCount = hitCount;
      const activity = draft.activities.woodcutting;
      applied = true;

      if (hitCount < definition.requiredHits) return;
      tree.stage = 'stump';
      felled = true;
      increment(activity, 'treesFelled');
      for (const [itemId, amount] of Object.entries(definition.rewards)) {
        increment(draft.player.inventory.stackables, itemId, amount);
      }
      increment(
        activity,
        'woodHarvested',
        definition.rewards[this.content.items.wood] || 0,
      );
      if (draft.chapters?.dayOne?.account && draft.chapters.dayOne.complete !== true) {
        increment(
          draft.chapters.dayOne.account,
          'woodGathered',
          definition.rewards[this.content.items.wood] || 0,
        );
      }
      if (draft.chapters?.dayOne && dayOneRequirementsMet(draft)) {
        draft.chapters.dayOne.complete = true;
        if (!draft.eventsSeen.includes(DAY_ONE_V01.events.afternoonComplete)) {
          draft.eventsSeen.push(DAY_ONE_V01.events.afternoonComplete);
        }
      }
    });

    if (!applied) {
      return this._announce(result('tree-strike', {
        applied: false,
        reason: 'stale-tree',
        treeId,
        message: this.content.messages.treeSpent,
      }));
    }
    return this._announce(result('tree-strike', {
      applied: true,
      treeId,
      hitCount,
      requiredHits: definition.requiredHits,
      felled,
      rewards: felled ? definition.rewards : null,
      snapshot,
      message: felled ? this.content.messages.treeFelled : this.content.messages.treeStruck,
    }));
  }

  plantTree(siteId) {
    const site = this.plantingSites.get(siteId);
    if (!site) return result('tree-planting', { applied: false, reason: 'unknown-site', siteId });
    const before = this.session.snapshot();
    if (this._treeAtSite(before, siteId)) {
      return this._announce(result('tree-planting', {
        applied: false,
        reason: 'occupied',
        siteId,
        message: this.content.messages.siteOccupied,
      }));
    }
    if (this._treeSeedCount(before) < 1) {
      return this._announce(result('tree-planting', {
        applied: false,
        reason: 'seed-required',
        siteId,
        message: this.content.messages.seedRequired,
      }));
    }

    let applied = false;
    let treeId = null;
    const snapshot = this.session.transact((draft) => {
      if (this._treeAtSite(draft, siteId) || this._treeSeedCount(draft) < 1) return;
      const sequence = Math.max(1, Number(draft.world.trees.nextPlayerTreeSequence) || 1);
      treeId = `tree.player.${String(sequence).padStart(4, '0')}`;
      draft.world.trees.nextPlayerTreeSequence = sequence + 1;
      draft.player.inventory.stackables[this.content.items.treeSeed] -= 1;
      draft.world.trees.byId[treeId] = {
        definitionId: site.plantedDefinitionId,
        stage: site.plantedStage,
        hitCount: 0,
        plantingSiteId: siteId,
      };
      increment(draft.activities.woodcutting, 'treesPlanted');
      applied = true;
    });

    return this._announce(result('tree-planting', {
      applied,
      reason: applied ? null : 'stale-site',
      siteId,
      treeId,
      snapshot,
      message: applied ? this.content.messages.seedPlanted : this.content.messages.siteOccupied,
    }));
  }

  _ownsAxe(snapshot) {
    return includes(snapshot.player?.tools?.owned, this.content.tools.axe);
  }

  _hasEquippedAxe(snapshot) {
    return this._ownsAxe(snapshot)
      && snapshot.player?.equipment?.axe === this.content.tools.axe;
  }

  _treeSeedCount(snapshot) {
    return Math.max(0, Number(
      snapshot.player?.inventory?.stackables?.[this.content.items.treeSeed],
    ) || 0);
  }

  _treeAtSite(snapshot, siteId) {
    return Object.entries(snapshot.world?.trees?.byId || {}).find(
      ([, tree]) => tree?.plantingSiteId === siteId && tree?.stage !== 'removed',
    )?.[0] || null;
  }

  _beginExhaustionRecovery() {
    if (!this.onExhausted) return;
    try {
      const pending = this.onExhausted();
      pending?.catch?.((error) => {
        console.warn('[WoodcuttingDirector] Exhaustion recovery failed.', error);
      });
    } catch (error) {
      console.warn('[WoodcuttingDirector] Exhaustion recovery failed.', error);
    }
  }

  _announce(outcome) {
    if (outcome.message) this.onStatus?.(outcome.message, outcome.snapshot || this.session.snapshot());
    return outcome;
  }
}

export default WoodcuttingDirector;
