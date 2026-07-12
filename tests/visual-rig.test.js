import test from 'node:test';
import assert from 'node:assert/strict';

import { Group } from 'three';
import { VisualRig } from '../src/visuals/VisualRig.js';

test('camera proximity hides and restores the player visual', () => {
  const rig = new VisualRig();
  const visual = new Group();
  rig.setVisual(visual);

  rig.setCameraOccluded(true);
  assert.equal(visual.visible, false);

  rig.setCameraOccluded(false);
  assert.equal(visual.visible, true);
});

test('grounding stabilization is rate-limited and bounded', () => {
  const rig = new VisualRig();
  rig.visual = {};

  rig.stabilizeGrounding(1 / 60, 0, {
    measuredBottomY: -0.04,
    clearance: 0,
    maxOffset: 0.055,
    maxSpeed: 0.12,
    sharpness: 100,
  });

  assert.ok(rig.groundingOffsetY > 0);
  assert.ok(rig.groundingOffsetY <= 0.002 + Number.EPSILON);
  assert.equal(rig.group.position.y, rig.groundingOffsetY);

  for (let frame = 0; frame < 120; frame += 1) {
    rig.stabilizeGrounding(1 / 60, 0, {
      measuredBottomY: -1,
      clearance: 0,
      maxOffset: 0.055,
      maxSpeed: 0.12,
      sharpness: 100,
    });
  }

  assert.ok(rig.groundingOffsetY <= 0.055 + Number.EPSILON);
});

test('grounding stabilization ignores noise inside its dead zone', () => {
  const rig = new VisualRig();
  rig.visual = {};

  rig.stabilizeGrounding(1 / 60, 0, {
    measuredBottomY: -0.002,
    clearance: 0,
    deadZone: 0.003,
  });

  assert.equal(rig.groundingOffsetY, 0);
  assert.equal(rig.group.position.y, 0);
});
