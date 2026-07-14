import assert from 'node:assert/strict';
import test from 'node:test';

import { DAY_ONE_V01 } from '../src/content/day-one-v01.js';
import { STORY_ACTIONS_V1 } from '../src/content/story-actions-v1.js';
import { DayOneActionPresenter } from '../src/visuals/DayOneActionPresenter.js';

function event(type, action = STORY_ACTIONS_V1.dayOne.plantSeed) {
  return {
    type,
    id: action.id,
    action,
    duration: action.duration,
  };
}

test('normal motion scales the skeletal clip and cancels it at every terminal event', () => {
  const plays = [];
  const cancellations = [];
  let commitCues = 0;
  const root = { dataset: {} };
  const animator = {
    getClip: () => ({ duration: 6.2 }),
    playOneShot: (name, options) => plays.push({ name, options }),
    cancelOneShot: (name, options) => cancellations.push({ name, options }),
  };
  const presenter = new DayOneActionPresenter({
    getAnimator: () => animator,
    documentRoot: root,
    onCommitCue: () => { commitCues += 1; },
  });

  presenter.handle(event('start'));
  assert.equal(root.dataset.dayOneAction, 'day-one.plant-seed');
  assert.equal(plays[0].name, STORY_ACTIONS_V1.dayOne.plantSeed.clipName);
  assert.equal(plays[0].options.timeScale, 2);

  presenter.handle(event('commit'));
  presenter.handle(event('complete'));
  assert.equal(commitCues, 1);
  assert.equal(cancellations.length, 1);
  assert.equal(cancellations[0].name, STORY_ACTIONS_V1.dayOne.plantSeed.clipName);
  assert.equal(root.dataset.dayOneAction, undefined);

  presenter.handle(event('start'));
  presenter.handle(event('cancel'));
  presenter.handle(event('start'));
  presenter.handle(event('error'));
  assert.equal(cancellations.length, 3);
});

test('reduced motion preserves the action timeline without playing a skeletal clip', () => {
  let plays = 0;
  const presenter = new DayOneActionPresenter({
    getAnimator: () => ({ playOneShot: () => { plays += 1; } }),
    reducedMotion: true,
    documentRoot: { dataset: {} },
  });

  presenter.handle(event('start'));
  presenter.handle(event('cancel'));
  assert.equal(plays, 0);
});

test('an action without a skeletal clip streams its full timeline to the code-native fallback', () => {
  const action = DAY_ONE_V01.actions.chopWood;
  const fallbackEvents = [];
  const commitEvents = [];
  const root = { dataset: {} };
  let plays = 0;
  const presenter = new DayOneActionPresenter({
    getAnimator: () => ({ playOneShot: () => { plays += 1; return false; } }),
    documentRoot: root,
    onFallbackCue: (fallbackEvent) => fallbackEvents.push(fallbackEvent.type),
    onCommitCue: (commitEvent) => commitEvents.push(commitEvent.type),
  });
  const context = { targetPosition: { x: 2, y: 0, z: 4 } };
  const makeEvent = (type, progress, committed = false) => ({
    type,
    id: action.id,
    action,
    duration: action.duration,
    commitTime: action.commitTime,
    progress,
    committed,
    context,
  });

  presenter.handle(makeEvent('start', 0));
  presenter.handle(makeEvent('progress', 0.5));
  presenter.handle(makeEvent('commit', action.commitTime / action.duration, true));
  presenter.handle(makeEvent('complete', 1, true));

  assert.equal(plays, 0);
  assert.deepEqual(fallbackEvents, ['start', 'progress', 'commit', 'complete']);
  assert.deepEqual(commitEvents, ['commit']);
  assert.equal(root.dataset.dayOneAction, undefined);
});
