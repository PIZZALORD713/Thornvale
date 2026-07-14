import assert from 'node:assert/strict';
import test from 'node:test';

import { STORY_ACTIONS_V1 } from '../src/content/story-actions-v1.js';
import { DayOneActionController } from '../src/game/DayOneActionController.js';

async function runAtRate(definition, hz) {
  const controller = new DayOneActionController();
  const events = [];
  let commits = 0;
  controller.subscribe((event) => {
    if (event.type !== 'progress') events.push(event.type);
  });
  const result = controller.run(definition, {
    onCommit() {
      commits += 1;
    },
  });
  const frames = Math.ceil(definition.duration * hz) + 1;
  for (let frame = 0; frame < frames; frame += 1) controller.update(1 / hz);
  return { commits, events, result: await result };
}

for (const hz of [60, 120, 144]) {
  test(`plant action commits exactly once and completes at ${hz} Hz`, async () => {
    const outcome = await runAtRate(STORY_ACTIONS_V1.dayOne.plantSeed, hz);
    assert.equal(outcome.commits, 1);
    assert.equal(outcome.result.committed, true);
    assert.equal(outcome.result.cancelled, false);
    assert.deepEqual(outcome.events, ['start', 'commit', 'complete']);
  });
}

test('a slow frame crosses the commit cue before completing the action', async () => {
  const controller = new DayOneActionController();
  const order = [];
  controller.subscribe((event) => {
    if (event.type !== 'progress') order.push(event.type);
  });
  const result = controller.run(STORY_ACTIONS_V1.dayOne.waterSeed, {
    onCommit() {
      order.push('transaction');
    },
  });

  controller.update(2.2);
  assert.deepEqual(order, ['start']);
  controller.update(2);
  const outcome = await result;
  assert.deepEqual(order, ['start', 'transaction', 'commit', 'complete']);
  assert.equal(outcome.committed, true);
});

test('pre-commit cancellation mutates nothing and post-commit cancellation cannot roll back', async () => {
  const controller = new DayOneActionController();
  let commits = 0;

  const before = controller.run(STORY_ACTIONS_V1.dayOne.plantSeed, {
    onCommit: () => { commits += 1; },
  });
  controller.update(2.2);
  controller.cancel('escaped');
  const preCommit = await before;
  assert.equal(preCommit.committed, false);
  assert.equal(commits, 0);

  const after = controller.run(STORY_ACTIONS_V1.dayOne.plantSeed, {
    onCommit: () => { commits += 1; },
  });
  controller.update(2.4);
  controller.cancel('escaped-after-contact');
  const postCommit = await after;
  assert.equal(postCommit.committed, true);
  assert.equal(commits, 1);
});

test('presentation subscriber failure cannot stop the action clock', async () => {
  const controller = new DayOneActionController();
  let commits = 0;
  let warnings = 0;
  const originalWarn = console.warn;
  console.warn = () => { warnings += 1; };
  controller.subscribe(() => {
    throw new Error('optional presenter failed');
  });
  try {
    const result = controller.run(STORY_ACTIONS_V1.dayOne.plantSeed, {
      onCommit: () => { commits += 1; },
    });
    controller.update(4);
    assert.equal((await result).committed, true);
    assert.equal(commits, 1);
    assert.ok(warnings >= 1);
  } finally {
    console.warn = originalWarn;
  }
});

test('the action clock owns control locking and forwards deterministic facing context', async () => {
  const locks = [];
  const targetPosition = { x: 4, y: 0, z: -2 };
  const controller = new DayOneActionController({
    control: {
      setActionLocked(locked, options) {
        locks.push({ locked, options });
      },
    },
  });

  const result = controller.run(STORY_ACTIONS_V1.dayOne.plantSeed, {
    context: { targetPosition },
  });
  assert.equal(locks.length, 1);
  assert.equal(locks[0].locked, true);
  assert.equal(locks[0].options.context.targetPosition, targetPosition);

  controller.update(4);
  await result;
  assert.equal(locks.length, 2);
  assert.equal(locks[1].locked, false);
  assert.equal(locks[1].options.context.targetPosition, targetPosition);

  const cancelled = controller.run(STORY_ACTIONS_V1.dayOne.waterSeed);
  controller.cancel('test');
  await cancelled;
  assert.deepEqual(locks.slice(2).map((entry) => entry.locked), [true, false]);
});
