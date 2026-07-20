import assert from 'node:assert/strict';
import test from 'node:test';

import { CORE_HOOK_V03 } from '../src/content/core-hook-v03.js';
import { DAY_ONE_V01 } from '../src/content/day-one-v01.js';
import { KEY_OBJECT_CUES_V1 } from '../src/content/key-object-cues-v1.js';
import { TOWN_LAYOUT } from '../src/config/town.js';

const INTERACTABLE_IDS = new Set([
  CORE_HOOK_V03.ids.steward,
  CORE_HOOK_V03.ids.ledger,
  CORE_HOOK_V03.ids.bell,
  ...Object.values(DAY_ONE_V01.ids),
]);

function finitePoint(value) {
  return ['x', 'y', 'z'].every((axis) => Number.isFinite(Number(value?.[axis])));
}

test('every active objective declares a finite, reachable target contract', () => {
  const objectives = [
    ...Object.values(CORE_HOOK_V03.objectives),
    ...Object.values(DAY_ONE_V01.objectives),
  ];
  assert.equal(objectives.length, 20);

  for (const objective of objectives) {
    const target = objective.target;
    assert.ok(target, `${objective.id} must declare a target`);
    if (target.kind === 'interactable') {
      assert.ok(INTERACTABLE_IDS.has(target.id), `${objective.id} references ${target.id}`);
    } else if (target.kind === 'anchor') {
      assert.ok(finitePoint(target.position), `${objective.id} anchor must be finite`);
    } else if (target.kind === 'route-destination') {
      assert.ok(TOWN_LAYOUT.storyRoutes[target.route], `${objective.id} route must exist`);
      assert.ok(target.arrivalRadius >= 1.35, `${objective.id} must retain the outcome radius`);
    } else {
      assert.fail(`${objective.id} has unsupported target kind ${target.kind}`);
    }
  }
});

test('key-object cues are bounded local UI assets and never replace objective text', () => {
  assert.deepEqual(Object.keys(KEY_OBJECT_CUES_V1), ['ledger', 'camp', 'bell']);
  for (const cue of Object.values(KEY_OBJECT_CUES_V1)) {
    assert.match(cue.src, /^\/ui\/key-object-cues\/v1\/[a-z-]+\.avif$/);
    assert.ok(cue.label);
    assert.equal(Object.isFrozen(cue), true);
  }

  const cuedObjectives = [
    CORE_HOOK_V03.objectives.signLedger,
    CORE_HOOK_V03.objectives.firstAfternoon,
    CORE_HOOK_V03.objectives.ringBell,
  ];
  for (const objective of cuedObjectives) {
    assert.ok(objective.cue);
    assert.ok(objective.text, `${objective.id} must retain an authoritative text fallback`);
  }
});
