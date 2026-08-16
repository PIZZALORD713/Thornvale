import assert from 'node:assert/strict';
import test from 'node:test';
import { Fog, Object3D, Scene } from 'three';

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

function distanceToSnowFieldEdge(point, field) {
  const halfWidth = field.width * 0.5;
  const halfLength = field.length * 0.5;
  return Math.min(
    point[0] - (field.center.x - halfWidth),
    (field.center.x + halfWidth) - point[0],
    point[2] - (field.center.z - halfLength),
    (field.center.z + halfLength) - point[2],
  );
}

function makeV2ArrivalContent() {
  const content = structuredClone(ARRIVAL_PROLOGUE_V1);
  content.environment.snowField = {
    width: 112,
    length: 126,
    center: { x: 0, z: 34 },
  };
  content.environment.skirt = {
    pines: [
      { x: -32, z: 58, height: 8.2, radius: 1.55, rotation: 0.2 },
      { x: 29, z: 18, height: 6.8, radius: 1.3, rotation: -0.1 },
    ],
    brush: [
      { x: -27, z: 47, scaleX: 1.8, scaleY: 0.8, scaleZ: 1.2, rotation: 0.3 },
    ],
    drifts: [
      { x: 31, z: 42, scaleX: 4.6, scaleZ: 2.1, height: 0.8 },
    ],
  };
  content.fold = {
    leash: 10,
    recoveryDistance: 4.8,
    pulseDurationMs: 250,
    cooldownMs: 1600,
    waypost: {
      x: -8.4,
      y: 0,
      z: 51,
      rotation: -0.24,
      ribbonColor: 0xb77a2d,
    },
    freshPrints: [
      [-8.8, 52.1],
      [-8.3, 51.3],
      [-7.7, 50.5],
      [-7.1, 49.7],
    ],
  };
  return content;
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
  assert.equal(
    scene.getObjectByName('arrival_distance_marker_0'),
    undefined,
    'the broken waypost replaces the overlapping ordinary marker',
  );
  assert.ok(scene.getObjectByName('arrival_distance_marker_6'));
  assert.ok(scene.getObjectByName('arrival_snow_drift_5'));
  assert.ok(scene.getObjectByName('arrival_fold_waypost'));
  for (const route of ARRIVAL_PROLOGUE_V1.fold.reviewedRoutes) {
    for (const point of route) {
      assert.ok(
        distanceToSnowFieldEdge(point, ARRIVAL_PROLOGUE_V1.environment.snowField)
          > ARRIVAL_PROLOGUE_V1.environment.fog.far,
        'every reviewed route point keeps the rendered plane edge beyond fog',
      );
    }
  }

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

test('ArrivalWorld projects the expanded snow bed, procedural skirt, and one fold landmark', () => {
  const content = makeV2ArrivalContent();
  const scene = new Scene();
  const world = new ArrivalWorld(scene, { content, reducedMotion: true }).init();

  const snowField = scene.getObjectByName('arrival_snow_field');
  assert.equal(snowField.geometry.parameters.width, 112);
  assert.equal(snowField.geometry.parameters.height, 126);
  assert.equal(snowField.position.z, 34);
  assert.ok(scene.getObjectByName('arrival_skirt_pine_0'));
  assert.ok(scene.getObjectByName('arrival_skirt_pine_1'));
  assert.ok(scene.getObjectByName('arrival_skirt_brush_0'));
  assert.ok(scene.getObjectByName('arrival_skirt_drift_0'));
  const spawn = content.anchors.spawn;
  const nearestRearPine = Math.min(...content.environment.skirt.pines
    .filter((pine) => pine.z > spawn.z)
    .map((pine) => Math.hypot(pine.x - spawn.x, pine.z - spawn.z)));
  assert.ok(
    nearestRearPine <= content.environment.fog.far,
    'turning around at spawn reveals woods inside the whiteout range',
  );

  const waypost = scene.getObjectByName('arrival_fold_waypost');
  assert.ok(waypost);
  assert.equal(waypost.userData.prongCount, 3);
  assert.equal(waypost.userData.snappedProngCount, 1);
  assert.equal(waypost.position.x, content.fold.waypost.x);
  assert.equal(waypost.position.z, content.fold.waypost.z);
  assert.equal(
    scene.getObjectByName('arrival_fold_waypost_ribbon').material.color.getHex(),
    content.fold.waypost.ribbonColor,
  );
  assert.ok(scene.getObjectByName('arrival_fold_fresh_print_0'));
  assert.equal(
    scene.getObjectByName('arrival_fold_fresh_print_0').userData.treadSignature,
    ARRIVAL_TREAD_SIGNATURE,
  );

  world.dispose();
});

test('ArrivalWorld emits one deterministic relocation cue inside a bounded whiteout pulse', () => {
  const content = makeV2ArrivalContent();
  const scene = new Scene();
  scene.fog = new Fog(0xaabbcc, 34, 96);
  const sky = new Object3D();
  sky.name = 'kawaiiSkyDome';
  sky.material = { uniforms: { uWhiteout: { value: 0 } } };
  scene.add(sky);
  const world = new ArrivalWorld(scene, { content }).init();

  assert.equal(world.beginFoldPresentation(), true);
  assert.equal(world.beginFoldPresentation(), false, 'an active fold cannot stack');
  assert.deepEqual(world.getFoldPresentationState(), {
    active: true,
  });
  assert.equal(world.consumeFoldRelocationCue(), false);

  world.update(0.1);
  assert.equal(world.consumeFoldRelocationCue(), true);
  assert.equal(world.consumeFoldRelocationCue(), false, 'relocation emits exactly once');
  assert.ok(scene.fog.far < content.environment.fog.far);
  assert.ok(sky.material.uniforms.uWhiteout.value > 0.9, 'the sky closes with the fold');

  world.update(0.1);
  world.update(0.1);
  assert.equal(world.getFoldPresentationState().active, false);
  assert.equal(scene.fog.near, content.environment.fog.near);
  assert.equal(scene.fog.far, content.environment.fog.far);
  assert.equal(sky.material.uniforms.uWhiteout.value, 0);

  world.dispose();
  assert.equal(scene.fog.near, 34);
  assert.equal(scene.fog.far, 96);
});

test('ArrivalWorld reduced-motion fold stays readable without animating snow', () => {
  const content = makeV2ArrivalContent();
  const scene = new Scene();
  scene.fog = new Fog(0xaabbcc, 34, 96);
  const world = new ArrivalWorld(scene, { content, reducedMotion: true }).init();
  const initialSnowY = world.snowPositions[1];

  assert.equal(world.beginFoldPresentation(), true);
  world.update(0.1);
  assert.equal(world.reducedMotion, true);
  assert.equal(world.snowPositions[1], initialSnowY, 'reduced motion keeps flakes static');
  assert.ok(scene.fog.far <= 2.4, 'the static whiteout remains readable as authored recovery');
  assert.equal(world.consumeFoldRelocationCue(), true);

  world.update(0.1);
  world.update(0.1);
  assert.equal(world.getFoldPresentationState().active, false);
  world.dispose();
});
