import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Color,
  Points,
  Scene,
  Vector3,
} from 'three';
import {
  OBJECTIVE_HINT_TRAIL_DEFAULTS,
  ObjectiveHintTrail,
  resolveWindGustFrame,
  resolveWindHeightProfile,
  splitObjectiveHintApproach,
} from '../src/visuals/ObjectiveHintTrail.js';

function particlePosition(trail, index) {
  return new Vector3().fromBufferAttribute(trail.geometry.attributes.position, index);
}

test('wind trail initializes hidden as exactly one collision-free point-cloud draw', () => {
  const scene = new Scene();
  const trail = new ObjectiveHintTrail(scene).init();
  const draws = [];
  trail.root.traverse((object) => {
    if (object instanceof Points) draws.push(object);
  });

  assert.equal(scene.getObjectByName('objective_hint_trail'), trail.root);
  assert.equal(draws.length, 1);
  assert.equal(draws[0], trail.mesh);
  assert.equal(trail.root.userData.cameraCollision, false);
  assert.equal(trail.root.userData.physicsCollision, false);
  assert.equal(trail.mesh.userData.cameraCollision, false);
  assert.equal(trail.mesh.userData.physicsCollision, false);
  assert.equal(trail.mesh.visible, false);
  assert.equal(trail.geometry.drawRange.count, 0);
  assert.equal(trail.material.depthTest, true);
  assert.equal(trail.material.depthWrite, false);
  assert.equal(trail.material.polygonOffset, true);
  trail.dispose();
});

test('show clones the route into a bounded ivory, sage, and gold wind field', () => {
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
  assert.equal(trail.geometry.drawRange.count, 5);
  assert.equal(trail.mesh.userData.cueId, 'day-one-catch-fish');

  const positions = [];
  for (let index = 0; index < trail.geometry.drawRange.count; index += 1) {
    positions.push(particlePosition(trail, index));
  }
  assert.ok(
    Math.max(...positions.map(({ x }) => x)) - Math.min(...positions.map(({ x }) => x)) > 0.15,
    'the cloud must have lateral volume instead of reading as a line',
  );
  assert.ok(
    positions[0].z > Math.max(...positions.slice(1).map(({ z }) => z)),
    'the centered gold point must lead the clustered body',
  );
  assert.ok(positions.every(({ x, y, z }) => [x, y, z].every(Number.isFinite)));
  assert.ok(Math.min(...positions.map(({ y }) => y)) >= 0.09);
  assert.ok(Math.max(...positions.map(({ y }) => y)) <= 1.6);
  assert.deepEqual(trail._markers.map(({ windRole }) => windRole), [
    'gold', 'ivory', 'ivory', 'sage', 'sage',
  ]);
  const color = new Color();
  color.fromBufferAttribute(trail.geometry.attributes.color, 0);
  assert.equal(color.getHex(), 0xf2c56f, 'only the leading cue carries warm gold');
  assert.equal(trail.geometry.type, 'BufferGeometry');
  assert.equal(trail.material.opacity, 0.78);

  points[1].z = 400;
  trail.update(0.5);
  assert.equal(trail._routePoints.at(-1).z, 4, 'caller mutation cannot move the cloned route');
  trail.dispose();
});

test('normal gust forms irregular three-dimensional clumps instead of a sampled line', () => {
  const trail = new ObjectiveHintTrail(new Scene(), {
    spacing: 0.09,
    maxMarkers: 64,
  }).init();
  trail.show({ points: [[0, 0], [0, 24]] });
  trail.update(1);

  const visible = trail._markers
    .map((_, index) => ({
      index,
      opacity: trail.geometry.attributes.aOpacity.getX(index),
      point: particlePosition(trail, index),
    }))
    .filter(({ opacity }) => opacity > 0.01);
  const positions = visible.map(({ point }) => point);
  const body = visible.filter(({ index }) => index > 0).map(({ point }) => point);
  const lateralSpan = Math.max(...positions.map(({ x }) => x))
    - Math.min(...positions.map(({ x }) => x));
  const verticalSpan = Math.max(...body.map(({ y }) => y))
    - Math.min(...body.map(({ y }) => y));
  const longitudinalSteps = positions.slice(2).map(({ z }, index) => (
    Math.abs(z - positions[index + 1].z)
  ));

  assert.ok(positions.length >= 30, 'the main gust should read as a field, not a few markers');
  assert.ok(lateralSpan > 0.55, 'the gust needs a braided lateral silhouette');
  assert.ok(lateralSpan < 1.05, 'the gust should stay a stream instead of becoming a haze');
  assert.ok(verticalSpan > 0.18, 'the gust needs visible air volume above the route');
  assert.ok(verticalSpan < 0.4, 'the chest-height body should stay cohesive');
  assert.ok(body.every(({ y }) => y >= 0.98 && y <= 1.38));
  assert.ok(positions[0].y >= 1.45 && positions[0].y <= 1.55);
  assert.ok(Math.min(...longitudinalSteps) < 0.08, 'particles should gather within clumps');
  assert.ok(Math.max(...longitudinalSteps) > 0.2, 'clumps should leave irregular longitudinal gaps');
  assert.ok(Math.abs(positions[0].x) <= 1e-9, 'only the directional leader stays centered');
  trail.dispose();
});

test('height profile rises spatially from pickup to stream and descends only on handoff', () => {
  const totalDistance = 10;
  const handoffDistance = 7.6;
  const sample = (distance) => resolveWindHeightProfile({
    distance,
    totalDistance,
    handoffDistance,
  });
  const pickup = sample(0);
  const rising = sample(1.2);
  const stream = sample(3);
  const handoff = sample(handoffDistance);
  const descending = sample(8.8);
  const arrival = sample(totalDistance);

  assert.deepEqual(pickup, {
    phase: 'pickup',
    bodyBase: 0.12,
    bodyRange: 0.16,
    leaderHeight: 0.26,
    curl: 0.02,
  });
  assert.equal(rising.phase, 'rise');
  assert.ok(rising.leaderHeight > pickup.leaderHeight);
  assert.ok(rising.leaderHeight < stream.leaderHeight);
  assert.equal(stream.phase, 'stream');
  assert.equal(stream.leaderHeight, 1.5);
  assert.equal(handoff.phase, 'stream');
  assert.equal(handoff.leaderHeight, stream.leaderHeight);
  assert.equal(descending.phase, 'handoff');
  assert.ok(descending.leaderHeight < handoff.leaderHeight);
  assert.ok(descending.leaderHeight > arrival.leaderHeight);
  assert.deepEqual(arrival, {
    phase: 'handoff',
    bodyBase: 0.74,
    bodyRange: 0.34,
    leaderHeight: 1.12,
    curl: 0.03,
  });
});

test('height profile remains finite and continuous on short or invalid routes', () => {
  const shortSamples = [0, 0.05, 0.15, 0.2, 0.3].map((distance) => (
    resolveWindHeightProfile({
      distance,
      totalDistance: 0.3,
      handoffDistance: 0.2,
    })
  ));
  for (const profile of shortSamples) {
    assert.ok(
      Object.entries(profile)
        .filter(([key]) => key !== 'phase')
        .every(([, value]) => Number.isFinite(value)),
    );
  }
  assert.ok(shortSamples[2].leaderHeight >= shortSamples[1].leaderHeight);
  assert.ok(shortSamples[3].leaderHeight >= shortSamples[4].leaderHeight);

  const invalid = resolveWindHeightProfile({ distance: NaN, totalDistance: 0 });
  assert.equal(invalid.phase, 'pickup');
  assert.equal(invalid.leaderHeight, 0.26);
});

test('the static accessibility cue keeps a boot-height pickup beneath its chest-height lead', () => {
  const trail = new ObjectiveHintTrail(new Scene(), {
    reducedMotion: true,
    spacing: 0.09,
    maxMarkers: 64,
  }).init();
  trail.show({ points: [[0, 0], [0, 8]] });

  const positions = trail._markers.map((_, index) => particlePosition(trail, index));
  const leader = positions[0];
  const pickup = positions.filter(({ z }) => z <= 0.05);
  const establishedBody = positions.slice(1).filter(({ z }) => z >= 2.1);

  assert.ok(leader.y >= 1.45 && leader.y <= 1.6, 'the sparse leader crests near head height');
  assert.ok(pickup.length >= 2, 'the static cue must visibly originate at the player');
  assert.ok(
    pickup.every(({ y }) => y >= 0.09 && y <= 0.32),
    'the origin pickup stays around the player boots',
  );
  assert.ok(establishedBody.length >= 4);
  assert.ok(
    establishedBody.every(({ y }) => y >= 0.98 && y <= 1.38),
    'the established stream sits around waist and chest height',
  );
  trail.dispose();
});

test('the gust decays roughly eighty-five percent of its body before arrival', () => {
  const trail = new ObjectiveHintTrail(new Scene(), {
    spacing: 0.09,
    maxMarkers: 64,
  }).init();
  trail.show({ points: [[0, 0], [0, 12]] });
  trail.update(1.2);

  const bodyOpacities = trail._markers.slice(1).map((_, index) => (
    trail.geometry.attributes.aOpacity.getX(index + 1)
  ));
  const disappeared = bodyOpacities.filter((opacity) => opacity <= 1e-6).length;

  assert.ok(
    disappeared / bodyOpacities.length >= 0.8,
    'most body particles should already be gone around ninety-percent route progress',
  );
  assert.ok(
    disappeared / bodyOpacities.length <= 0.9,
    'a restrained final breath should survive instead of vanishing all at once',
  );
  assert.ok(trail.geometry.attributes.aOpacity.getX(0) > 0.9, 'the gold lead remains legible');
  trail.dispose();
});

test('gust timing presents one monotonic gold front with an ivory body and sage wake', () => {
  const atStart = resolveWindGustFrame({
    totalDistance: 24,
    elapsed: 0,
    duration: 4,
    spacing: 0.55,
    maxMarkers: 16,
  });
  const atOneSecond = resolveWindGustFrame({
    totalDistance: 24,
    elapsed: 1,
    duration: 4,
    spacing: 0.55,
    maxMarkers: 16,
  });
  const atFade = resolveWindGustFrame({
    totalDistance: 24,
    elapsed: 4 * 0.78,
    duration: 4,
    spacing: 0.55,
    maxMarkers: 16,
  });

  assert.equal(atStart.filter(({ active }) => active).length, 8);
  assert.equal(atStart[0].role, 'gold');
  assert.equal(atStart[0].distance, 0);
  assert.ok(atOneSecond[0].distance >= 10, 'the first turn must be previewed inside one second');
  assert.ok(atOneSecond[0].distance < 24);
  assert.equal(atFade[0].distance, 24, 'the lead reaches the target before fading');
  assert.equal(atFade.filter(({ role }) => role === 'gold').length, 1);

  const active = atOneSecond.filter(({ active: visible }) => visible);
  assert.ok(active.every((carrier, index) => (
    index === 0 || carrier.distance < active[index - 1].distance
  )), 'every carrier must trail the lead without wrapping backward');
  const firstSage = active.findIndex(({ role }) => role === 'sage');
  assert.ok(firstSage > 0, 'sage belongs in the established wake');
  assert.ok(active.slice(1, firstSage).every(({ role }) => role === 'ivory'));
  assert.ok(active.slice(firstSage).every(({ role }) => role === 'sage'));
});

test('the final point-cloud breath stays hidden until the handoff', () => {
  const options = {
    totalDistance: 8,
    handoffDistance: 5.6,
    duration: 4,
    spacing: 0.09,
    maxMarkers: 96,
  };
  const main = resolveWindGustFrame({ ...options, elapsed: 0.5 });
  const courtesyPause = resolveWindGustFrame({ ...options, elapsed: 0.8 });
  const connector = resolveWindGustFrame({ ...options, elapsed: 1 });
  const settled = resolveWindGustFrame({ ...options, elapsed: 1.5 });

  assert.equal(main[0].phase, 'main');
  assert.ok(main[0].distance < options.handoffDistance);
  assert.equal(courtesyPause[0].phase, 'handoff');
  assert.equal(courtesyPause[0].distance, options.handoffDistance);
  assert.equal(connector[0].phase, 'connector');
  assert.ok(connector[0].distance > options.handoffDistance);
  assert.ok(connector[0].distance < options.totalDistance);
  assert.equal(settled[0].phase, 'settle');
  assert.equal(settled[0].distance, options.totalDistance);
  assert.equal(settled[0].active, false, 'gold releases before the lingering cloud');
});

test('tiny particle budgets still preserve a route lead without negative counts', () => {
  const trail = new ObjectiveHintTrail(new Scene(), {
    maxMarkers: 2,
    spacing: 0.09,
  }).init();
  assert.equal(trail.show({
    points: [[0, 0], [0, 8]],
    getTargetPosition: () => new Vector3(0, 0, 8),
  }), true);
  assert.equal(trail.geometry.drawRange.count, 2);
  assert.equal(trail._markers[0].windRole, 'gold');
  assert.ok(trail._routePoints.length >= 2);
  trail.dispose();
});

test('reduced motion resolves to a static directional point cloud', () => {
  const frame = resolveWindGustFrame({
    totalDistance: 12,
    elapsed: 3,
    duration: 4,
    spacing: 0.55,
    maxMarkers: 30,
    reducedMotion: true,
  });
  assert.equal(frame.length, 24);
  assert.equal(frame[0].role, 'gold');
  assert.ok(frame.slice(1, -4).every(({ role }) => role === 'ivory'));
  assert.ok(frame.slice(-4).every(({ role }) => role === 'sage'));
  assert.ok(frame.every(({ active }) => active));
  assert.ok(frame.every((carrier, index) => (
    index === 0 || carrier.distance < frame[index - 1].distance
  )));
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
    reducedMotion: false,
    spacing: 1,
    targetStopDistance: 2.4,
    retargetSharpness: 4,
  }).init();

  assert.equal(trail.show({
    points: [[0, 0], [0, 8]],
    getTargetPosition: () => liveTarget,
  }), true);
  const fixedBefore = trail._routePoints.map((position) => position.clone());
  const endpointBefore = trail._smoothedTarget.clone();
  assert.ok(Math.abs(trail._handoffDistance - 5.6) <= 1e-9);

  liveTarget.set(2, 0, 8);
  trail.update(0.1);
  const endpointAfter = trail._smoothedTarget.clone();
  assert.deepEqual(
    trail._routePoints.map((position) => position.toArray()),
    fixedBefore.map((position) => position.toArray()),
    'retargeting must not bend or replace the reviewed route body',
  );
  assert.ok(endpointAfter.x > endpointBefore.x, 'connector should begin following the target');
  assert.ok(endpointAfter.x < liveTarget.x, 'connector should ease instead of snapping');
  assert.equal(endpointAfter.z, 8);

  trail.update(1);
  assert.ok(trail._smoothedTarget.x > endpointAfter.x);
  assert.ok(trail._smoothedTarget.x < liveTarget.x);
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
  assert.equal(trail._smoothedTarget, null);
  assert.equal(trail._handoffDistance, null);
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
  assert.equal(trail.geometry.drawRange.count, 0);
  trail.dispose();
});

test('reduced motion holds every point still for the full cue', () => {
  const scene = new Scene();
  const trail = new ObjectiveHintTrail(scene, { reducedMotion: true }).init();
  trail.show({ points: [[0, 0], [2, 1], [4, 0]] });
  const before = Array.from(trail.geometry.attributes.position.array);

  assert.equal(trail.update(2), true);
  const after = Array.from(trail.geometry.attributes.position.array);
  assert.deepEqual(after, before);
  assert.equal(trail.active, true);
  assert.equal(trail.update(2), false);
  trail.dispose();
});

test('normal motion advects the spatial point cloud and fades the gust before expiry', () => {
  const trail = new ObjectiveHintTrail(new Scene()).init();
  trail.show({ points: [[0, 0], [0, 6]] });
  const before = Array.from(trail.geometry.attributes.position.array);
  trail.update(3.5);
  const after = Array.from(trail.geometry.attributes.position.array);
  assert.notDeepEqual(after, before);
  assert.ok(trail.material.opacity > 0 && trail.material.opacity < 0.78);
  assert.equal(trail.geometry.drawRange.count <= trail.maxMarkers, true);
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
