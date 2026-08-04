import assert from 'node:assert/strict';
import test from 'node:test';
import { Fog, Scene } from 'three';

import { ARRIVAL_PROLOGUE_V1 } from '../src/config/arrival-prologue.js';
import {
  ARRIVAL_TREAD_SIGNATURE,
  ArrivalWorld,
} from '../src/visuals/ArrivalWorld.js';

function routeLength(points) {
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    total += Math.hypot(
      points[index + 1][0] - points[index][0],
      points[index + 1][2] - points[index][2],
    );
  }
  return total;
}

test('ArrivalWorld projects one matching tread anomaly and a takeable waiting lantern', () => {
  const scene = new Scene();
  const world = new ArrivalWorld(scene, { reducedMotion: true }).init();

  assert.equal(scene.getObjectByName('arrival_prologue_world'), world.root);
  assert.equal(world.rememberedTrail.visible, false);
  assert.equal(world.interactables.length, 1);
  assert.equal(world.interactables[0].id, 'arrival-lantern');
  assert.equal(ARRIVAL_TREAD_SIGNATURE, ARRIVAL_PROLOGUE_V1.treadSignature);
  assert.ok(
    routeLength(ARRIVAL_PROLOGUE_V1.hintRoute.points) >= 65,
    'the whiteout approach must earn distance before the gate',
  );
  assert.equal(
    scene.getObjectByName('arrival_snow_field').geometry.parameters.width,
    ARRIVAL_PROLOGUE_V1.environment.snowField.width,
  );
  assert.ok(scene.getObjectByName('arrival_approach_track_segment_0'));
  assert.ok(scene.getObjectByName('arrival_wrong_fork_segment_0'));
  assert.ok(scene.getObjectByName('arrival_distance_marker_6'));
  assert.ok(scene.getObjectByName('arrival_snow_drift_5'));

  const freshLeft = scene.getObjectByName('arrival_fresh_print_0');
  const rememberedLeft = scene.getObjectByName('arrival_remembered_print_0');
  assert.equal(freshLeft.userData.foot, 'left');
  assert.equal(rememberedLeft.userData.foot, 'left');
  assert.equal(freshLeft.userData.treadSignature, ARRIVAL_TREAD_SIGNATURE);
  assert.equal(rememberedLeft.userData.treadSignature, ARRIVAL_TREAD_SIGNATURE);

  assert.equal(world.revealRememberedTrail(), true);
  assert.equal(world.rememberedTrail.visible, true);
  world.setState({ eventsSeen: ['arrival-lantern-taken'] });
  assert.equal(world.lantern.visible, false);
  assert.equal(world.root.visible, true);

  world.setState({ eventsSeen: ['steward-lumen-met'] });
  assert.equal(world.root.visible, false);
  assert.equal(world.revealRememberedTrail(), false);

  world.dispose();
  assert.equal(scene.getObjectByName('arrival_prologue_world'), undefined);
  assert.equal(world.interactables.length, 0);
});

test('ArrivalWorld snow updates only when motion is enabled and the prologue is active', () => {
  const scene = new Scene();
  scene.fog = new Fog(0xaabbcc, 34, 96);
  const world = new ArrivalWorld(scene).init();
  const initialY = world.snowPositions[1];
  const initialVersion = world.snow.geometry.attributes.position.version;

  world.update(0.05);
  assert.notEqual(world.snowPositions[1], initialY);
  assert.ok(world.snow.geometry.attributes.position.version > initialVersion);
  assert.equal(scene.fog.near, ARRIVAL_PROLOGUE_V1.environment.fog.near);
  assert.equal(scene.fog.far, ARRIVAL_PROLOGUE_V1.environment.fog.far);

  world.setState({ eventsSeen: ['steward-lumen-met'] });
  const completedY = world.snowPositions[1];
  world.update(0.05);
  assert.equal(world.snowPositions[1], completedY);
  assert.equal(scene.fog.near, 34, 'completed arrival restores canonical day/night fog');
  assert.equal(scene.fog.far, 96);
  world.dispose();
});

test('ArrivalWorld restores fog installed after its own initialization', () => {
  const scene = new Scene();
  const world = new ArrivalWorld(scene, { reducedMotion: true }).init();
  scene.fog = new Fog(0xb9c6d4, 34, 96);

  world.update(0.016);
  assert.equal(scene.fog.near, ARRIVAL_PROLOGUE_V1.environment.fog.near);
  world.setState({ eventsSeen: ['steward-lumen-met'] });
  assert.equal(scene.fog.near, 34);
  assert.equal(scene.fog.far, 96);
  assert.equal(scene.fog.color.getHex(), 0xb9c6d4);
  world.dispose();
});
