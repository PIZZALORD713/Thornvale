import assert from 'node:assert/strict';
import test from 'node:test';

import {
  InstancedMesh,
  Matrix4,
  Scene,
  Vector3,
} from 'three';
import { OBB } from 'three/examples/jsm/math/OBB.js';
import { resolveObjectiveHintPath } from '../src/config/objective-hints.js';
import { TOWN_LAYOUT } from '../src/config/town.js';
import {
  OBJECTIVE_HINT_TRAIL_DEFAULTS,
  ObjectiveHintTrail,
} from '../src/visuals/ObjectiveHintTrail.js';
import {
  createReclaimedPaverMesh,
  generateReclaimedPaverPlacements,
} from '../src/visuals/ReclaimedPaverPaths.js';
import { sampleMoundHeight } from '../src/utils/terrain-surface.js';

function matrixPosition(mesh, index) {
  const matrix = new Matrix4();
  mesh.getMatrixAt(index, matrix);
  return new Vector3().setFromMatrixPosition(matrix);
}

function bellPaverObbs() {
  const placements = generateReclaimedPaverPlacements(TOWN_LAYOUT);
  const mesh = createReclaimedPaverMesh(TOWN_LAYOUT);
  mesh.geometry.computeBoundingBox();
  const base = new OBB().fromBox3(mesh.geometry.boundingBox);
  const matrix = new Matrix4();
  const obbs = [];
  for (let index = 0; index < mesh.count; index += 1) {
    if (placements[index].routeId !== 'bell-hill-ritual') continue;
    mesh.getMatrixAt(index, matrix);
    obbs.push(base.clone().applyMatrix4(matrix));
  }
  return { mesh, obbs };
}

function assertTrailClearsPavers(trail, pavers, label) {
  trail.geometry.computeBoundingBox();
  const base = new OBB().fromBox3(trail.geometry.boundingBox);
  const matrix = new Matrix4();
  for (let index = 0; index < trail.mesh.count; index += 1) {
    trail.mesh.getMatrixAt(index, matrix);
    const marker = base.clone().applyMatrix4(matrix);
    assert.equal(
      pavers.some((paver) => marker.intersectsOBB(paver)),
      false,
      `${label} marker ${index} intersects a tilted Bell paver`,
    );
  }
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
  assert.ok(
    OBJECTIVE_HINT_TRAIL_DEFAULTS.groundOffset >= 0.12,
    'the ribbon must clear the authored reclaimed-paver surface',
  );
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
  const flatMatrix = new Matrix4();
  trail.mesh.getMatrixAt(2, flatMatrix);
  assert.ok(
    new Vector3().setFromMatrixColumn(flatMatrix, 1)
      .distanceTo(new Vector3(0, 1, 0)) <= 1e-6,
  );
  assert.ok(
    new Vector3().setFromMatrixColumn(flatMatrix, 2)
      .distanceTo(new Vector3(0, 0, 1)) <= 1e-6,
  );

  points[1].z = 400;
  trail.update(0.5);
  assert.equal(matrixPosition(trail.mesh, 4).z, 4, 'caller mutation cannot move active markers');
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

test('Bell-slope markers clear tilted pavers in reduced mode and every animated trough', () => {
  const bellRoute = TOWN_LAYOUT.paths.find(({ id }) => id === 'bell-hill-ritual');
  const points = resolveObjectiveHintPath({
    objective: 'ring-bell-at-dusk',
    start: bellRoute.points[0],
    target: TOWN_LAYOUT.landmarks.bell,
    maxDistance: Infinity,
  });
  const { mesh: paverMesh, obbs: pavers } = bellPaverObbs();
  assert.ok(points);
  assert.ok(pavers.length > 0);

  const reduced = new ObjectiveHintTrail(new Scene(), {
    reducedMotion: true,
    spacing: 0.5,
    maxMarkers: 64,
  }).init();
  reduced.show({ points });
  const slopedIndex = reduced._markers.findIndex(({ normal }) => normal.y < 0.999);
  assert.ok(slopedIndex >= 0, 'the Bell route must exercise a non-flat surface normal');
  const slopedMarker = reduced._markers[slopedIndex];
  assert.ok(
    Math.abs(slopedMarker.position.y - Math.max(
      0,
      sampleMoundHeight(
        TOWN_LAYOUT.terrain.bellHill,
        slopedMarker.position.x,
        slopedMarker.position.z,
      ),
    )) <= 1e-6,
    'the marker is projected onto the sampled Bell surface',
  );
  const slopedMatrix = new Matrix4();
  reduced.mesh.getMatrixAt(slopedIndex, slopedMatrix);
  const slopedCenter = new Vector3().setFromMatrixPosition(slopedMatrix);
  const expectedCenter = slopedMarker.position.clone().addScaledVector(
    slopedMarker.normal,
    reduced.groundOffset,
  );
  assert.ok(slopedCenter.distanceTo(expectedCenter) <= 1e-6);
  assert.ok(
    new Vector3().setFromMatrixColumn(slopedMatrix, 1).normalize()
      .distanceTo(slopedMarker.normal) <= 1e-6,
    'the marker local up-axis follows the sampled Bell surface normal',
  );
  assertTrailClearsPavers(reduced, pavers, 'reduced');

  const animated = new ObjectiveHintTrail(new Scene(), {
    spacing: 0.5,
    maxMarkers: 64,
  }).init();
  animated.show({ points });
  for (let index = 0; index < animated.mesh.count; index += 1) {
    let troughPhase = Math.PI * 1.5 - index * 0.68;
    while (troughPhase < 0) troughPhase += Math.PI * 2;
    animated.elapsed = troughPhase / 2.2;
    animated._writeMatrices();
    animated.geometry.computeBoundingBox();
    const base = new OBB().fromBox3(animated.geometry.boundingBox);
    const matrix = new Matrix4();
    animated.mesh.getMatrixAt(index, matrix);
    const marker = base.applyMatrix4(matrix);
    assert.equal(
      pavers.some((paver) => marker.intersectsOBB(paver)),
      false,
      `animated trough marker ${index} intersects a tilted Bell paver`,
    );
  }

  reduced.dispose();
  animated.dispose();
  paverMesh.geometry.dispose();
  paverMesh.material.dispose();
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
