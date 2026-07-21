import { DAY_ONE_V01 } from '../content/day-one-v01.js';
import { STEWARDSHIP_V01 } from '../content/stewardship-v01.js';
import { dayOneRequirementsMet } from './GameSession.js';

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function increment(object, key, amount = 1) {
  object[key] = Math.max(0, Number(object[key]) || 0) + amount;
}

function publicState(controller, type = 'snapshot') {
  return Object.freeze({
    type,
    phase: controller.phase,
    active: controller.active,
    elapsed: controller.phaseElapsed,
    tension: controller.tension,
    landingProgress: controller.landingProgress,
    pulling: controller.pulling,
    prompt: controller.prompt,
    outcome: controller.outcome,
  });
}

/**
 * Deterministic transient fishing state machine.
 *
 * Only committed cast consequences and a successful landed catch reach the
 * session. Bobber timing, hook windows, tension, and landing progress remain
 * transient so restoring a save can never resume halfway through a catch.
 */
export class FishingController {
  constructor({
    session,
    content = STEWARDSHIP_V01,
    control = null,
    onStatus = null,
  } = {}) {
    if (!session?.snapshot || !session?.transact) {
      throw new TypeError('FishingController requires a transactional session');
    }
    this.session = session;
    this.content = content;
    this.control = control;
    this.onStatus = typeof onStatus === 'function' ? onStatus : null;
    this.listeners = new Set();
    this.phase = 'idle';
    this.active = false;
    this.phaseElapsed = 0;
    this.tension = 0;
    this.landingProgress = 0;
    this.pulling = false;
    this.outcome = null;
    this.context = null;
    this.rewardCommitted = false;
  }

  get snapshot() {
    return publicState(this);
  }

  get prompt() {
    switch (this.phase) {
      case 'cast': return 'Wait — watch bobber';
      case 'waiting-nibble': return 'Wait for plunge';
      case 'false-nibble': return 'Small nibble — wait';
      case 'waiting-bite': return 'Ready for plunge';
      case 'bite': return 'Tap to hook';
      case 'struggle': return this.tension >= 0.58 ? 'Release line' : 'Hold to reel';
      case 'landing': return 'Tap to land';
      case 'landed': return 'Pond dace landed';
      case 'escaped': return 'Cast again';
      default: return 'Cast into the quiet pond';
    }
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  canStart(snapshot = this.session.snapshot()) {
    const rodId = this.content.fishing.requiredRodId;
    return !this.active
      && Array.isArray(snapshot.player?.tools?.owned)
      && snapshot.player.tools.owned.includes(rodId)
      && snapshot.player?.equipment?.rod === rodId;
  }

  /** Start and commit a cast synchronously; never return a long-lived Promise. */
  start(context = null) {
    if (this.active) {
      return Object.freeze({
        started: false,
        reason: 'already-active',
        message: this.content.messages.fishingBusy,
      });
    }
    const before = this.session.snapshot();
    if (!this.canStart(before)) {
      this.onStatus?.(this.content.messages.rodRequired, before);
      return Object.freeze({
        started: false,
        reason: 'rod-required',
        message: this.content.messages.rodRequired,
      });
    }

    const baitId = before.player.equipment.bait;
    let baitConsumed = null;
    let castSnapshot = before;
    if (baitId) {
      castSnapshot = this.session.transact((draft) => {
        const stackables = draft.player.inventory.stackables;
        const count = Math.max(0, Number(stackables[baitId]) || 0);
        if (count < 1) {
          draft.player.equipment.bait = null;
          return;
        }
        stackables[baitId] = count - 1;
        baitConsumed = baitId;
        if (stackables[baitId] === 0) draft.player.equipment.bait = null;
      });
    }

    this.context = context;
    this.rewardCommitted = false;
    this.tension = 0;
    this.landingProgress = 0;
    this.pulling = false;
    this.outcome = null;
    this.active = true;
    this._setControlLocked(true);
    this._transition('cast', 'start');
    this.onStatus?.(this.content.messages.fishingStarted, castSnapshot);
    return Object.freeze({
      started: true,
      baitConsumed,
      snapshot: castSnapshot,
      state: this.snapshot,
      message: this.content.messages.fishingStarted,
    });
  }

  update(dt, input) {
    if (!this.active) return this.snapshot;
    const delta = Math.min(0.1, Math.max(0, Number(dt) || 0));
    if (delta <= 0) return this.snapshot;

    const pressed = Boolean(input?.consumeActionPress?.('interact'));
    const held = Boolean(input?.isActionHeld?.('interact'));
    this.phaseElapsed += delta;
    const timing = this.content.fishing.timing;

    switch (this.phase) {
      case 'cast':
        if (this.phaseElapsed >= timing.castDuration) this._transition('waiting-nibble');
        break;
      case 'waiting-nibble':
        if (pressed) this._escape('early-hook');
        else if (this.phaseElapsed >= timing.waitBeforeNibble) this._transition('false-nibble');
        break;
      case 'false-nibble':
        if (pressed) this._escape('false-nibble-hook');
        else if (this.phaseElapsed >= timing.falseNibbleDuration) this._transition('waiting-bite');
        break;
      case 'waiting-bite':
        if (pressed) this._escape('early-hook');
        else if (this.phaseElapsed >= timing.waitBeforeBite) this._transition('bite');
        break;
      case 'bite':
        if (pressed) this._transition('struggle', 'hooked');
        else if (this.phaseElapsed >= timing.hookWindow) this._escape('missed-bite');
        break;
      case 'struggle':
        this._updateStruggle(delta, held);
        break;
      case 'landing':
        if (pressed) this._landFish();
        else if (this.phaseElapsed >= timing.landingWindow) this._escape('missed-landing');
        break;
      default:
        break;
    }
    if (this.active) this._emit(publicState(this, 'progress'));
    return this.snapshot;
  }

  cancel(reason = 'cancelled') {
    if (!this.active) return false;
    this._escape(String(reason));
    return true;
  }

  reset() {
    if (this.active) this.cancel('reset');
    this.phase = 'idle';
    this.phaseElapsed = 0;
    this.tension = 0;
    this.landingProgress = 0;
    this.pulling = false;
    this.outcome = null;
    this.context = null;
    this.rewardCommitted = false;
    return this.snapshot;
  }

  dispose() {
    if (this.active) this.cancel('disposed');
    this.listeners.clear();
    this.control = null;
    this.context = null;
  }

  _updateStruggle(dt, held) {
    const tuning = this.content.fishing.struggle;
    const cycleDuration = tuning.pullDuration + tuning.restDuration;
    this.pulling = (this.phaseElapsed % cycleDuration) < tuning.pullDuration;

    if (held) {
      this.landingProgress = clamp01(
        this.landingProgress + tuning.progressPerSecond * dt,
      );
      this.tension = clamp01(this.tension + (
        this.pulling ? tuning.tensionGainPulling : tuning.tensionGainResting
      ) * dt);
    } else {
      this.landingProgress = clamp01(
        this.landingProgress - tuning.progressLossPerSecond * dt,
      );
      this.tension = clamp01(this.tension - tuning.tensionReleasePerSecond * dt);
    }

    if (this.tension >= tuning.breakTension) {
      this._escape('line-broke');
      return;
    }
    if (this.landingProgress >= 1) this._transition('landing', 'shore-reached');
  }

  _landFish() {
    if (this.rewardCommitted) return;
    this.rewardCommitted = true;
    const fish = this.content.fishing.easyFish;
    let specimenId = null;
    const snapshot = this.session.transact((draft) => {
      const inventory = draft.player.inventory;
      const sequence = Math.max(1, Number(inventory.nextSpecimenSequence) || 1);
      specimenId = `catch-${String(sequence).padStart(4, '0')}`;
      inventory.nextSpecimenSequence = sequence + 1;
      inventory.specimens[specimenId] = {
        itemId: fish.itemId,
        condition: 'raw',
        lengthCm: fish.sizeCm,
        quality: fish.quality,
        caughtAt: fish.caughtAt,
      };

      const activity = draft.activities.fishing;
      increment(activity, 'totalCaught');
      increment(activity.caughtBySpecies, fish.speciesId);
      activity.largestCmBySpecies[fish.speciesId] = Math.max(
        Number(activity.largestCmBySpecies[fish.speciesId]) || 0,
        fish.sizeCm,
      );
      if (draft.chapters?.dayOne?.account && draft.chapters.dayOne.complete !== true) {
        increment(draft.chapters.dayOne.account, 'fishCaught');
      }
      if (draft.chapters?.dayOne && dayOneRequirementsMet(draft)) {
        draft.chapters.dayOne.complete = true;
        if (!draft.eventsSeen.includes(DAY_ONE_V01.events.afternoonComplete)) {
          draft.eventsSeen.push(DAY_ONE_V01.events.afternoonComplete);
        }
      }
    });

    this.outcome = Object.freeze({
      kind: 'landed',
      specimenId,
      fish: Object.freeze({ ...fish }),
      snapshot,
    });
    this.phase = 'landed';
    this.phaseElapsed = 0;
    this.active = false;
    this.pulling = false;
    this._setControlLocked(false);
    this._emit(publicState(this, 'landed'));
  }

  _escape(reason) {
    this.outcome = Object.freeze({ kind: 'escaped', reason });
    this.phase = 'escaped';
    this.phaseElapsed = 0;
    this.active = false;
    this.pulling = false;
    this._setControlLocked(false);
    this._emit(publicState(this, 'escaped'));
  }

  _transition(phase, type = 'transition') {
    this.phase = phase;
    this.phaseElapsed = 0;
    this.pulling = false;
    this._emit(publicState(this, type));
  }

  _setControlLocked(locked) {
    this.control?.setActionLocked?.(Boolean(locked), {
      action: { id: 'stewardship.fishing' },
      context: this.context,
    });
  }

  _emit(event) {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.warn('[FishingController] Subscriber failed.', error);
      }
    }
  }
}

export default FishingController;
