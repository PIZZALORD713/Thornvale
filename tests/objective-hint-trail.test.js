import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InstancedMesh,
  Matrix4,
  Scene,
  Vector3,
} from 'three';
import {
  OBJECTIVE_HINT_TRAIL_DEFAULTS,
  ObjectiveHintTrail,
  splitObjectiveHintApproach,
} from '../src/visuals/ObjectiveHintTrail.js';

function matrixPosition(mesh, index) {
  const matrix = new Matrix4();
  mesh.getMatrixAt(index, matrix);
  return new Vector3().setFromMatrixPosition(matrix);
}

test('hint trail initializes hidden as exactly one collision-free instanced draw', () => {
  const scene = new Scene();
  const trail = new ObjectiveHintTrail(scene).init();
  const draws = [];
  trail.root.traverse((object) => {
    if (object instanceof InstancedMesh) draws.push(object);
  });

  assert.equal(scene.getObjectByName('objective_hint_trail'), trail.root);
  assert.equal(draws.length, 1);
  assert.equal(draws[0], trail.mesh);
  assert.equal(trail.root.userData.cameraCollision, false);
  assert.equal(trail.root.userData.physicsCollision, false);
  assert.equal(trail.mesh.userData.cameraCollision, false);
  assert.equal(trail.mesh.userData.physicsCollision, false);
  assert.equal(trail.mesh.visible, false);
  assert.equal(trail.mesh.count, 0);
  assert.equal(trail.material.depthTest, true);
  assert.equal(trail.material.depthWrite, false);
  assert.equal(trail.material.polygonOffset, true);
  trail.dispose();
});

test('show clones and evenly samples a valid route within the marker budget', () => {
  const scene = new Scene();
  const trail = new ObjectiveHintTrail(scene, {
    reducedMotion: true,
    spacing: 1,
    maxMarkers: 5,
  }).init();
  const points = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 4 },
  ];

  assert.equal(trail.show({ points, cueId: 'day-one-catch-fish' }), true);
  assert.equal(trail.active, true);
  assert.equal(trail.mesh.visible, true);
  assert.equal(trail.mesh.count, 5);
  assert.equal(trail.mesh.userData.cueId, 'day-one-catch-fish');

  const positions = [];
  for (let index = 0; index < trail.mesh.count; index += 1) {
    positions.push(matrixPosition(trail.mesh, index));
  }
  assert.deepEqual(positions.map(({ x, z }) => [x, z]), [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 3],
    [0, 4],
  ]);
  assert.ok(positions.every(({ y }) => Math.abs(y - trail.groundOffset) <= 1e-6));

  points[1].z = 400;
  trail.update(0.5);
  assert.equal(matrixPosition(trail.mesh, 4).z, 4, 'caller mutation cannot move active markers');
  trail.dispose();
});

test('approach split leaves the safe route body a few feet short of its target', () => {
  const split = splitObjectiveHintApproach([
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 4 },
    { x: 4, y: 0, z: 4 },
  ], 2.4);

  assert.ok(split);
  assert.deepEqual(split.target.toArray(), [4, 0, 4]);
  assert.ok(Math.abs(split.handoff.x - 1.6) <= 1e-9);
  assert.deepEqual(split.handoff.toArray().slice(1), [0, 4]);
  assert.deepEqual(split.route.slice(0, -1).map((point) => point.toArray()), [
    [0, 0, 0], [0, 0, 4],
  ]);
  assert.ok(Math.abs(split.handoff.distanceTo(split.target) - 2.4) <= 1e-9);
});

test('only the short final connector smoothly retargets toward a live destination', () => {
  const scene = new Scene();
  const liveTarget = new Vector3(0, 0, 8);
  const trail = new ObjectiveHintTrail(scene, {
    reducedMotion: true,
    spacing: 1,
    targetStopDistance: 2.4,
    retargetSharpness: 4,
  }).init();

  assert.equal(trail.show({
    points: [[0, 0], [0, 8]],
    getTargetPosition: () => liveTarget,
  }), true);
  const fixedBefore = trail._routeMarkers.map(({ position }) => position.clone());
  const endpointBefore = trail._connectorMarkers.at(-1).position.clone();
  assert.ok(Math.abs(trail._routeMarkers.at(-1).position.z - 5.6) <= 1e-9);

  liveTarget.set(2, 0, 8);
  trail.update(0.1);
  const endpointAfter = trail._connectorMarkers.at(-1).position;
  assert.deepEqual(
    trail._routeMarkers.map(({ position }) => position.toArray()),
    fixedBefore.map((position) => position.toArray()),
    'retargeting must not bend or replace the reviewed route body',
  );
  assert.ok(endpointAfter.x > endpointBefore.x, 'connector should begin following the target');
  assert.ok(endpointAfter.x < liveTarget.x, 'connector should ease instead of snapping');
  assert.equal(endpointAfter.z, 8);

  trail.update(1);
  assert.ok(trail._connectorMarkers.at(-1).position.x > endpointAfter.x);
  assert.ok(trail._connectorMarkers.at(-1).position.x < liveTarget.x);
  trail.dispose();
});

test('retarget damping is frame-rate independent and rejects invalid or leashed jumps', () => {
  const makeTrail = () => {
    const target = new Vector3(0, 0, 8);
    const trail = new ObjectiveHintTrail(new Scene(), {
      reducedMotion: true,
      targetStopDistance: 2.4,
      retargetSharpness: 4,
      targetLeash: 2.5,
    }).init();
    trail.show({ points: [[0, 0], [0, 8]], getTargetPosition: () => target });
    return { trail, target };
  };
  const oneStep = makeTrail();
  const twoSteps = makeTrail();
  oneStep.target.x = 2;
  twoSteps.target.x = 2;
  oneStep.trail.update(0.1);
  twoSteps.trail.update(0.05);
  twoSteps.trail.update(0.05);
  assert.ok(
    oneStep.trail._smoothedTarget.distanceTo(twoSteps.trail._smoothedTarget) <= 1e-9,
    'exponential retargeting should not depend on frame subdivision',
  );

  const held = oneStep.trail._smoothedTarget.clone();
  oneStep.target.set(20, 0, 8);
  oneStep.trail.update(0.1);
  assert.deepEqual(oneStep.trail._smoothedTarget.toArray(), held.toArray());
  oneStep.target.x = NaN;
  oneStep.trail.update(0.1);
  assert.deepEqual(oneStep.trail._smoothedTarget.toArray(), held.toArray());
  oneStep.trail.dispose();
  twoSteps.trail.dispose();
});

test('a truncated route never invents a connector to a distant target', () => {
  const trail = new ObjectiveHintTrail(new Scene(), { reducedMotion: true }).init();
  trail.show({
    points: [[0, 0], [0, 24]],
    getTargetPosition: () => new Vector3(0, 0, 40),
    connectToTarget: false,
  });
  assert.equal(trail._connectorMarkers.length, 0);
  assert.equal(trail._getTargetPosition, null);
  trail.dispose();
});

test('one deterministic four-second lifetime refreshes without stacking resources', () => {
  const scene = new Scene();
  const trail = new ObjectiveHintTrail(scene, { reducedMotion: true }).init();
  const root = trail.root;
  const mesh = trail.mesh;
  const geometry = trail.geometry;
  const material = trail.material;
  const points = [[0, 0], [0, 6]];

  assert.equal(OBJECTIVE_HINT_TRAIL_DEFAULTS.duration, 4);
  assert.equal(trail.show({ points }), true);
  assert.equal(trail.update(3.99), true);
  assert.equal(trail.active, true);
  assert.equal(trail.mesh.visible, true);

  assert.equal(trail.show({ points: [[0, 0], [6, 0]] }), true, 're-press refreshes the cue');
  assert.equal(trail.elapsed, 0);
  assert.equal(trail.update(1.1), true);
  assert.equal(trail.root, root);
  assert.equal(trail.mesh, mesh);
  assert.equal(trail.geometry, geometry);
  assert.equal(trail.material, material);
  assert.equal(scene.children.filter((child) => child === root).length, 1);

  trail.hide();
  trail.show({ points });
  assert.equal(trail.update(3.99), true);
  assert.equal(trail.update(0.01), false);
  assert.equal(trail.active, false);
  assert.equal(trail.mesh.visible, false);
  assert.equal(trail.mesh.count, 0);
  trail.dispose();
});

test('reduced motion holds every marker matrix still for the full cue', () => {
  const scene = new Scene();
  const trail = new ObjectiveHintTrail(scene, { reducedMotion: true }).init();
  trail.show({ points: [[0, 0], [2, 1], [4, 0]] });
  const before = new Matrix4();
  const after = new Matrix4();
  trail.mesh.getMatrixAt(2, before);

  assert.equal(trail.update(2), true);
  trail.mesh.getMatrixAt(2, after);
  assert.deepEqual(after.elements, before.elements);
  assert.equal(trail.active, true);
  assert.equal(trail.update(2), false);
  trail.dispose();
});

test('invalid paths fail closed and hide any previous cue', () => {
  const scene = new Scene();
  const trail = new ObjectiveHintTrail(scene).init();
  assert.equal(trail.show({ points: [[0, 0], [0, 3]] }), true);
  assert.equal(trail.show({ points: [[0, 0]] }), false);
  assert.equal(trail.active, false);
  assert.equal(trail.mesh.visible, false);
  assert.equal(trail.show({ points: [[0, 0], [NaN, 2]] }), false);
  assert.equal(trail.show({ points: [[0, 0], [0, 3]], duration: 0 }), false);
  assert.equal(trail.update(1), false);
  trail.dispose();
});

test('hide and dispose are idempotent and release owned GPU resources once', () => {
  const scene = new Scene();
  const trail = new ObjectiveHintTrail(scene).init();
  trail.show({ points: [[0, 0], [0, 3]] });
  const root = trail.root;
  const geometry = trail.geometry;
  const material = trail.material;
  let geometryDisposals = 0;
  let materialDisposals = 0;
  geometry.dispose = () => { geometryDisposals += 1; };
  material.dispose = () => { materialDisposals += 1; };

  trail.hide();
  trail.hide();
  trail.dispose();
  trail.dispose();
  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
  assert.equal(scene.children.includes(root), false);
  assert.equal(trail.root, null);
  assert.equal(trail.mesh, null);
  assert.equal(trail.geometry, null);
  assert.equal(trail.material, null);
  assert.equal(trail.show({ points: [[0, 0], [0, 3]] }), false);
});
