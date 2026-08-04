import test from 'node:test';
import assert from 'node:assert/strict';

import { CORE_HOOK_V03 } from '../src/content/core-hook-v03.js';
import { STORY_ACTIONS_V1 } from '../src/content/story-actions-v1.js';

const MAX_BEAT_LENGTH = 150;

function sentenceCount(text) {
  return text.match(/[.!?]+/g)?.length ?? 0;
}

test('spoken dialogue is authored as short, stable, uniquely identified beats', () => {
  const beatIds = new Set();

  for (const [dialogueKey, dialogue] of Object.entries(CORE_HOOK_V03.dialogue)) {
    assert.equal(
      Object.hasOwn(dialogue, 'body'),
      false,
      `${dialogueKey} should not fall back to a long body block`,
    );
    assert.ok(Array.isArray(dialogue.beats), `${dialogueKey} should declare beats`);
    assert.ok(dialogue.beats.length > 0, `${dialogueKey} should include at least one beat`);

    for (const beat of dialogue.beats) {
      assert.equal(typeof beat.id, 'string', `${dialogueKey} beat should have an id`);
      assert.ok(
        beat.id.startsWith(`${dialogue.id}.`),
        `${beat.id} should be namespaced to ${dialogue.id}`,
      );
      assert.equal(beatIds.has(beat.id), false, `${beat.id} should be globally unique`);
      beatIds.add(beat.id);

      assert.equal(typeof beat.text, 'string', `${beat.id} should have text`);
      assert.equal(beat.text, beat.text.trim(), `${beat.id} should not pad its text`);
      assert.ok(beat.text.length > 0, `${beat.id} should not be empty`);
      assert.ok(
        beat.text.length <= MAX_BEAT_LENGTH,
        `${beat.id} should stay within ${MAX_BEAT_LENGTH} characters`,
      );

      const sentences = sentenceCount(beat.text);
      assert.ok(sentences >= 1, `${beat.id} should be a complete thought`);
      assert.ok(sentences <= 2, `${beat.id} should contain at most two sentences`);
    }
  }
});

test('the correction performs concern, certainty, communal memory, then a courteous demand', () => {
  const correction = CORE_HOOK_V03.dialogue.correction.beats;

  assert.deepEqual(
    correction.map((beat) => beat.id),
    [
      'lumen-correction.concern',
      'lumen-correction.ledger-certainty',
      'lumen-correction.communal-memory',
      'lumen-correction.courteous-demand',
    ],
  );
  assert.match(correction[0].text, /afraid.*embarrassed/i);
  assert.match(correction[1].text, /Ledger.*never needed to lie/i);
  assert.match(correction[2].text, /remember alone.*remembers together/i);
  assert.match(correction[3].text, /Confirm the correction.*worry behind us/i);
});

test('dialogue gestures use the existing semantic Lumen action vocabulary', () => {
  const knownGestures = new Set(Object.values(STORY_ACTIONS_V1.lumen));
  const authoredGestures = Object.values(CORE_HOOK_V03.dialogue)
    .flatMap((dialogue) => dialogue.beats)
    .filter((beat) => beat.gesture)
    .map((beat) => beat.gesture);

  assert.deepEqual(authoredGestures, [
    STORY_ACTIONS_V1.lumen.happyHandGesture,
    STORY_ACTIONS_V1.lumen.acknowledging,
    STORY_ACTIONS_V1.lumen.acknowledging,
    STORY_ACTIONS_V1.lumen.relievedSigh,
    STORY_ACTIONS_V1.lumen.thoughtfulHeadShake,
  ]);
  for (const gesture of authoredGestures) {
    assert.ok(knownGestures.has(gesture), `${gesture} should be an existing Lumen gesture`);
  }

  assert.equal(CORE_HOOK_V03.dialogue.firstBell.beats.some((beat) => beat.gesture), false);
  assert.equal(CORE_HOOK_V03.dialogue.complyResponse.beats.length, 2);
  assert.equal(CORE_HOOK_V03.dialogue.alterResponse.beats.length, 2);
});
