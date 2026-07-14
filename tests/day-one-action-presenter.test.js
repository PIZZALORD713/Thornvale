import assert from 'node:assert/strict';
import test from 'node:test';

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
