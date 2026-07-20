import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GAME_SESSION_VERSION,
  GameSession,
} from '../src/game/GameSession.js';
import { CoreHookDirector } from '../src/game/CoreHookDirector.js';
import { CORE_HOOK_V03 } from '../src/content/core-hook-v03.js';
import { STORY_ACTIONS_V1 } from '../src/content/story-actions-v1.js';

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

function completeDayOneDraft(draft) {
  draft.dayOne.activity.woodGathered = 6;
  draft.dayOne.activity.fishCaught = 1;
  draft.dayOne.activity.mealsCooked = 1;
  draft.dayOne.activity.mealsEaten = 1;
  draft.dayOne.activity.seedsPlanted = 1;
  draft.dayOne.garden.planted = true;
  draft.dayOne.garden.watered = true;
  draft.dayOne.camp.fireLit = true;
  draft.dayOne.camp.shelterRepaired = true;
  draft.dayOne.complete = true;
}

function createHarness({
  choice = 'comply',
  playerName = '  Juniper\nVale  ',
  storage = new MemoryStorage(),
  ringAnomalyBell,
  sayHandler = null,
  isDayOneComplete = () => true,
  getDayOneObjective = () => ({
    id: 'day-one-test-objective',
    label: 'Your first afternoon',
    text: 'Settle the provisional camp.',
  }),
  getDayOneLedgerRecord = () => ({
    id: 'day-one-neighborly-account',
    entry: 'WOOD GATHERED · 0 / 6',
    signature: 'Juniper Vale',
  }),
  stewardActionHandler = null,
  stewardPosition = { x: 1.6, y: 0, z: 9.4 },
  onObjectiveChange = null,
} = {}) {
  const calls = [];
  const playerPlacements = [];
  let now = 1000;
  const session = new GameSession({
    storage,
    storageKey: CORE_HOOK_V03.storageKey,
    now: () => ++now,
  });
  if (isDayOneComplete()) session.transact(completeDayOneDraft);

  const storyUI = {
    setObjective(value) {
      calls.push(`objective:${value?.id || 'none'}`);
    },
    async showLetter(value) {
      calls.push(`letter:${value.id}`);
      return 'continue';
    },
    async say(value) {
      calls.push(`say:${value.id}`);
      if (Array.isArray(value.beats)) {
        value.beats.forEach((beat, index) => {
          calls.push(`dialogue-beat:${value.id}:${beat.id || index}`);
          value.onBeatChange?.(beat, index, { total: value.beats.length });
        });
      }
      if (sayHandler) return sayHandler(value);
      return 'continue';
    },
    async signRecord(value) {
      calls.push(`sign:${value.id}`);
      return playerName;
    },
    async showRecord(value) {
      calls.push(`record:${value.id}`);
      if (value.signature) calls.push(`signature:${value.id}:${value.signature}`);
      return 'continue';
    },
    async choose(value) {
      calls.push(`choose:${value.id}`);
      return choice;
    },
    async showEnding(value) {
      calls.push(`ending:${value.id}`);
      return 'continue';
    },
    setNeighborliness(value) {
      calls.push(`neighborliness:${value}`);
    },
  };

  const stewardActor = {
    update() {},
    lookAt() {},
    play(role) {
      calls.push(`actor:${role}`);
    },
  };
  if (stewardActionHandler) {
    stewardActor.playAction = (name) => {
      calls.push(`action:${name}`);
      return stewardActionHandler(name);
    };
    stewardActor.cancelAction = (name) => {
      calls.push(`cancel-action:${name}`);
      return true;
    };
  }

  const director = new CoreHookDirector({
    storyUI,
    session,
    dayNightSystem: {
      applyStoryTime(time, immediate) {
        calls.push(`time:${time}:${Boolean(immediate)}`);
      },
    },
    hud: {
      setDayNight(time) {
        calls.push(`hud-time:${time}`);
      },
      setStatus(message) {
        calls.push(`status:${message}`);
      },
    },
    worldAnimator: {
      ringBell() {
        calls.push('bell:first');
      },
    },
    soundscape: {
      setDayNight(value) {
        calls.push(`sound-time:${value}`);
      },
      playInteraction(kind) {
        calls.push(`sound:${kind}`);
      },
    },
    vfx: {
      interactionBurst(_position, kind) {
        calls.push(`vfx:${kind}`);
      },
    },
    postProcessing: {
      pulse(value) {
        calls.push(`pulse:${value}`);
      },
    },
    stewardActor,
    moveSteward(_anchor, options) {
      calls.push(`move:${options.id}:${Boolean(options.immediate)}`);
    },
    ringAnomalyBell: ringAnomalyBell || (({ onReveal } = {}) => {
      onReveal?.();
      calls.push('bell:anomaly');
    }),
    setRoute(value) {
      calls.push(`route:${value}`);
    },
    getRouteDestination(value) {
      return value === 'alter'
        ? { x: 11.8, y: 0, z: 7 }
        : { x: 7, y: 0, z: 4.25 };
    },
    resetPlayer(position) {
      playerPlacements.push(position ? { ...position } : null);
    },
    isDayOneComplete,
    getDayOneObjective,
    getDayOneLedgerRecord,
    getStewardPosition() {
      return CORE_HOOK_V03.anchors.steward.routine;
    },
    setStoryBlocking(value) {
      calls.push(`blocking:${value}`);
    },
    onObjectiveChange,
    onError(error, context) {
      calls.push(`error:${context}:${error.message}`);
    },
  });

  director.init({
    interactables: [
      { id: 'ledger', position: { x: -2, y: 0.8, z: 3 } },
      { id: 'bell', position: CORE_HOOK_V03.anchors.interactables.bell },
    ],
    stewardInteractable: {
      id: 'steward-8914',
      position: stewardPosition,
      radius: 2.35,
    },
  });

  return { calls, director, session, storage, playerPlacements };
}

test('objective targets resolve from authored descriptors and follow moving actors', async () => {
  const stewardPosition = { x: 1.6, y: 0, z: 9.4 };
  const observed = [];
  const harness = createHarness({
    stewardPosition,
    onObjectiveChange(objective, target) {
      observed.push({ objective, target });
    },
  });

  const before = harness.session.snapshot();
  assert.equal(harness.director.currentObjective(), CORE_HOOK_V03.objectives.meetSteward);
  assert.deepEqual(harness.session.snapshot(), before, 'querying the objective must not mutate session state');

  await harness.director.start();
  const stewardTarget = harness.director.resolveObjectiveTarget();
  assert.equal(stewardTarget.id, CORE_HOOK_V03.ids.steward);
  assert.equal(stewardTarget.radius, 2.35);
  assert.strictEqual(stewardTarget.getPosition(), stewardPosition);

  stewardPosition.x = -0.2;
  stewardPosition.z = 4.8;
  assert.strictEqual(stewardTarget.getPosition(), stewardPosition);
  assert.deepEqual(
    { x: stewardTarget.getPosition().x, z: stewardTarget.getPosition().z },
    { x: -0.2, z: 4.8 },
    'the published provider must follow Lumen without republishing',
  );
  assert.equal(observed.at(-1).objective, CORE_HOOK_V03.objectives.meetSteward);

  const ledgerTarget = harness.director.resolveObjectiveTarget(CORE_HOOK_V03.objectives.signLedger);
  assert.equal(ledgerTarget.id, CORE_HOOK_V03.ids.ledger);
  assert.deepEqual({ ...ledgerTarget.getPosition() }, { x: -2, y: 0.8, z: 3 });

  const complyTarget = harness.director.resolveObjectiveTarget(CORE_HOOK_V03.objectives.complyComplete);
  assert.equal(complyTarget.id, 'comply');
  assert.equal(complyTarget.radius, CORE_HOOK_V03.timing.routeArrivalRadius);
  assert.deepEqual({ ...complyTarget.getPosition() }, { x: 7, y: 0, z: 4.25 });

  assert.equal(harness.director.resolveObjectiveTarget({ target: { kind: 'interactable', id: 'missing' } }), null);
  assert.equal(harness.director.resolveObjectiveTarget({ target: { kind: 'anchor', position: { x: NaN, y: 0, z: 0 } } }), null);
});

test('objective observer failures cannot block the authored route', async () => {
  const harness = createHarness({
    onObjectiveChange() {
      throw new Error('cue projection unavailable');
    },
  });

  await harness.director.start();
  assert.ok(harness.calls.includes(`objective:${CORE_HOOK_V03.objectives.meetSteward.id}`));
  assert.ok(harness.calls.includes('error:objective-change:cue projection unavailable'));
  assert.equal(harness.director.isInteractableEnabled(CORE_HOOK_V03.ids.steward), true);
});

test('the truthful Ledger stays reviewable during Day One without creating the false record', async () => {
  const dayOne = { complete: false };
  const harness = createHarness({
    isDayOneComplete: () => dayOne.complete,
    getDayOneObjective: () => ({
      id: 'day-one-gather-wood',
      label: 'Your first afternoon',
      text: 'Gather wood for the camp.',
    }),
  });

  await harness.director.start();
  await harness.director.interact(CORE_HOOK_V03.ids.steward);

  assert.equal(harness.director.isInteractableEnabled(CORE_HOOK_V03.ids.ledger), true);
  assert.ok(harness.calls.includes(`objective:${CORE_HOOK_V03.objectives.signLedger.id}`));

  await harness.director.interact(CORE_HOOK_V03.ids.ledger);
  assert.equal(harness.director.promptFor(CORE_HOOK_V03.ids.ledger), CORE_HOOK_V03.prompts.reviewLedger);
  assert.ok(harness.calls.includes('objective:day-one-gather-wood'));

  await harness.director.interact(CORE_HOOK_V03.ids.ledger);
  assert.equal(harness.director.isInteractableEnabled(CORE_HOOK_V03.ids.ledger), true);
  assert.ok(harness.calls.includes('record:day-one-neighborly-account'));
  assert.equal(harness.session.hasEvent(CORE_HOOK_V03.events.falseRecordSeen), false);
});

test('Ledger enrollment opens Day One while dusk and the Bell wait for recorded chores', async () => {
  const dayOne = { complete: false };
  const harness = createHarness({
    isDayOneComplete: () => dayOne.complete,
    getDayOneObjective: () => ({
      id: 'day-one-gather-wood',
      label: 'Your first afternoon',
      text: 'Gather wood for the camp.',
    }),
  });

  await harness.director.start();
  await harness.director.interact(CORE_HOOK_V03.ids.steward);

  assert.equal(harness.director.isInteractableEnabled(CORE_HOOK_V03.ids.ledger), true);
  assert.equal(harness.director.isInteractableEnabled(CORE_HOOK_V03.ids.bell), false);
  assert.equal(
    harness.calls.filter((call) => call.startsWith('objective:')).at(-1),
    `objective:${CORE_HOOK_V03.objectives.signLedger.id}`,
  );

  await harness.director.interact(CORE_HOOK_V03.ids.ledger);
  assert.equal(harness.session.hasEvent(CORE_HOOK_V03.events.ledgerSigned), true);
  assert.equal(harness.director.isInteractableEnabled(CORE_HOOK_V03.ids.bell), false);
  assert.equal(
    harness.calls.filter((call) => call.startsWith('objective:')).at(-1),
    'objective:day-one-gather-wood',
  );
  assert.equal(
    harness.calls.some((call) => call === 'time:dusk:false'),
    false,
    'signing should not skip the recorded afternoon',
  );

  dayOne.complete = true;
  await harness.director.refreshObjective();
  assert.equal(harness.director.isInteractableEnabled(CORE_HOOK_V03.ids.bell), true);
  assert.equal(
    harness.calls.filter((call) => call.startsWith('objective:')).at(-1),
    `objective:${CORE_HOOK_V03.objectives.ringBell.id}`,
  );
  assert.ok(harness.calls.includes('time:dusk:false'));
});

async function triggerDistanceAnomaly(director) {
  const bell = CORE_HOOK_V03.anchors.interactables.bell;
  for (let index = 0; index < 10; index += 1) {
    assert.equal(director.update(0.25, bell), null);
  }
  const anomaly = director.update(0.25, CORE_HOOK_V03.anchors.steward.routine);
  assert.ok(anomaly instanceof Promise);
  await anomaly;
}

async function advanceToChoice(harness) {
  const { director } = harness;
  await director.start();
  await director.interact('steward-8914');
  await director.interact('ledger');
  await director.interact('bell');
  await triggerDistanceAnomaly(director);
  await director.interact('ledger');
}

async function arriveAtOutcome(harness, choice) {
  const destination = choice === 'alter'
    ? { x: 11.8, y: 0, z: 7 }
    : { x: 7, y: 0, z: 4.25 };
  const completion = harness.director.update(0.016, destination);
  assert.ok(completion instanceof Promise);
  await completion;
}

test('GameSession saves versioned state, reloads it, and resets cleanly', () => {
  const storage = new MemoryStorage();
  let now = 10;
  const session = new GameSession({ storage, now: () => ++now });

  session.adjustNeighborliness(23);
  session.setRelationship('steward', 'corrective');
  session.setPlayerName('  Juniper\nVale  ');
  session.discoverRule('bell-once-at-dusk');
  session.transact((draft) => {
    completeDayOneDraft(draft);
    draft.phase = 'resolution';
    draft.choices.ledger_record = 'alter';
    draft.eventsSeen.push(
      'arrival-letter-seen',
      'steward-lumen-met',
      'community-ledger-signed',
      'dusk-bell-rung',
      'night-bell-rang-itself',
      'false-ledger-record-seen',
      'steward-correction-heard',
      'ledger-record-choice-made',
    );
  });

  const restored = new GameSession({ storage, now: () => ++now });
  assert.equal(restored.snapshot().version, GAME_SESSION_VERSION);
  assert.equal(restored.phase, 'resolution');
  assert.equal(restored.neighborliness, 73);
  assert.equal(restored.stewardRelationship, 'corrective');
  assert.equal(restored.playerName, 'Juniper Vale');
  assert.equal(restored.knowsRule('bell-once-at-dusk'), true);
  assert.equal(restored.hasEvent('night-bell-rang-itself'), true);
  assert.equal(restored.getChoice('ledger_record'), 'alter');

  restored.reset();
  assert.equal(storage.getItem(CORE_HOOK_V03.storageKey), null);
  assert.deepEqual(
    {
      phase: restored.phase,
      neighborliness: restored.neighborliness,
      relationship: restored.stewardRelationship,
      playerName: restored.playerName,
      ending: restored.ending,
    },
    {
      phase: 'arrival',
      neighborliness: 50,
      relationship: 'guarded',
      playerName: null,
      ending: null,
    },
  );

  storage.setItem(CORE_HOOK_V03.storageKey, '{not valid JSON');
  const recovered = new GameSession({ storage });
  assert.equal(recovered.phase, 'arrival');
  assert.equal(storage.getItem(CORE_HOOK_V03.storageKey), null);

  for (const inconsistent of [
    {
      version: GAME_SESSION_VERSION,
      phase: 'resolution',
      neighborliness: 90,
      relationship: { steward: 'warm' },
      rulesKnown: [],
      choices: {},
      eventsSeen: [],
      ending: 'assimilate',
      updatedAt: 20,
    },
    {
      version: GAME_SESSION_VERSION,
      phase: 'resolution',
      neighborliness: 55,
      relationship: { steward: 'corrective' },
      rulesKnown: [],
      choices: { ledger_record: 'comply' },
      eventsSeen: [],
      ending: 'escape',
      updatedAt: 21,
    },
    {
      version: GAME_SESSION_VERSION,
      phase: 'intervention',
      neighborliness: 75,
      relationship: { steward: 'corrective' },
      rulesKnown: ['bell-once-at-dusk'],
      choices: {},
      eventsSeen: [
        'arrival-letter-seen',
        'steward-lumen-met',
        'community-ledger-signed',
        'dusk-bell-rung',
        'night-bell-rang-itself',
        'false-ledger-record-seen',
        'ledger-record-choice-made',
      ],
      ending: null,
      updatedAt: 22,
    },
    {
      version: GAME_SESSION_VERSION,
      phase: 'dusk',
      neighborliness: 60,
      relationship: { steward: 'warm' },
      rulesKnown: [],
      choices: {},
      eventsSeen: ['dusk-bell-rung'],
      ending: null,
      updatedAt: 23,
    },
  ]) {
    storage.setItem(CORE_HOOK_V03.storageKey, JSON.stringify(inconsistent));
    const semanticRecovery = new GameSession({ storage });
    assert.equal(semanticRecovery.phase, 'arrival');
    assert.equal(semanticRecovery.ending, null);
    assert.equal(storage.getItem(CORE_HOOK_V03.storageKey), null);
  }

  const versionOneSave = {
    version: 1,
    phase: 'day-routine',
    neighborliness: 65,
    relationship: { steward: 'warm' },
    rulesKnown: ['bell-once-at-dusk'],
    choices: {},
    eventsSeen: [
      'arrival-letter-seen',
      'steward-lumen-met',
      'community-ledger-signed',
    ],
    ending: null,
    updatedAt: 24,
  };
  storage.setItem(CORE_HOOK_V03.storageKey, JSON.stringify(versionOneSave));
  const migrated = new GameSession({ storage });
  assert.equal(migrated.phase, 'day-routine');
  assert.equal(migrated.playerName, null);
  assert.equal(migrated.hasEvent('community-ledger-signed'), true);
  assert.equal(JSON.parse(storage.getItem(CORE_HOOK_V03.storageKey)).version, GAME_SESSION_VERSION);
});

test('CoreHookDirector enforces the authored interaction order', async () => {
  const harness = createHarness({ choice: 'comply' });
  const { calls, director, session } = harness;

  await director.start();
  assert.equal(director.isInteractableEnabled('steward-8914'), true);
  assert.equal(director.isInteractableEnabled('ledger'), false);
  assert.equal(director.isInteractableEnabled('bell'), false);
  assert.equal((await director.interact('bell')).handled, false);

  await director.interact('steward-8914');
  assert.equal(session.phase, 'day-routine');
  assert.equal(session.knowsRule('bell-once-at-dusk'), true);
  assert.equal(director.promptFor('ledger'), CORE_HOOK_V03.prompts.signLedger);
  assert.equal(director.isInteractableEnabled('ledger'), true);
  assert.equal(director.isInteractableEnabled('bell'), false);

  await director.interact('ledger');
  assert.equal(session.playerName, 'Juniper Vale');
  const restoredAfterSigning = new GameSession({
    storage: harness.storage,
    storageKey: CORE_HOOK_V03.storageKey,
  });
  assert.equal(restoredAfterSigning.playerName, 'Juniper Vale');
  assert.equal(director.isInteractableEnabled('ledger'), true);
  assert.equal(director.promptFor('ledger'), CORE_HOOK_V03.prompts.reviewLedger);
  assert.equal(director.isInteractableEnabled('bell'), true);

  await director.interact('bell');
  assert.equal(session.phase, 'dusk');
  assert.equal(director.isInteractableEnabled('bell'), false);
  assert.equal(director.isInteractableEnabled('ledger'), true);
  assert.ok(calls.includes(`objective:${CORE_HOOK_V03.objectives.returnToLumen.id}`));

  await triggerDistanceAnomaly(director);
  assert.equal(session.phase, 'night-investigation');
  assert.equal(director.promptFor('ledger'), CORE_HOOK_V03.prompts.inspectLedger);

  await director.interact('ledger');
  assert.ok(calls.includes('signature:false-correction:Juniper Vale'));
  assert.equal(session.phase, 'intervention');
  assert.equal(director.isInteractableEnabled('steward-8914'), true);
  await director.interact('steward-8914');

  assert.equal(session.phase, 'resolution');
  assert.equal(session.ending, null);
  assert.equal(session.getChoice('ledger_record'), 'comply');
  assert.equal(session.neighborliness, 90);
  assert.equal(director.isInteractableEnabled('steward-8914'), false);
  assert.equal(calls.includes('ending:assimilate'), false);

  await arriveAtOutcome(harness, 'comply');
  assert.equal(session.ending, 'assimilate');

  const requiredOrder = [
    'letter:arrival-letter',
    'say:lumen-welcome',
    'sign:arrival-signature',
    'say:lumen-first-bell',
    'bell:anomaly',
    'record:false-correction',
    'say:lumen-correction',
    'choose:ledger_record',
    'route:comply',
    'say:lumen-comply-response',
    'ending:assimilate',
  ];
  let previousIndex = -1;
  for (const event of requiredOrder) {
    const index = calls.indexOf(event);
    assert.ok(index > previousIndex, `${event} should follow the previous authored beat`);
    previousIndex = index;
  }
});

test('Lumen performs all four semantic story actions in authored order', async () => {
  const harness = createHarness({ stewardActionHandler: () => true });
  await advanceToChoice(harness);
  await harness.director.interact('steward-8914');

  assert.deepEqual(
    harness.calls.filter((entry) => entry.startsWith('action:')),
    [
      `action:${STORY_ACTIONS_V1.lumen.happyHandGesture}`,
      `action:${STORY_ACTIONS_V1.lumen.acknowledging}`,
      `action:${STORY_ACTIONS_V1.lumen.relievedSigh}`,
      `action:${STORY_ACTIONS_V1.lumen.thoughtfulHeadShake}`,
    ],
  );

  const welcomeAction = harness.calls.indexOf(
    `action:${STORY_ACTIONS_V1.lumen.happyHandGesture}`,
  );
  const welcomeDialogue = harness.calls.indexOf('say:lumen-welcome');
  const welcomeBeat = harness.calls.indexOf(
    'dialogue-beat:lumen-welcome:lumen-welcome.arrival',
  );
  const welcomeCancel = harness.calls.indexOf(
    `cancel-action:${STORY_ACTIONS_V1.lumen.happyHandGesture}`,
  );
  const routineMove = harness.calls.indexOf('move:routine:false');
  assert.ok(welcomeDialogue < welcomeBeat, 'the spoken exchange opens before its first beat');
  assert.ok(welcomeBeat < welcomeAction, 'the authored beat starts Lumen’s matching gesture');
  assert.ok(welcomeAction < welcomeCancel, 'the gesture remains presentation-only and cancellable');
  assert.ok(welcomeCancel < routineMove, 'the one-shot ends before Lumen starts walking');
});

test('a missing or throwing Lumen action falls back without blocking story state', async () => {
  const harness = createHarness({
    stewardActionHandler() {
      throw new Error('pilot clip unavailable');
    },
  });
  await harness.director.start();
  const result = await harness.director.interact('steward-8914');

  assert.equal(result.handled, true);
  assert.equal(harness.session.hasEvent(CORE_HOOK_V03.events.stewardMet), true);
  assert.ok(harness.calls.includes('error:steward-action:pilot clip unavailable'));
  assert.ok(harness.calls.includes('actor:joy'));
});

test('the ledger requires a visible name and persists it before Lumen responds', async () => {
  const blankHarness = createHarness({ playerName: ' \n\t ' });
  await blankHarness.director.start();
  await blankHarness.director.interact('steward-8914');
  await assert.rejects(
    blankHarness.director.interact('ledger'),
    /requires a player name/,
  );
  assert.equal(blankHarness.session.playerName, null);
  assert.equal(blankHarness.session.hasEvent(CORE_HOOK_V03.events.ledgerSigned), false);

  let releaseResponse;
  let markResponseStarted;
  const responseStarted = new Promise((resolve) => {
    markResponseStarted = resolve;
  });
  const responseGate = new Promise((resolve) => {
    releaseResponse = resolve;
  });
  const harness = createHarness({
    playerName: '  Rowan\nThorne  ',
    sayHandler(value) {
      if (value.id !== 'lumen-ledger-accepted') return 'continue';
      markResponseStarted();
      return responseGate;
    },
  });

  await harness.director.start();
  await harness.director.interact('steward-8914');
  const interaction = harness.director.interact('ledger');
  await responseStarted;

  assert.equal(harness.session.playerName, 'Rowan Thorne');
  assert.equal(harness.session.hasEvent(CORE_HOOK_V03.events.ledgerSigned), true);
  const reloaded = new GameSession({
    storage: harness.storage,
    storageKey: CORE_HOOK_V03.storageKey,
  });
  assert.equal(reloaded.playerName, 'Rowan Thorne');
  assert.equal(reloaded.hasEvent(CORE_HOOK_V03.events.ledgerSigned), true);

  releaseResponse('continue');
  await interaction;
});

test('the supernatural second bell is durable and can only fire once', async () => {
  let ringCount = 0;
  let releaseRing;
  const ringGate = new Promise((resolve) => {
    releaseRing = resolve;
  });
  const harness = createHarness({
    ringAnomalyBell: ({ onReveal }) => {
      assert.equal(
        harness.session.hasEvent(CORE_HOOK_V03.events.anomalyBellRang),
        false,
        'the anomaly must not project during the camera fly-in',
      );
      onReveal();
      assert.equal(
        harness.session.hasEvent(CORE_HOOK_V03.events.anomalyBellRang),
        true,
        'the reveal must be durable before its sound and VFX play',
      );
      ringCount += 1;
      return ringGate;
    },
  });
  const { director, session, storage } = harness;

  await director.start();
  await director.interact('steward-8914');
  await director.interact('ledger');
  await director.interact('bell');

  const bell = CORE_HOOK_V03.anchors.interactables.bell;
  // Waiting beside the Bell can no longer produce an immediate or timer-only
  // second ring. The anomaly belongs to the return journey toward Lumen.
  for (let index = 0; index < 120; index += 1) {
    director.update(0.25, bell);
  }
  assert.equal(ringCount, 0);
  assert.equal(
    director.update(0.25, { x: 3, y: 0, z: -15 }),
    null,
    'moving away without returning toward Lumen is not enough',
  );
  const returnPosition = CORE_HOOK_V03.anchors.steward.routine;
  const first = director.update(0.25, returnPosition);
  const duplicate = director.update(0.25, returnPosition);

  assert.equal(first, duplicate);
  assert.equal(ringCount, 1);
  assert.equal(session.hasEvent(CORE_HOOK_V03.events.anomalyBellRang), true);
  assert.equal(director.isInteractableEnabled('ledger'), false, 'the reveal owns interactions');

  releaseRing();
  await first;
  assert.equal(
    harness.calls.filter((entry) => entry === 'vfx:magic').length,
    0,
    'the injected reveal owns its VFX without a duplicate post-shot flash',
  );
  for (let index = 0; index < 40; index += 1) {
    await director.update(0.25, { x: 20, y: 0, z: 20 });
  }
  assert.equal(ringCount, 1);

  const reloaded = createHarness({ storage });
  await reloaded.director.start();
  for (let index = 0; index < 40; index += 1) {
    await reloaded.director.update(0.25, { x: 20, y: 0, z: 20 });
  }
  assert.equal(
    reloaded.calls.filter((entry) => entry === 'bell:anomaly').length,
    0,
    'a saved anomaly must not replay after reload',
  );
});

test('cancelling the second-Bell fly-in during disposal does not save a ring that never happened', async () => {
  let releasePresentation;
  const presentationGate = new Promise((resolve) => {
    releasePresentation = resolve;
  });
  const harness = createHarness({
    ringAnomalyBell: () => presentationGate,
  });
  const { director, session } = harness;

  await director.start();
  await director.interact('steward-8914');
  await director.interact('ledger');
  await director.interact('bell');
  for (let index = 0; index < 10; index += 1) director.update(0.25, director.bellPosition);

  const pending = director.update(0.25, CORE_HOOK_V03.anchors.steward.routine);
  assert.ok(pending instanceof Promise);
  assert.equal(session.hasEvent(CORE_HOOK_V03.events.anomalyBellRang), false);

  director.dispose();
  releasePresentation({ cancelled: true, revealed: false });
  await pending;

  assert.equal(session.hasEvent(CORE_HOOK_V03.events.anomalyBellRang), false);
  assert.equal(session.phase, 'dusk');
});

test('a restored first-Bell save resumes beside the Bell so the return journey keeps its breathing space', async () => {
  const original = createHarness();
  await original.director.start();
  await original.director.interact('steward-8914');
  await original.director.interact('ledger');
  await original.director.interact('bell');
  assert.equal(original.session.phase, 'dusk');

  const restored = createHarness({ storage: original.storage });
  await restored.director.start();

  assert.deepEqual(
    restored.playerPlacements,
    [CORE_HOOK_V03.anchors.player.firstBellReturn],
  );
  for (let index = 0; index < 40; index += 1) {
    assert.equal(
      restored.director.update(0.25, CORE_HOOK_V03.anchors.player.firstBellReturn),
      null,
      'waiting at the restored Bell-side anchor must not trigger the second ring',
    );
  }
  assert.equal(restored.session.hasEvent(CORE_HOOK_V03.events.anomalyBellRang), false);
  assert.ok(restored.calls.includes(`objective:${CORE_HOOK_V03.objectives.returnToLumen.id}`));
});

for (const scenario of [
  {
    choice: 'comply',
    ending: 'assimilate',
    neighborliness: 90,
    relationship: 'warm',
    response: 'say:lumen-comply-response',
    endingCall: 'ending:assimilate',
    actor: 'actor:joy',
  },
  {
    choice: 'alter',
    ending: 'escape',
    neighborliness: 55,
    relationship: 'corrective',
    response: 'say:lumen-alter-response',
    endingCall: 'ending:escape',
    actor: 'actor:idle',
  },
]) {
  test(`${scenario.choice} changes route, steward response, and ending`, async () => {
    const harness = createHarness({ choice: scenario.choice });
    const { calls, director, session } = harness;
    await advanceToChoice(harness);
    await director.interact('steward-8914');

    assert.equal(session.getChoice('ledger_record'), scenario.choice);
    assert.equal(session.ending, null);
    assert.equal(session.neighborliness, scenario.neighborliness);
    assert.equal(session.stewardRelationship, scenario.relationship);
    assert.ok(calls.includes(`route:${scenario.choice}`));
    assert.ok(calls.includes(scenario.response));
    assert.equal(calls.includes(scenario.endingCall), false);

    await arriveAtOutcome(harness, scenario.choice);
    assert.equal(session.ending, scenario.ending);
    assert.ok(calls.includes(scenario.endingCall));

    const routeIndex = calls.indexOf(`route:${scenario.choice}`);
    const responseIndex = calls.indexOf(scenario.response);
    const endingIndex = calls.indexOf(scenario.endingCall);
    assert.ok(routeIndex < responseIndex && responseIndex < endingIndex);
    assert.ok(calls.slice(routeIndex, endingIndex).includes(scenario.actor));
  });
}
