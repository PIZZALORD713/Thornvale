import test from 'node:test';
import assert from 'node:assert/strict';

import { Color, Group, InstancedMesh } from 'three';

import { TOWN_LAYOUT } from '../src/config/town.js';
import {
  createDragonflyBodyGeometry,
  createDragonflySpecs,
  createDragonflyWingGeometry,
  dragonflyNightFade,
  DRAGONFLY_QUALITY_COUNTS,
  DragonflyField,
  normalizeDragonflyQuality,
  projectDragonflyPose,
  selectDragonflySpecs,
} from '../src/visuals/DragonflyField.js';
import { createAmbientLife } from '../src/visuals/CozyTownKit.js';
import { WorldAnimator } from '../src/visuals/WorldAnimator.js';

const BODY_COLORS = [0x315b4a, 0x55766a];
const WING_COLOR = 0xd4e2da;
const WING_OPACITY = 0.41;

function round(value, digits = 9) {
  return Number(value.toFixed(digits));
}

function matrixSnapshot(mesh) {
  return [...mesh.instanceMatrix.array].map((value) => round(value));
}

function observedGeometryColors(geometry) {
  const attribute = geometry.getAttribute('color');
  const color = new Color();
  const observed = new Set();
  for (let index = 0; index < attribute.count; index += 1) {
    color.setRGB(attribute.getX(index), attribute.getY(index), attribute.getZ(index));
    observed.add(color.getHex());
  }
  return [...observed].sort((left, right) => left - right);
}

function angleDelta(left, right) {
  return Math.atan2(Math.sin(left - right), Math.cos(left - right));
}

test('quality selection keeps the authored pond and garden cast bounded', () => {
  assert.deepEqual(DRAGONFLY_QUALITY_COUNTS, { low: 2, medium: 3, high: 3 });
  assert.equal(normalizeDragonflyQuality('low'), 'low');
  assert.equal(normalizeDragonflyQuality('medium'), 'medium');
  assert.equal(normalizeDragonflyQuality('high'), 'high');
  assert.equal(normalizeDragonflyQuality('unknown'), 'high');

  const specs = createDragonflySpecs(TOWN_LAYOUT);
  assert.equal(specs.length, 3);
  assert.deepEqual(specs.map((spec) => spec.id), [
    'pond-east-dragonfly',
    'pond-west-dragonfly',
    'garden-arch-dragonfly',
  ]);
  assert.deepEqual(specs.map((spec) => spec.anchor), [
    [TOWN_LAYOUT.pond.x + 2.45, 0.85, TOWN_LAYOUT.pond.z - 1.05],
    [TOWN_LAYOUT.pond.x - 1.35, 0.72, TOWN_LAYOUT.pond.z + 0.85],
    [
      TOWN_LAYOUT.authoredProps.gardenArch.x + 0.75,
      1,
      TOWN_LAYOUT.authoredProps.gardenArch.z + 0.55,
    ],
  ]);
  assert.deepEqual(
    selectDragonflySpecs(specs, 'low').map((spec) => spec.id),
    ['pond-east-dragonfly', 'garden-arch-dragonfly'],
    'low quality should retain both pond and garden reads',
  );
  assert.equal(selectDragonflySpecs(specs, 'medium').length, 3);
  assert.equal(selectDragonflySpecs(specs, 'high').length, 3);

  for (const spec of specs) {
    assert.equal(spec.stations.length, 3);
    assert.equal(spec.holdDurations.length, 3);
    assert.equal(spec.dartDurations.length, 3);
    assert.ok(spec.cycleDuration >= 9 && spec.cycleDuration <= 13);
    assert.ok(spec.holdDurations.every((duration) => duration >= 3 && duration <= 4));
    assert.ok(spec.dartDurations.every((duration) => duration >= 0.35 && duration <= 0.48));
    for (const station of spec.stations) {
      const radius = Math.hypot(
        station[0] - spec.anchor[0],
        station[2] - spec.anchor[2],
      );
      assert.ok(radius >= 0.65 && radius <= 0.9, `${spec.id} station radius ${radius}`);
    }
  }
});

test('the body is a compact faceted needle and four wings are authored kites', () => {
  const body = createDragonflyBodyGeometry();
  const wings = createDragonflyWingGeometry();
  const bodyPosition = body.getAttribute('position');
  const bodyColor = body.getAttribute('color');
  const wingPosition = wings.getAttribute('position');
  const wingId = wings.getAttribute('wingId');

  body.computeBoundingBox();
  wings.computeBoundingBox();
  const bodyLength = body.boundingBox.max.z - body.boundingBox.min.z;
  assert.ok(bodyLength >= 0.36 && bodyLength <= 0.40, `body length ${bodyLength}`);
  assert.ok(body.boundingBox.max.x - body.boundingBox.min.x < 0.12);
  assert.equal(bodyColor.count, bodyPosition.count);
  assert.deepEqual(observedGeometryColors(body), BODY_COLORS);

  assert.equal(wingPosition.count, 24, 'four two-triangle kites should use 24 vertices');
  assert.equal(wingId.count, wingPosition.count);
  assert.equal(wings.userData.wingShape, 'four-kite');
  assert.equal(wings.userData.wingCount, 4);

  const verticesByWing = new Map();
  for (let index = 0; index < wingPosition.count; index += 1) {
    const id = wingId.getX(index);
    const vertices = verticesByWing.get(id) || new Map();
    const position = [
      round(wingPosition.getX(index), 6),
      round(wingPosition.getY(index), 6),
      round(wingPosition.getZ(index), 6),
    ];
    vertices.set(position.join(','), position);
    verticesByWing.set(id, vertices);
  }
  assert.deepEqual([...verticesByWing.keys()].sort(), [0, 1, 2, 3]);
  for (const [id, vertices] of verticesByWing) {
    assert.equal(vertices.size, 4, `wing ${id} should be one four-point kite`);
    const points = [...vertices.values()];
    assert.ok(new Set(points.map((point) => point[0])).size > 2, `wing ${id} became rectangular`);
    assert.ok(new Set(points.map((point) => point[2])).size > 2, `wing ${id} became rectangular`);
  }

  const foreVertices = [...verticesByWing.get(0).values(), ...verticesByWing.get(1).values()];
  const hindVertices = [...verticesByWing.get(2).values(), ...verticesByWing.get(3).values()];
  const span = (vertices) => Math.max(...vertices.map((point) => point[0]))
    - Math.min(...vertices.map((point) => point[0]));
  assert.ok(Math.abs(span(foreVertices) - 0.46) < 1e-6);
  assert.ok(Math.abs(span(hindVertices) - 0.38) < 1e-6);

  body.dispose();
  wings.dispose();
});

test('absolute-time poses are deterministic and stay inside the stop-inspect-dart envelope', () => {
  const specs = createDragonflySpecs(TOWN_LAYOUT);
  for (const spec of specs) {
    for (let time = 0; time <= spec.cycleDuration; time += 0.025) {
      const first = projectDragonflyPose(spec, time);
      const second = projectDragonflyPose(spec, time);
      assert.deepEqual(first, second);
      assert.ok([
        ...first.position,
        ...first.velocity,
        first.yaw,
        first.pitch,
        first.roll,
      ].every(Number.isFinite));

      const radius = Math.hypot(
        first.position[0] - spec.anchor[0],
        first.position[2] - spec.anchor[2],
      );
      assert.ok(radius <= 0.925, `${spec.id} escaped its horizontal envelope at ${time}`);
      assert.ok(Math.abs(first.pitch) <= (8 * Math.PI) / 180 + 1e-9);
      assert.ok(Math.abs(first.roll) <= (6 * Math.PI) / 180 + 1e-9);

      if (first.segment === 'hold') {
        const station = spec.stations[first.stationIndex];
        assert.ok(
          Math.hypot(
            first.position[0] - station[0],
            first.position[1] - station[1],
            first.position[2] - station[2],
          ) <= 0.025 + 1e-9,
          `${spec.id} hover drift exceeded 0.025m`,
        );
      } else {
        const horizontalSpeed = Math.hypot(first.velocity[0], first.velocity[2]);
        if (horizontalSpeed > 1e-7) {
          const velocityYaw = Math.atan2(first.velocity[0], first.velocity[2]);
          assert.ok(Math.abs(angleDelta(first.yaw, velocityYaw)) < 1e-9);
        }
      }
    }
  }

  const sixHours = 6 * 60 * 60;
  for (const spec of specs) {
    const pose = projectDragonflyPose(spec, sixHours);
    assert.ok(Object.values(pose).flat().filter((value) => typeof value === 'number')
      .every(Number.isFinite));
  }
});

test('the field stays at exactly two instanced draws with the directed materials', () => {
  const animator = new WorldAnimator();
  const field = new DragonflyField({ animator, quality: 'medium' });
  const draws = [];
  field.root.traverse((object) => {
    if (object.isInstancedMesh) draws.push(object);
  });

  assert.equal(field.root.name, 'particle_butterflies');
  assert.equal(field.root.userData.system, 'pond-garden-dragonflies-v1');
  assert.equal(field.root.userData.decorative, true);
  assert.equal(field.root.userData.cameraCollision, false);
  assert.equal(field.root.userData.physicsCollision, false);
  assert.equal(field.count, 3);
  assert.equal(field.drawCallCount, 2);
  assert.equal(animator.animations.length, 1);
  assert.equal(draws.length, 2);
  assert.ok(draws.every((mesh) => mesh instanceof InstancedMesh));
  assert.deepEqual(draws.map((mesh) => mesh.name).sort(), [
    'particle_dragonfly_bodies',
    'particle_dragonfly_wings',
  ]);
  assert.ok(draws.every((mesh) => mesh.count === 3));
  assert.ok(draws.every((mesh) => mesh.castShadow === false && mesh.receiveShadow === false));

  assert.equal(field.bodyMaterial.opacity, 1);
  assert.equal(field.bodyMaterial.transparent, false);
  assert.equal(field.bodyMaterial.color.getHex(), 0xffffff);
  assert.equal(field.bodyMaterial.vertexColors, true);
  assert.equal('emissive' in field.bodyMaterial, false);
  assert.equal(field.wingMaterial.color.getHex(), WING_COLOR);
  assert.equal(field.wingMaterial.transparent, true);
  assert.equal(field.wingMaterial.forceSinglePass, true);
  assert.equal(field.wingMaterial.opacity, WING_OPACITY);
  assert.ok(field.wingMaterial.opacity >= 0.38 && field.wingMaterial.opacity <= 0.44);
  assert.equal('emissive' in field.wingMaterial, false);
  assert.ok([...field.bodyMesh.instanceMatrix.array].every(Number.isFinite));
  assert.ok([...field.wingMesh.instanceMatrix.array].every(Number.isFinite));

  field.dispose();
});

test('pose updates depend on absolute time rather than update history', () => {
  const first = new DragonflyField({ quality: 'high' });
  const second = new DragonflyField({ quality: 'high' });
  first.update(12.345, { nightMix: 0 });
  for (const time of [0.1, 0.9, 3.7, 8.2, 12.345]) second.update(time, { nightMix: 0 });

  assert.deepEqual(matrixSnapshot(first.bodyMesh), matrixSnapshot(second.bodyMesh));
  assert.deepEqual(matrixSnapshot(first.wingMesh), matrixSnapshot(second.wingMesh));
  first.dispose();
  second.dispose();
});

test('night fade is full through 0.3 and gone by 0.65', () => {
  assert.equal(dragonflyNightFade(0), 1);
  assert.equal(dragonflyNightFade(0.3), 1);
  assert.ok(Math.abs(dragonflyNightFade(0.475) - 0.5) < 1e-12);
  assert.equal(dragonflyNightFade(0.65), 0);
  assert.equal(dragonflyNightFade(1), 0);

  const field = new DragonflyField();
  field.update(0, { nightMix: 0.475 });
  assert.ok(Math.abs(field.bodyMaterial.opacity - 0.5) < 1e-12);
  assert.equal(field.bodyMaterial.transparent, true);
  assert.ok(Math.abs(field.wingMaterial.opacity - WING_OPACITY * 0.5) < 1e-12);
  assert.equal(field.root.visible, true);
  field.update(0, { nightMix: 0.65 });
  assert.equal(field.bodyMaterial.opacity, 0);
  assert.equal(field.wingMaterial.opacity, 0);
  assert.equal(field.root.visible, false);
  field.dispose();
});

test('reduced motion freezes both instance buffers while retaining fade updates', () => {
  const animator = new WorldAnimator();
  const field = new DragonflyField({ animator, reducedMotion: true, quality: 'high' });
  const bodyVersion = field.bodyMesh.instanceMatrix.version;
  const wingVersion = field.wingMesh.instanceMatrix.version;
  const bodyMatrices = matrixSnapshot(field.bodyMesh);
  const wingMatrices = matrixSnapshot(field.wingMesh);

  assert.equal(animator.animations.length, 1);
  field.update(30, { nightMix: 0.5 });
  assert.ok(field.bodyMaterial.opacity < 1);
  animator.update(0.1, true);
  assert.equal(field.bodyMesh.instanceMatrix.version, bodyVersion);
  assert.equal(field.wingMesh.instanceMatrix.version, wingVersion);
  assert.deepEqual(matrixSnapshot(field.bodyMesh), bodyMatrices);
  assert.deepEqual(matrixSnapshot(field.wingMesh), wingMatrices);
  field.dispose();
  assert.equal(animator.animations.length, 0);
});

test('ambient-life disposal delegates dragonfly resources idempotently', () => {
  const animator = new WorldAnimator();
  const ambientLife = createAmbientLife(animator, TOWN_LAYOUT, {
    quality: 'low',
    reducedMotion: true,
  });
  const field = ambientLife.dragonflies;
  const parent = new Group();
  parent.add(ambientLife.root);
  const callbacksBeforeDispose = animator.animations.length;
  let geometryDisposals = 0;
  let materialDisposals = 0;
  for (const geometry of [field.bodyGeometry, field.wingGeometry]) {
    geometry.dispose = () => { geometryDisposals += 1; };
  }
  for (const material of [field.bodyMaterial, field.wingMaterial]) {
    material.dispose = () => { materialDisposals += 1; };
  }

  assert.equal(field.count, 2);
  assert.equal(ambientLife.root.getObjectByName('particle_butterflies'), field.root);
  ambientLife.dispose();
  ambientLife.dispose();
  assert.ok(callbacksBeforeDispose > 1);
  assert.equal(animator.animations.length, 0);
  assert.equal(ambientLife.root.parent, null);
  assert.equal(field.root.parent, null);
  assert.equal(geometryDisposals, 2);
  assert.equal(materialDisposals, 2);
});
