import { GameSession, normalizePlayerName } from './GameSession.js';
import { CORE_HOOK_V03 } from '../content/core-hook-v03.js';

function clampScore(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
}

function pushUnique(list, value) {
  if (!list.includes(value)) list.push(value);
}

function pointFrom(value, fallback) {
  if (!value) return { ...fallback };
  return {
    x: Number(value.x) || 0,
    y: Number(value.y) || 0,
    z: Number(value.z) || 0,
  };
}

function horizontalDistance(a, b) {
  if (!a || !b) return 0;
  return Math.hypot((Number(a.x) || 0) - b.x, (Number(a.z) || 0) - b.z);
}

function finitePoint(value) {
  return Boolean(
    value
    && Number.isFinite(Number(value.x))
    && Number.isFinite(Number(value.y))
    && Number.isFinite(Number(value.z)),
  );
}

/**
 * Runs the eight-to-twelve-minute Core Hook Proof without owning rendering,
 * input, or presentation. All visible effects are injected and all authored
 * language and placement lives in core-hook-v03.js.
 */
export class CoreHookDirector {
  constructor(deps = {}) {
    this.content = deps.content || CORE_HOOK_V03;
    this.storyUI = deps.storyUI || null;
    this.session = deps.session || new GameSession({
      storage: deps.storage,
      storageKey: this.content.storageKey,
      now: deps.now,
    });

    this.deps = {
      dayNightSystem: deps.dayNightSystem || null,
      hud: deps.hud || null,
      worldAnimator: deps.worldAnimator || null,
      soundscape: deps.soundscape || null,
      vfx: deps.vfx || null,
      postProcessing: deps.postProcessing || null,
      stewardActor: deps.stewardActor || null,
      moveSteward: deps.moveSteward || null,
      ringAnomalyBell: deps.ringAnomalyBell || null,
      setRoute: deps.setRoute || null,
      getRouteDestination: deps.getRouteDestination || null,
      resetPlayer: deps.resetPlayer || null,
      isDayOneComplete: deps.isDayOneComplete || (() => (
        this.session.snapshot?.().chapters?.dayOne?.complete === true
      )),
      getDayOneObjective: deps.getDayOneObjective || (() => null),
      getDayOneLedgerRecord: deps.getDayOneLedgerRecord || (() => null),
      getStewardPosition: deps.getStewardPosition || (() => this.deps.stewardActor?.position),
      setStoryBlocking: deps.setStoryBlocking || null,
      onObjectiveChange: deps.onObjectiveChange || null,
      onError: deps.onError || null,
    };

    this.interactables = new Map();
    this.stewardInteractable = null;
    this.stewardId = this.content.ids.steward;
    this.bellPosition = { ...this.content.anchors.interactables.bell };

    this.initialized = false;
    this.started = false;
    this.disposed = false;
    this.busy = false;
    this.anomalyElapsed = 0;
    this.arrivalPromise = null;
    this.anomalyPromise = null;
    this.resolutionPromise = null;
    this.activeObjective = null;
    this.generation = 0;
  }

  init({ interactables = [], stewardInteractable = null } = {}) {
    this.interactables.clear();
    for (const interactable of interactables || []) {
      if (interactable?.id) this.interactables.set(interactable.id, interactable);
    }

    this.stewardInteractable = stewardInteractable || null;
    this.stewardId = stewardInteractable?.id || this.content.ids.steward;
    if (stewardInteractable) this.interactables.set(this.stewardId, stewardInteractable);

    const bell = this.interactables.get(this.content.ids.bell);
    this.bellPosition = pointFrom(bell?.position, this.content.anchors.interactables.bell);
    this.initialized = true;
    return this;
  }

  async start() {
    this._assertUsable();
    this.started = true;
    const generation = this.generation;

    await this._synchronizeWorld({ immediate: true });
    await this._setNeighborliness(null, false);

    if (this.session.ending) {
      const choice = this.session.getChoice(this.content.ids.choice);
      const outcome = this.content.outcomes[choice];
      if (outcome && generation === this.generation) {
        await this._setObjective(this.content.objectives[outcome.objective]);
        await this._withBlocking(() => this._showEnding(outcome));
      }
      return this.session.snapshot();
    }

    if (!this.session.hasEvent(this.content.events.stewardMet)) {
      if (!this.session.hasEvent(this.content.events.arrivalMemorySeen)) {
        await this._withBlocking(async () => {
          await this._ui('showLetter', this.content.arrivalMemory);
          if (generation === this.generation) {
            this.session.markEvent(this.content.events.arrivalMemorySeen);
          }
        });
      }
    } else if (!this.session.hasEvent(this.content.events.letterSeen)) {
      await this._withBlocking(async () => {
        await this._ui('showLetter', this.content.letter);
        if (generation === this.generation) {
          this.session.markEvent(this.content.events.letterSeen);
        }
      });
    }

    if (generation === this.generation) await this._setCurrentObjective();
    return this.session.snapshot();
  }

  async refreshObjective() {
    this._assertUsable();
    const events = this.content.events;
    if (
      this.session.hasEvent(events.ledgerSigned)
      && this._isDayOneComplete()
      && !this.session.hasEvent(events.firstBellRung)
    ) {
      await this._applyStoryTime('dusk');
    }
    await this._setCurrentObjective();
    return this.session.snapshot();
  }

  /** Return the current authored objective without mutating state or UI. */
  currentObjective() {
    const events = this.content.events;
    if (this.session.ending) {
      const choice = this.session.getChoice(this.content.ids.choice);
      return this.content.objectives[this.content.outcomes[choice]?.objective] || null;
    }
    if (!this.session.hasEvent(events.stewardMet)) {
      if (!this.session.hasEvent(events.crossroadsReached)) {
        return this.content.objectives.findCrossroads;
      }
      if (!this.session.hasEvent(events.arrivalResponseChosen)) {
        return this.content.objectives.followRememberedPath;
      }
      if (!this.session.hasEvent(events.lanternTaken)) {
        return this.content.objectives.takeLantern;
      }
      return this.content.objectives.crossGate;
    }
    if (!this.session.hasEvent(events.ledgerSigned)) return this.content.objectives.signLedger;
    if (!this._isDayOneComplete()) {
      return this._getDayOneObjective() || this.content.objectives.firstAfternoon;
    }
    if (!this.session.hasEvent(events.firstBellRung)) return this.content.objectives.ringBell;
    if (!this.session.hasEvent(events.anomalyBellRang)) return this.content.objectives.returnToLumen;
    if (!this.session.hasEvent(events.falseRecordSeen)) return this.content.objectives.inspectLedger;
    if (this.session.hasEvent(events.choiceMade)) {
      const choice = this.session.getChoice(this.content.ids.choice);
      return this.content.objectives[this.content.outcomes[choice]?.objective] || null;
    }
    return this.content.objectives.hearCorrection;
  }

  /**
   * Resolve declarative objective targets against the live interaction map.
   * The returned provider intentionally follows moving targets such as Lumen.
   */
  resolveObjectiveTarget(objective = this.activeObjective || this.currentObjective()) {
    const descriptor = objective?.target;
    if (!descriptor || typeof descriptor !== 'object') return null;

    if (descriptor.kind === 'interactable') {
      const interactable = this.interactables.get(descriptor.id);
      if (!interactable?.position || !finitePoint(interactable.position)) return null;
      return {
        id: descriptor.id,
        kind: descriptor.kind,
        radius: Number(descriptor.radius ?? interactable.radius) || 1.35,
        distanceMode: descriptor.distanceMode || 'horizontal',
        getPosition: () => (finitePoint(interactable.position) ? interactable.position : null),
      };
    }

    if (descriptor.kind === 'anchor') {
      if (!finitePoint(descriptor.position)) return null;
      return {
        id: descriptor.id,
        kind: descriptor.kind,
        radius: Number(descriptor.radius) || 1.35,
        distanceMode: descriptor.distanceMode || 'horizontal',
        getPosition: () => (finitePoint(descriptor.position) ? descriptor.position : null),
      };
    }

    if (descriptor.kind === 'route-destination') {
      const getPosition = () => {
        try {
          const destination = this.deps.getRouteDestination?.(descriptor.route) || null;
          return finitePoint(destination) ? destination : null;
        } catch (error) {
          this._reportError(error, 'objective-route-destination');
          return null;
        }
      };
      if (!getPosition()) return null;
      return {
        id: descriptor.route,
        kind: descriptor.kind,
        radius: Number(descriptor.arrivalRadius ?? descriptor.radius)
          || this.content.timing.routeArrivalRadius
          || 1.35,
        distanceMode: descriptor.distanceMode || 'horizontal',
        getPosition,
      };
    }

    return null;
  }

  /**
   * Advances the delayed second-bell trigger. Returns the anomaly promise when
   * it fires, allowing tests or integrations to await the authored side effects.
   */
  update(dt, playerPosition) {
    if (this.disposed) return null;

    const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.25);
    this.deps.stewardActor?.update?.(safeDt);
    if (!this.busy && playerPosition) this.deps.stewardActor?.lookAt?.(playerPosition);

    const events = this.content.events;
    if (!this.session.hasEvent(events.stewardMet)) {
      if (
        !this.busy
        && playerPosition
        && !this.session.hasEvent(events.crossroadsReached)
        && horizontalDistance(playerPosition, this.content.anchors.player.crossroads)
          <= (this.content.objectives.findCrossroads.target.radius || 2)
      ) {
        this.session.markEvent(events.crossroadsReached);
        void this._setCurrentObjective();
      }

      if (
        !this.busy
        && playerPosition
        && this.session.hasEvent(events.lanternTaken)
        && horizontalDistance(playerPosition, this.content.anchors.player.gateInside)
          <= (this.content.objectives.crossGate.target.radius || 1.45)
        && !this.arrivalPromise
      ) {
        this.arrivalPromise = this._completeArrival()
          .catch((error) => {
            this._reportError(error, 'arrival');
            return this.session.snapshot();
          })
          .finally(() => {
            this.arrivalPromise = null;
          });
      }
      return this.arrivalPromise;
    }

    const choice = this.session.getChoice(this.content.ids.choice);
    if (
      !this.busy
      && this.session.phase === 'resolution'
      && choice
      && !this.session.ending
      && playerPosition
    ) {
      let destination = null;
      try {
        destination = this.deps.getRouteDestination?.(choice) || null;
      } catch (error) {
        this._reportError(error, 'route-destination');
      }

      if (
        destination
        && horizontalDistance(playerPosition, destination)
          <= (this.content.timing.routeArrivalRadius ?? 1.35)
        && !this.resolutionPromise
      ) {
        this.resolutionPromise = this._completeOutcome(choice)
          .catch((error) => {
            this._reportError(error, 'ending');
            return this.session.snapshot();
          })
          .finally(() => {
            this.resolutionPromise = null;
          });
      }
      if (this.resolutionPromise) return this.resolutionPromise;
    }

    if (
      this.busy
      || this.session.phase !== 'dusk'
      || !this.session.hasEvent(this.content.events.firstBellRung)
      || this.session.hasEvent(this.content.events.anomalyBellRang)
    ) {
      return this.anomalyPromise;
    }

    this.anomalyElapsed += safeDt;
    const timing = this.content.timing;
    const movedAway = horizontalDistance(playerPosition, this.bellPosition)
      >= timing.anomalyDistanceFromBell;
    const nearSteward = horizontalDistance(playerPosition, this._getStewardPosition())
      <= timing.anomalyDistanceToSteward;
    const distanceReady = movedAway
      && nearSteward
      && this.anomalyElapsed >= timing.anomalyMinimumDelay;

    if (distanceReady && !this.anomalyPromise) {
      this.anomalyPromise = this._fireAnomaly()
        .catch((error) => {
          this._reportError(error, 'anomaly');
          return this.session.snapshot();
        })
        .finally(() => {
          this.anomalyPromise = null;
        });
    }

    return this.anomalyPromise;
  }

  promptFor(id) {
    if (!this.isInteractableEnabled(id)) return null;
    const role = this._roleFor(id);
    const events = this.content.events;

    if (role === 'steward') {
      return this.session.hasEvent(events.arrivalResponseChosen)
        ? this.content.prompts.hearCorrection
        : this.content.prompts.meetSteward;
    }
    if (role === 'lantern') return this.content.prompts.takeLantern;
    if (role === 'ledger') {
      if (!this.session.hasEvent(events.ledgerSigned)) return this.content.prompts.signLedger;
      if (this.session.hasEvent(events.anomalyBellRang)) return this.content.prompts.inspectLedger;
      return this.content.prompts.reviewLedger;
    }
    if (role === 'bell') return this.content.prompts.ringBell;
    return null;
  }

  isInteractableEnabled(id) {
    if (this.disposed || this.busy || this.session.ending) return false;

    const role = this._roleFor(id);
    const events = this.content.events;
    const met = this.session.hasEvent(events.stewardMet);
    const arrivalResponse = this.session.hasEvent(events.arrivalResponseChosen);
    const lanternTaken = this.session.hasEvent(events.lanternTaken);
    const signed = this.session.hasEvent(events.ledgerSigned);
    const dayOneComplete = this._isDayOneComplete();
    const firstBell = this.session.hasEvent(events.firstBellRung);
    const anomaly = this.session.hasEvent(events.anomalyBellRang);
    const falseRecord = this.session.hasEvent(events.falseRecordSeen);
    const choiceMade = this.session.hasEvent(events.choiceMade);

    if (role === 'steward') return (!met && !arrivalResponse) || (falseRecord && !choiceMade);
    if (role === 'lantern') return arrivalResponse && !met && !lanternTaken;
    if (role === 'ledger') {
      return (met && !signed) || (signed && !anomaly) || (anomaly && !falseRecord);
    }
    if (role === 'bell') return signed && dayOneComplete && !firstBell;
    return false;
  }

  async interact(id) {
    this._assertUsable();
    if (this.busy) return { handled: false, reason: 'busy' };
    if (!this.isInteractableEnabled(id)) return { handled: false, reason: 'locked' };

    const role = this._roleFor(id);
    if (!role) return { handled: false, reason: 'unknown' };

    this.busy = true;
    this._setBlocking(true);
    try {
      if (role === 'steward') await this._interactSteward();
      else if (role === 'lantern') await this._interactLantern();
      else if (role === 'ledger') await this._interactLedger();
      else if (role === 'bell') await this._interactBell();

      return {
        handled: true,
        id,
        phase: this.session.phase,
        state: this.session.snapshot(),
      };
    } finally {
      this.busy = false;
      this._setBlocking(false);
    }
  }

  async reset() {
    this._assertUsable();
    this.generation += 1;
    this.busy = false;
    this.anomalyElapsed = 0;
    this.arrivalPromise = null;
    this.anomalyPromise = null;
    this.resolutionPromise = null;
    this.session.reset();

    await this._applyStoryTime('day', true);
    await this._safeCall(this.deps.setRoute, null);
    await this._moveSteward('welcome', true);
    await this._safeCall(this.deps.resetPlayer);
    this.deps.stewardActor?.play?.('idle');
    await this._setNeighborliness(null, false);
    await this._setObjective(this.content.objectives.findCrossroads);
    this.deps.hud?.setStatus?.(this.content.status.reset);
    return this.session.snapshot();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation += 1;
    this.busy = false;
    this.arrivalPromise = null;
    this.anomalyPromise = null;
    this.resolutionPromise = null;
    this.activeObjective = null;
    try {
      this.deps.onObjectiveChange?.(null, null);
    } catch (error) {
      this._reportError(error, 'objective-change');
    }
    this.interactables.clear();
    this.stewardInteractable = null;
    this._setBlocking(false);
  }

  async _interactSteward() {
    const events = this.content.events;
    if (!this.session.hasEvent(events.stewardMet)) {
      if (!this.session.hasEvent(events.crossroadsReached)) {
        this.session.markEvent(events.crossroadsReached);
      }
      await this._sayDialogue(this.content.dialogue.welcome, 'joy');

      const selected = await this._ui('choose', this.content.arrivalChoice);
      const posture = typeof selected === 'string' ? selected : selected?.id ?? selected?.value;
      const allowedPostures = new Set(
        this.content.arrivalChoice.choices.map((choice) => choice.id),
      );
      if (!allowedPostures.has(posture)) {
        throw new TypeError(`Unknown arrival posture: ${posture}`);
      }

      this.session.transact((draft) => {
        draft.choices[this.content.ids.arrivalChoice] = posture;
        pushUnique(draft.eventsSeen, events.arrivalResponseChosen);
      });
      await this._sayDialogue(this.content.dialogue.arrivalResponse);
      await this._setCurrentObjective();
      return;
    }

    if (!this.session.hasEvent(events.correctionHeard)) {
      await this._sayDialogue(this.content.dialogue.correction);
      this.session.markEvent(events.correctionHeard);
    }

    const selected = await this._ui('choose', this.content.choice);
    const choice = typeof selected === 'string' ? selected : selected?.id ?? selected?.value;
    if (!this.content.outcomes[choice]) throw new TypeError(`Unknown core-hook choice: ${choice}`);
    await this._resolveChoice(choice);
  }

  async _interactLantern() {
    const events = this.content.events;
    if (this.session.hasEvent(events.lanternTaken)) return;
    this.session.markEvent(events.lanternTaken);
    this._interactionFeedback(this.content.ids.lantern, 'kindness', 0.24);
    await this._setCurrentObjective();
  }

  async _completeArrival() {
    const events = this.content.events;
    if (this.session.hasEvent(events.stewardMet)) return this.session.snapshot();
    const generation = this.generation;
    this.busy = true;
    this._setBlocking(true);
    try {
      await this._ui('showLetter', this.content.letter);
      if (generation !== this.generation || this.disposed) return this.session.snapshot();

      const change = this.content.neighborliness.welcome;
      this.session.transact((draft) => {
        pushUnique(draft.eventsSeen, events.letterSeen);
        pushUnique(draft.eventsSeen, events.stewardMet);
        pushUnique(draft.rulesKnown, this.content.ids.rule);
        draft.phase = 'day-routine';
        draft.relationship.steward = 'warm';
        draft.neighborliness = clampScore(draft.neighborliness + change.amount);
      });

      await this._moveSteward('routine');
      await this._setNeighborliness(change);
      await this._setCurrentObjective();
      return this.session.snapshot();
    } finally {
      if (generation === this.generation) this.busy = false;
      this._setBlocking(false);
    }
  }

  async _interactLedger() {
    const events = this.content.events;
    if (!this.session.hasEvent(events.ledgerSigned)) {
      const submittedName = await this._ui('signRecord', {
        ...this.content.records.signature,
        initialValue: this.session.playerName || '',
      });
      const playerName = normalizePlayerName(submittedName);
      if (!playerName) throw new TypeError('The Community Ledger requires a player name');

      const change = this.content.neighborliness.ledger;
      // Persist the submitted signature and story event together before the
      // steward responds. Closing or reloading during that response must not
      // make the player sign a second time or lose the name they entered.
      this.session.transact((draft) => {
        draft.playerName = playerName;
        pushUnique(draft.eventsSeen, events.ledgerSigned);
        draft.neighborliness = clampScore(draft.neighborliness + change.amount);
      });
      await this._sayDialogue(this.content.dialogue.ledgerAccepted, 'joy');

      this._interactionFeedback(this.content.ids.ledger, 'kindness', 0.28);
      await this._setNeighborliness(change);
      await this._setCurrentObjective();
      return;
    }

    if (!this.session.hasEvent(events.anomalyBellRang)) {
      await this._ui(
        'showRecord',
        this._getDayOneLedgerRecord() || this.content.records.dayOneFallback,
      );
      await this._setCurrentObjective();
      return;
    }

    await this._ui('showRecord', {
      ...this.content.records.falseCorrection,
      signature: this.session.playerName || this.content.records.falseCorrection.signature,
    });
    this.session.transact((draft) => {
      pushUnique(draft.eventsSeen, events.falseRecordSeen);
      draft.phase = 'intervention';
      draft.relationship.steward = 'corrective';
    });

    this.deps.stewardActor?.play?.('idle');
    await this._moveSteward('correction');
    await this._setObjective(this.content.objectives.hearCorrection);
  }

  async _interactBell() {
    const events = this.content.events;
    const change = this.content.neighborliness.bell;

    this.session.transact((draft) => {
      pushUnique(draft.eventsSeen, events.firstBellRung);
      draft.phase = 'dusk';
      draft.neighborliness = clampScore(draft.neighborliness + change.amount);
    });
    this.anomalyElapsed = 0;

    this.deps.worldAnimator?.ringBell?.();
    this._interactionFeedback(this.content.ids.bell, 'bell', 0.5);
    await this._sayDialogue(this.content.dialogue.firstBell, 'joy');
    await this._setNeighborliness(change);
    await this._applyStoryTime('night');
    await this._setObjective(this.content.objectives.returnToLumen);
  }

  async _fireAnomaly() {
    const events = this.content.events;
    if (this.session.hasEvent(events.anomalyBellRang)) return this.session.snapshot();
    const generation = this.generation;
    this.busy = true;
    let committed = false;

    const commitAnomaly = () => {
      if (committed || this.session.hasEvent(events.anomalyBellRang)) return;
      // Commit on the reveal frame, before its sound and VFX. A reload during
      // the fly-in may replay a Bell that never rang; once the player hears it,
      // the durable event already prevents a duplicate supernatural ring.
      this.session.transact((draft) => {
        pushUnique(draft.eventsSeen, events.anomalyBellRang);
        draft.phase = 'night-investigation';
      });
      committed = true;
    };

    try {
      if (typeof this.deps.ringAnomalyBell === 'function') {
        await this._safeCall(this.deps.ringAnomalyBell, { onReveal: commitAnomaly });
      }

      if (generation !== this.generation || this.disposed) return this.session.snapshot();

      if (!committed) {
        // The adapter failed or was cancelled without a reveal while this
        // director remained live. Produce one direct, durable fallback ring.
        commitAnomaly();
        this.deps.worldAnimator?.ringBell?.();
        this.deps.soundscape?.playInteraction?.('bell');
        this._interactionFeedback(this.content.ids.bell, 'magic', 0.7, { playSound: false });
      }

      this.deps.hud?.setStatus?.(this.content.status.anomaly);
      await this._setObjective(this.content.objectives.inspectLedger);
      return this.session.snapshot();
    } finally {
      if (generation === this.generation) this.busy = false;
    }
  }

  async _resolveChoice(choice) {
    const outcome = this.content.outcomes[choice];
    const events = this.content.events;
    const change = this.content.neighborliness[choice];

    this.session.transact((draft) => {
      draft.choices[this.content.ids.choice] = choice;
      draft.phase = 'resolution';
      draft.relationship.steward = outcome.relationship;
      draft.neighborliness = clampScore(draft.neighborliness + change.amount);
      pushUnique(draft.eventsSeen, events.choiceMade);
    });

    // The acceptance gate is deliberately explicit: route, NPC response, and
    // ending presentation are independent downstream consequences.
    await this._safeCall(this.deps.setRoute, choice);
    await this._moveSteward(outcome.stewardAnchor);
    this.deps.stewardActor?.play?.(choice === 'comply' ? 'joy' : 'idle');
    await this._sayDialogue(
      this.content.dialogue[outcome.response],
      choice === 'comply' ? 'joy' : 'idle',
    );
    await this._setNeighborliness(change);
    await this._setObjective(this.content.objectives[outcome.objective]);
    this.deps.postProcessing?.pulse?.(choice === 'comply' ? 0.65 : 0.42);
  }

  async _completeOutcome(choice) {
    const outcome = this.content.outcomes[choice];
    if (!outcome || this.session.ending) return this.session.snapshot();

    // Persist the reached ending before presentation. A reload during the card
    // restores the ending instead of reopening the route trigger.
    this.session.transact((draft) => {
      draft.ending = outcome.ending;
      pushUnique(draft.eventsSeen, this.content.events.endingSeen);
    });
    await this._withBlocking(() => this._showEnding(outcome));
    return this.session.snapshot();
  }

  async _showEnding(outcome) {
    const generation = this.generation;
    return this._ui('showEnding', {
      ...outcome.endingCard,
      onReset: async () => {
        if (generation !== this.generation || this.disposed) return;
        await this.reset();
        // StoryUI closes the current ending after onReset resolves. Restart on
        // the following task so the new letter cannot be closed with that card.
        globalThis.setTimeout?.(() => {
          void this.start().catch((error) => this._reportError(error, 'restart'));
        }, 0);
      },
    });
  }

  async _synchronizeWorld({ immediate = false } = {}) {
    const events = this.content.events;
    const choice = this.session.getChoice(this.content.ids.choice);

    if (this.session.hasEvent(events.firstBellRung)) await this._applyStoryTime('night', immediate);
    else if (this.session.hasEvent(events.ledgerSigned) && this._isDayOneComplete()) {
      await this._applyStoryTime('dusk', immediate);
    }
    else await this._applyStoryTime('day', immediate);

    if (choice) await this._safeCall(this.deps.setRoute, choice);
    else await this._safeCall(this.deps.setRoute, null);

    if (
      this.session.hasEvent(events.firstBellRung)
      && !this.session.hasEvent(events.anomalyBellRang)
    ) {
      await this._safeCall(
        this.deps.resetPlayer,
        this.content.anchors.player?.firstBellReturn,
      );
    }

    if (choice && this.content.outcomes[choice]) {
      await this._moveSteward(this.content.outcomes[choice].stewardAnchor, true);
    } else if (this.session.hasEvent(events.falseRecordSeen)) {
      await this._moveSteward('correction', true);
    } else if (this.session.hasEvent(events.stewardMet)) {
      await this._moveSteward('routine', true);
    } else {
      await this._moveSteward('welcome', true);
    }
  }

  async _applyStoryTime(time, immediate = false) {
    const system = this.deps.dayNightSystem;
    if (system?.applyStoryTime) system.applyStoryTime(time, immediate);
    else if (time === 'night') system?.applyNight?.(immediate);
    else if (time === 'dusk') system?.applyDusk?.(immediate);
    else system?.applyDay?.(immediate);

    const isNight = time === 'night';
    this.deps.soundscape?.setDayNight?.(isNight);
    this.deps.hud?.setDayNight?.(time.toUpperCase());
  }

  async _moveSteward(anchorName, immediate = false) {
    const anchor = this.content.anchors.steward[anchorName];
    if (!anchor) return;

    if (typeof this.deps.moveSteward === 'function') {
      await this._safeCall(this.deps.moveSteward, anchor, { immediate, id: anchorName });
      return;
    }

    const actor = this.deps.stewardActor;
    if (!actor) return;
    const target = [anchor.x, anchor.y, anchor.z];
    if (immediate) actor.teleport?.(target, anchor.facing);
    else actor.moveTo?.(target, { facingYaw: anchor.facing });
  }

  _interactionFeedback(id, kind, pulse, { playSound = true } = {}) {
    const fallback = this.content.anchors.interactables[id] || { x: 0, y: 0, z: 0 };
    const position = pointFrom(this.interactables.get(id)?.position, fallback);
    position.y += 1.05;
    this.deps.vfx?.interactionBurst?.(position, kind);
    this.deps.postProcessing?.pulse?.(pulse);
    if (playSound) this.deps.soundscape?.playInteraction?.(kind);
  }

  async _setNeighborliness(change = null, animate = true) {
    if (!this.storyUI?.setNeighborliness) return;
    await Promise.resolve(this.storyUI.setNeighborliness(
      this.session.neighborliness,
      {
        animate,
        label: 'Neighborliness',
        change,
      },
    ));
  }

  async _setObjective(objective) {
    this.activeObjective = objective || null;
    if (this.storyUI?.setObjective) {
      await Promise.resolve(this.storyUI.setObjective(objective));
    }
    try {
      this.deps.onObjectiveChange?.(
        this.activeObjective,
        this.resolveObjectiveTarget(this.activeObjective),
      );
    } catch (error) {
      this._reportError(error, 'objective-change');
    }
  }

  async _setCurrentObjective() {
    await this._setObjective(this.currentObjective());
  }

  _isDayOneComplete() {
    const eventId = this.content.events.firstAfternoonComplete;
    if (eventId && this.session.hasEvent(eventId)) return true;
    try {
      return Boolean(this.deps.isDayOneComplete?.());
    } catch (error) {
      this._reportError(error, 'day-one-completion');
      return false;
    }
  }

  _getDayOneObjective() {
    try {
      return this.deps.getDayOneObjective?.() || null;
    } catch (error) {
      this._reportError(error, 'day-one-objective');
      return null;
    }
  }

  _getDayOneLedgerRecord() {
    try {
      return this.deps.getDayOneLedgerRecord?.() || null;
    } catch (error) {
      this._reportError(error, 'day-one-ledger-record');
      return null;
    }
  }

  _getStewardPosition() {
    try {
      return pointFrom(
        this.deps.getStewardPosition?.(),
        this.content.anchors.steward.routine,
      );
    } catch (error) {
      this._reportError(error, 'steward-position');
      return pointFrom(null, this.content.anchors.steward.routine);
    }
  }

  async _ui(method, value) {
    const callback = this.storyUI?.[method];
    if (typeof callback !== 'function') {
      throw new TypeError(`CoreHookDirector requires StoryUI.${method}()`);
    }
    return Promise.resolve(callback.call(this.storyUI, value));
  }

  /**
   * Bind declarative dialogue beats to Lumen's semantic performance without
   * making animation, timing, or UI progression authoritative story state.
   * Older one-block dialogue remains valid and simply renders without a beat
   * callback.
   */
  async _sayDialogue(dialogue, fallbackRole = 'idle') {
    const value = dialogue && typeof dialogue === 'object' ? dialogue : {};
    const beats = Array.isArray(value.beats) ? value.beats : [];
    if (beats.length === 0) return this._ui('say', value);

    let activeGesture = null;
    const authoredBeatChange = typeof value.onBeatChange === 'function'
      ? value.onBeatChange
      : null;
    const onBeatChange = (beat, index, metadata) => {
      const nextGesture = typeof beat?.gesture === 'string' ? beat.gesture : null;
      if (activeGesture && activeGesture !== nextGesture) {
        this._stopStewardAction(activeGesture);
        activeGesture = null;
      }
      if (nextGesture && nextGesture !== activeGesture) {
        this._playStewardAction(nextGesture, beat?.fallbackRole || fallbackRole);
        activeGesture = nextGesture;
      }
      try {
        authoredBeatChange?.(beat, index, metadata);
      } catch (error) {
        this._reportError(error, 'dialogue-beat');
      }
    };

    try {
      return await this._ui('say', { ...value, onBeatChange });
    } finally {
      if (activeGesture) this._stopStewardAction(activeGesture);
    }
  }

  async _withBlocking(callback) {
    this._setBlocking(true);
    try {
      return await callback();
    } finally {
      this._setBlocking(false);
    }
  }

  _setBlocking(blocking) {
    try {
      this.deps.setStoryBlocking?.(Boolean(blocking));
    } catch (error) {
      this._reportError(error, 'blocking');
    }
  }

  async _safeCall(callback, ...args) {
    if (typeof callback !== 'function') return undefined;
    try {
      return await Promise.resolve(callback(...args));
    } catch (error) {
      this._reportError(error, 'effect');
      return undefined;
    }
  }

  _playStewardAction(name, fallbackRole = 'idle') {
    const actor = this.deps.stewardActor;
    try {
      if (name && actor?.playAction?.(name)) return true;
      return actor?.play?.(fallbackRole) ?? false;
    } catch (error) {
      this._reportError(error, 'steward-action');
      try {
        return actor?.play?.(fallbackRole) ?? false;
      } catch {
        return false;
      }
    }
  }

  _stopStewardAction(name) {
    const actor = this.deps.stewardActor;
    try {
      if (name && actor?.cancelAction?.(name)) return true;
      return actor?.play?.('idle') ?? false;
    } catch (error) {
      this._reportError(error, 'steward-action-stop');
      try {
        return actor?.play?.('idle') ?? false;
      } catch {
        return false;
      }
    }
  }

  _roleFor(id) {
    if (id === this.stewardId || id === this.content.ids.steward) return 'steward';
    if (id === this.content.ids.lantern) return 'lantern';
    if (id === this.content.ids.ledger) return 'ledger';
    if (id === this.content.ids.bell) return 'bell';
    return null;
  }

  _assertUsable() {
    if (this.disposed) throw new Error('CoreHookDirector has been disposed');
    if (!this.initialized) throw new Error('CoreHookDirector.init() must be called first');
  }

  _reportError(error, context) {
    try {
      this.deps.onError?.(error, context);
    } catch {
      // Error reporting must never become a progression blocker.
    }
    if (!this.deps.onError) console.error(`[CoreHookDirector] ${context} failed`, error);
  }
}

export default CoreHookDirector;
