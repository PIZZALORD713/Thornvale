const EVENT = Object.freeze({
  stewardMet: 'steward-lumen-met',
  ledgerSigned: 'community-ledger-signed',
  firstAfternoonComplete: 'first-afternoon-complete',
  firstBellRung: 'dusk-bell-rung',
  anomalyBellRang: 'night-bell-rang-itself',
  falseRecordSeen: 'false-ledger-record-seen',
});

export const STORY_PRESENTATION_STATES = Object.freeze([
  'arrival',
  'day',
  'registered',
  'dusk',
  'post-bell',
  'anomaly',
  'intervention',
  'comply',
  'alter',
]);

const PRESENTATION = Object.freeze({
  arrival: Object.freeze({
    standingKey: 'new-face',
    standingLabel: 'A new face',
    ledgerMood: 'normal',
  }),
  day: Object.freeze({
    standingKey: 'kindly-met',
    standingLabel: 'Kindly met',
    ledgerMood: 'normal',
  }),
  registered: Object.freeze({
    standingKey: 'written-in',
    standingLabel: 'Written in',
    ledgerMood: 'signed',
  }),
  dusk: Object.freeze({
    standingKey: 'written-in',
    standingLabel: 'Written in',
    ledgerMood: 'signed',
  }),
  'post-bell': Object.freeze({
    standingKey: 'in-good-standing',
    standingLabel: 'In good standing',
    ledgerMood: 'signed',
  }),
  anomaly: Object.freeze({
    standingKey: 'being-worried-over',
    standingLabel: 'Being worried over',
    ledgerMood: 'false',
  }),
  intervention: Object.freeze({
    standingKey: 'being-worried-over',
    standingLabel: 'Being worried over',
    ledgerMood: 'false',
  }),
  comply: Object.freeze({
    standingKey: 'home',
    standingLabel: 'Home',
    ledgerMood: 'comply',
  }),
  alter: Object.freeze({
    standingKey: 'differently',
    standingLabel: 'Differently',
    ledgerMood: 'alter',
  }),
});

const OFF_PRESENTATION = Object.freeze({
  enabled: false,
  state: 'off',
  mood: 'off',
  standing: null,
  standingKey: 'hidden',
  standingLabel: null,
  qualitativeStanding: null,
  ledgerMood: 'normal',
  route: null,
  datasets: Object.freeze({
    storyState: 'off',
    storyMood: 'off',
    townStanding: 'hidden',
    ledgerMood: 'normal',
    storyRoute: 'none',
  }),
});

function eventSet(snapshot) {
  return new Set(
    Array.isArray(snapshot?.eventsSeen)
      ? snapshot.eventsSeen.filter((eventId) => typeof eventId === 'string')
      : [],
  );
}

function resolvedChoice(snapshot) {
  const choice = snapshot?.choices?.ledger_record;
  if (choice === 'comply' || choice === 'alter') return choice;
  if (snapshot?.ending === 'assimilate') return 'comply';
  if (snapshot?.ending === 'escape') return 'alter';
  return null;
}

/**
 * Resolve the most advanced player-visible beat from durable events.
 *
 * GameSession remains authoritative; the phase is only a final compatibility
 * fallback. Event precedence keeps presentation stable during a transaction,
 * after reload, and while asynchronous dialogue catches up with saved state.
 */
export function resolveStoryPresentationState(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return 'off';

  const choice = resolvedChoice(snapshot);
  if (choice) return choice;

  const events = eventSet(snapshot);
  if (events.has(EVENT.falseRecordSeen)) return 'intervention';
  if (events.has(EVENT.anomalyBellRang)) return 'anomaly';
  if (events.has(EVENT.firstBellRung)) return 'post-bell';
  if (events.has(EVENT.ledgerSigned) && events.has(EVENT.firstAfternoonComplete)) return 'dusk';
  if (events.has(EVENT.ledgerSigned)) return 'registered';
  if (events.has(EVENT.stewardMet)) return 'day';

  if (snapshot.phase === 'intervention') return 'intervention';
  if (snapshot.phase === 'night-investigation') return 'anomaly';
  if (snapshot.phase === 'dusk') return 'post-bell';
  if (snapshot.phase === 'day-routine') return 'day';
  return 'arrival';
}

/**
 * Purely derives the UI/world aesthetic state from a serializable session.
 * No presentation value is written back into the save schema.
 */
export function projectStoryPresentation(snapshot) {
  const state = resolveStoryPresentationState(snapshot);
  if (state === 'off') return OFF_PRESENTATION;

  const values = PRESENTATION[state] || PRESENTATION.arrival;
  const route = state === 'comply' || state === 'alter' ? state : null;
  const standing = Object.freeze({
    key: values.standingKey,
    label: values.standingLabel,
  });

  return Object.freeze({
    enabled: true,
    state,
    mood: state,
    standing,
    standingKey: values.standingKey,
    standingLabel: values.standingLabel,
    qualitativeStanding: values.standingLabel,
    ledgerMood: values.ledgerMood,
    route,
    datasets: Object.freeze({
      storyState: state,
      storyMood: state,
      townStanding: values.standingKey,
      ledgerMood: values.ledgerMood,
      storyRoute: route || 'none',
    }),
  });
}

/** Apply the projector's DOM-safe values without requiring a browser in tests. */
export function applyStoryPresentationDatasets(documentRef, value) {
  const root = documentRef?.documentElement;
  if (!root?.dataset) return false;

  const presentation = value?.datasets
    ? value
    : projectStoryPresentation(value);
  for (const [key, datasetValue] of Object.entries(presentation.datasets)) {
    root.dataset[key] = String(datasetValue);
  }
  return true;
}

export default projectStoryPresentation;
