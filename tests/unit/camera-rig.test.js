import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BoxGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from 'three';
import { CameraRig } from '../../src/game/camera/CameraRig.js';
import { createGroundDressing } from '../../src/visuals/CozyTownKit.js';

function createRig() {
  const camera = new PerspectiveCamera();
  const rig = new CameraRig(camera);

  rig.collisionEnabled = false;
  rig.setTarget(new Vector3(0, 0, 0));

  return { camera, rig };
}

function minimumCameraHeight(rig) {
  return rig.floorHeight + rig.floorClearance;
}

test('positive pitch places the camera above its pivot', () => {
  const { camera, rig } = createRig();

  rig.floorConstraintEnabled = false;
  rig.pitch = 0.5;
  rig.resetPosition();
  rig.update(0);

  const pivotY = rig.target.y + rig.pivotHeight;
  assert.ok(
    camera.position.y > pivotY,
    `expected positive pitch to elevate camera above ${pivotY}, got ${camera.position.y}`,
  );
});

test('resetPosition clamps a downward extreme to the configured floor clearance', () => {
  const { camera, rig } = createRig();

  rig.floorConstraintEnabled = true;
  rig.floorHeight = 2.25;
  rig.floorClearance = 0.4;
  rig.pitch = -Math.PI / 2;
  rig.resetPosition();

  const minimumY = minimumCameraHeight(rig);
  assert.ok(
    camera.position.y >= minimumY,
    `expected reset height >= ${minimumY}, got ${camera.position.y}`,
  );
});

test('position smoothing cannot move the camera through the floor', () => {
  const { camera, rig } = createRig();

  rig.floorConstraintEnabled = true;
  rig.floorHeight = 0.75;
  rig.floorClearance = 0.3;
  rig.pitch = -Math.PI / 2;

  const minimumY = minimumCameraHeight(rig);
  rig._smoothedPosition.set(0, minimumY + 0.01, 0);

  for (let frame = 0; frame < 180; frame += 1) {
    rig.update(1 / 60);
    assert.ok(
      camera.position.y >= minimumY,
      `camera crossed floor on frame ${frame}: ${camera.position.y} < ${minimumY}`,
    );
  }
});

test('floor constraint can be disabled for scenes that do not need it', () => {
  const { camera, rig } = createRig();

  rig.floorConstraintEnabled = false;
  rig.floorHeight = 4;
  rig.floorClearance = 1;
  rig.pitch = -Math.PI / 2;
  rig.resetPosition();

  assert.ok(
    camera.position.y < minimumCameraHeight(rig),
    'disabled floor constraint should not clamp the reset position',
  );
});

test('a close wall can pull the lens inside normal framing distance without clipping', () => {
  const { camera, rig } = createRig();
  const scene = new Scene();
  const wall = new Mesh(
    new BoxGeometry(4, 4, 0.2),
    new MeshBasicMaterial(),
  );
  wall.position.set(0, rig.pivotHeight, -0.5);
  wall.updateMatrixWorld(true);
  scene.add(wall);

  rig.collisionEnabled = true;
  rig.distance = 6.6;
  rig.minDistance = 1.45;
  rig.collisionMinDistance = 0.12;
  rig.collisionOffset = 0.2;
  rig.shoulderOffset = 0.28;
  rig.yaw = 0;
  rig.pitch = 0;
  rig.setCollisionObjects([wall]);
  rig.resetPosition();
  rig.update(1 / 60, scene);

  const wallFront = wall.position.z + 0.1;
  assert.ok(
    camera.position.z > wallFront,
    `camera crossed close wall at ${wallFront}, got z=${camera.position.z}`,
  );
  assert.ok(
    rig._currentDistance < rig.minDistance,
    'collision must be allowed to override the normal framing minimum',
  );
  assert.ok(
    Math.abs(camera.position.x) < rig.shoulderOffset,
    'shoulder offset should contract with the collision distance',
  );
  assert.equal(rig.shouldHideTarget(), true);
  const viewDirection = new Vector3();
  camera.getWorldDirection(viewDirection);
  assert.ok(
    viewDirection.z > 0.98 && Math.abs(viewDirection.y) < 0.1,
    `compressed camera should preserve its orbit view, got ${viewDirection.toArray()}`,
  );
});

test('the main meadow blocks the camera while terrain details remain decorative', () => {
  const terrain = createGroundDressing();
  const surface = terrain.getObjectByName('cozy_terrain_surface');
  const patch = terrain.getObjectByName('cozy_terrain_patch');
  const hill = terrain.getObjectByName('cozy_terrain_hill');
  const tufts = terrain.getObjectByName('particle_grass_tufts');

  assert.notEqual(terrain.userData.cameraCollision, false);
  assert.equal(surface?.userData.cameraCollision, true);
  assert.equal(patch?.userData.cameraCollision, false);
  assert.equal(hill?.userData.cameraCollision, false);
  assert.equal(tufts?.userData.cameraCollision, false);
});
