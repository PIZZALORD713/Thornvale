import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  applyStoryPresentationDatasets,
  projectStoryPresentation,
} from '../src/visuals/AestheticPresentation.js';
import { normalizeStoryPortrait, StoryUI } from '../src/ui/StoryUI.js';
import { CORE_HOOK_V03 } from '../src/content/core-hook-v03.js';

const EVENTS = [
  'arrival-letter-seen',
  'steward-lumen-met',
  'community-ledger-signed',
  'dusk-bell-rung',
  'night-bell-rang-itself',
  'false-ledger-record-seen',
  'steward-correction-heard',
  'ledger-record-choice-made',
  'core-hook-ending-seen',
];

function snapshotThrough(eventCount, overrides = {}) {
  return {
    phase: 'arrival',
    neighborliness: 50,
    relationship: { steward: 'guarded' },
    choices: {},
    eventsSeen: EVENTS.slice(0, eventCount),
    ending: null,
    ...overrides,
  };
}

test('story snapshots project through the courtesy-correction presentation grammar', () => {
  const cases = [
    {
      label: 'arrival',
      snapshot: snapshotThrough(0),
      state: 'arrival',
      standing: 'A new face',
      ledger: 'normal',
      route: null,
    },
    {
      label: 'day welcome',
      snapshot: snapshotThrough(2, { phase: 'day-routine' }),
      state: 'day',
      standing: 'Kindly met',
      ledger: 'normal',
      route: null,
    },
    {
      label: 'registered daylight',
      snapshot: snapshotThrough(3, { phase: 'day-routine' }),
      state: 'registered',
      standing: 'Written in',
      ledger: 'signed',
      route: null,
    },
    {
      label: 'dusk guidance',
      snapshot: {
        ...snapshotThrough(3, { phase: 'day-routine' }),
        eventsSeen: [
          ...snapshotThrough(3).eventsSeen,
          CORE_HOOK_V03.events.firstAfternoonComplete,
        ],
      },
      state: 'dusk',
      standing: 'Written in',
      ledger: 'signed',
      route: null,
    },
    {
      label: 'post bell',
      snapshot: snapshotThrough(4, { phase: 'dusk' }),
      state: 'post-bell',
      standing: 'In good standing',
      ledger: 'signed',
      route: null,
    },
    {
      label: 'restored anomaly',
      snapshot: snapshotThrough(5, { phase: 'night-investigation' }),
      state: 'anomaly',
      standing: 'Being worried over',
      ledger: 'false',
      route: null,
    },
    {
      label: 'intervention',
      snapshot: snapshotThrough(7, {
        phase: 'intervention',
        relationship: { steward: 'corrective' },
      }),
      state: 'intervention',
      standing: 'Being worried over',
      ledger: 'false',
      route: null,
    },
    {
      label: 'comply',
      snapshot: snapshotThrough(8, {
        phase: 'resolution',
        choices: { ledger_record: 'comply' },
        relationship: { steward: 'warm' },
      }),
      state: 'comply',
      standing: 'Home',
      ledger: 'comply',
      route: 'comply',
    },
    {
      label: 'alter',
      snapshot: snapshotThrough(8, {
        phase: 'resolution',
        choices: { ledger_record: 'alter' },
        relationship: { steward: 'corrective' },
      }),
      state: 'alter',
      standing: 'Differently',
      ledger: 'alter',
      route: 'alter',
    },
  ];

  for (const example of cases) {
    const result = projectStoryPresentation(example.snapshot);
    assert.equal(result.state, example.state, example.label);
    assert.equal(result.mood, example.state, `${example.label} mood`);
    assert.equal(result.qualitativeStanding, example.standing, `${example.label} standing`);
    assert.equal(result.ledgerMood, example.ledger, `${example.label} ledger`);
    assert.equal(result.route, example.route, `${example.label} route`);
    assert.match(result.datasets.storyState, /^[a-z]+(?:-[a-z]+)*$/);
    assert.match(result.datasets.townStanding, /^[a-z]+(?:-[a-z]+)*$/);
  }
});

test('early enrollment is daylight registration and only completed chores project dusk', () => {
  const registered = projectStoryPresentation(snapshotThrough(3, {
    phase: 'day-routine',
    dayOne: { complete: false },
  }));
  assert.equal(registered.state, 'registered');
  assert.equal(registered.ledgerMood, 'signed');
  assert.equal(registered.standingLabel, 'Written in');

  const dusk = projectStoryPresentation({
    ...snapshotThrough(3, { phase: 'day-routine' }),
    eventsSeen: [
      ...snapshotThrough(3).eventsSeen,
      CORE_HOOK_V03.events.firstAfternoonComplete,
    ],
    dayOne: { complete: true },
  });
  assert.equal(dusk.state, 'dusk');
  assert.equal(dusk.ledgerMood, 'signed');
});

test('event precedence wins over stale phase fields and ending fallback remains stable', () => {
  const anomaly = projectStoryPresentation(snapshotThrough(5, { phase: 'arrival' }));
  assert.equal(anomaly.state, 'anomaly');

  const endingOnly = projectStoryPresentation(snapshotThrough(0, {
    phase: 'resolution',
    ending: 'escape',
  }));
  assert.equal(endingOnly.state, 'alter');
  assert.equal(endingOnly.route, 'alter');
});

test('presentation datasets apply to a tiny document and clear to story-off safely', () => {
  const documentRef = { documentElement: { dataset: {} } };
  const result = projectStoryPresentation(snapshotThrough(5, {
    phase: 'night-investigation',
  }));

  assert.equal(applyStoryPresentationDatasets(documentRef, result), true);
  assert.deepEqual(documentRef.documentElement.dataset, {
    storyState: 'anomaly',
    storyMood: 'anomaly',
    townStanding: 'being-worried-over',
    ledgerMood: 'false',
    storyRoute: 'none',
  });

  assert.equal(applyStoryPresentationDatasets(documentRef, null), true);
  assert.equal(documentRef.documentElement.dataset.storyState, 'off');
  assert.equal(documentRef.documentElement.dataset.townStanding, 'hidden');
});

test('the emitted dusk datasets activate the Second Witness stylesheet contract', async () => {
  const dusk = projectStoryPresentation({
    ...snapshotThrough(3, { phase: 'day-routine' }),
    eventsSeen: [
      ...snapshotThrough(3).eventsSeen,
      CORE_HOOK_V03.events.firstAfternoonComplete,
    ],
  });
  assert.equal(dusk.datasets.storyMood, 'dusk');
  assert.equal(dusk.datasets.storyState, 'dusk');

  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const selector = html.match(
    /html:is\(([^{}]*?)\)\s+\.memory-register\s*\{\s*opacity:\s*0\.29;/,
  )?.[1] || '';
  assert.ok(selector, 'the Second Witness memory-register rule must remain discoverable');
  assert.match(selector, /\[data-story-mood="dusk"\]/);
  assert.match(selector, /\[data-story-state="dusk"\]/);
  assert.doesNotMatch(selector, /dusk-guidance/);
});

function createClassList() {
  const values = new Set();
  return {
    add(...items) { items.forEach((item) => values.add(item)); },
    remove(...items) { items.forEach((item) => values.delete(item)); },
    contains(item) { return values.has(item); },
  };
}

test('StoryUI exposes qualitative remembrance without a numeric visual or ARIA leak', () => {
  const attributes = {};
  const counter = {
    classList: createClassList(),
    dataset: {},
    offsetWidth: 0,
    setAttribute(name, value) { attributes[name] = String(value); },
  };
  const ui = new StoryUI({ documentRef: null });
  ui.initialized = true;
  ui.elements = {
    kindness: counter,
    kindnessLabel: { textContent: '' },
    kindnessValue: { textContent: '' },
  };

  ui.setTownStanding({ key: 'being-worried-over', label: 'Being worried over' }, {
    animate: false,
  });
  ui.setNeighborliness(87, { animate: false });

  assert.equal(ui.elements.kindnessLabel.textContent, 'THORNVALE REMEMBERS');
  assert.equal(ui.elements.kindnessValue.textContent, 'Being worried over');
  assert.equal(attributes['aria-label'], 'Thornvale remembers: Being worried over');
  assert.doesNotMatch(`${ui.elements.kindnessValue.textContent} ${attributes['aria-label']}`, /87|100/);
});

test('Steward Lumen uses a stable monogram instead of a collection number', () => {
  assert.equal(normalizeStoryPortrait('8914', 'Steward Lumen'), 'L');
  assert.equal(normalizeStoryPortrait(undefined, 'Steward Lumen'), 'L');
  assert.equal(normalizeStoryPortrait(undefined, 'Mira'), 'M');
});

test('the refined authored copy keeps the current IDs and effects intact', () => {
  assert.equal(
    CORE_HOOK_V03.objectives.findCrossroads.text,
    'Walk toward the snow-covered crossroads.',
  );
  assert.equal(
    CORE_HOOK_V03.objectives.followRememberedPath.text,
    'Ask the wind for a direction, or choose a road yourself.',
  );
  assert.equal(
    CORE_HOOK_V03.choice.detail,
    'The ink will dry when you leave this page.',
  );
  assert.equal(
    CORE_HOOK_V03.outcomes.alter.endingCard.title,
    'The warm way closes. A path no one named opens.',
  );
  assert.equal(CORE_HOOK_V03.ids.choice, 'ledger_record');
  assert.equal(CORE_HOOK_V03.ids.arrivalChoice, 'arrival_posture');
  assert.equal(CORE_HOOK_V03.outcomes.alter.ending, 'escape');
});
