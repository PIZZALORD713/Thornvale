/**
 * CameraRig - Third-person shoulder camera with collision
 *
 * Responsibilities:
 * - Orbit around target (yaw/pitch)
 * - Shoulder offset for over-the-shoulder view
 * - Smooth follow
 * - Collision raycast to prevent clipping
 */

import { Vector3, Raycaster } from 'three';
import { clamp, damp } from '../utils/math.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;

    // Target to follow
    this.target = new Vector3();

    // Orbit angles
    this.yaw = 0;    // Horizontal rotation (radians)
    this.pitch = 0.3; // Vertical angle (radians)

    // Camera settings
    this.distance = 5.0;
    this.minDistance = 1.0;
    this.maxDistance = 15.0;

    this.pivotHeight = 1.5;      // Height above target
    this.shoulderOffset = 0.5;   // Horizontal offset (right = positive)
    this.lookAtHeight = 1.2;     // Height of look target

    // Pitch limits
    this.minPitch = -0.5;
    this.maxPitch = 1.2;

    // Smoothing
    this.positionSharpness = 12.0;
    this.rotationSharpness = 15.0;

    // Collision
    this.collisionEnabled = true;
    this.collisionOffset = 0.2; // Pull camera forward by this amount when colliding

    // Internal state
    this._currentDistance = this.distance;
    this._smoothedPosition = new Vector3();
    this._raycaster = new Raycaster();

    // Collision layers (set this to your collision objects)
    this._collisionObjects = [];

    // Pre-allocated temp vectors to avoid per-frame GC pressure
    this._tmpPivot = new Vector3();
    this._tmpForward = new Vector3();
    this._tmpUp = new Vector3();
    this._tmpRight = new Vector3();
    this._tmpDesiredPos = new Vector3();
    this._tmpTargetPos = new Vector3();
    this._tmpLookTarget = new Vector3();
    this._tmpDirection = new Vector3();
  }

  /**
   * Set the target position to follow
   * @param {Vector3} position
   */
  setTarget(position) {
    this.target.copy(position);
  }

  /**
   * Apply mouse input to orbit
   * @param {number} deltaX - Yaw change
   * @param {number} deltaY - Pitch change
   */
  applyInput(deltaX, deltaY) {
    this.yaw -= deltaX;
    this.pitch += deltaY;
    this.pitch = clamp(this.pitch, this.minPitch, this.maxPitch);
  }

  /**
   * Update camera position and orientation
   * @param {number} dt - Delta time
   * @param {THREE.Scene} scene - Scene for collision raycast (optional)
   */
  update(dt, scene = null) {
    // Calculate pivot point (above target)
    const pivot = this._tmpPivot.set(
      this.target.x,
      this.target.y + this.pivotHeight,
      this.target.z
    );

    // Calculate camera direction from yaw/pitch
    const forward = this._tmpForward.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();

    // Calculate right vector for shoulder offset
    const up = this._tmpUp.set(0, 1, 0);
    const right = this._tmpRight.crossVectors(up, forward).normalize();

    // Desired camera position
    let desiredDistance = this.distance;

    const desiredPos = this._tmpDesiredPos.copy(pivot);
    desiredPos.addScaledVector(forward, -desiredDistance);
    desiredPos.addScaledVector(right, this.shoulderOffset);

    // Collision check
    if (this.collisionEnabled && scene) {
      desiredDistance = this._checkCollision(pivot, desiredPos, scene);
    }

    // Smooth distance
    this._currentDistance = damp(this._currentDistance, desiredDistance, this.positionSharpness, dt);

    // Recalculate position with smoothed distance
    const targetPos = this._tmpTargetPos.copy(pivot);
    targetPos.addScaledVector(forward, -this._currentDistance);
    targetPos.addScaledVector(right, this.shoulderOffset);

    // Smooth camera movement
    this._smoothedPosition.x = damp(this._smoothedPosition.x, targetPos.x, this.positionSharpness, dt);
    this._smoothedPosition.y = damp(this._smoothedPosition.y, targetPos.y, this.positionSharpness, dt);
    this._smoothedPosition.z = damp(this._smoothedPosition.z, targetPos.z, this.positionSharpness, dt);

    this.camera.position.copy(this._smoothedPosition);

    // Look at target (offset by lookAtHeight)
    const lookTarget = this._tmpLookTarget.set(
      this.target.x,
      this.target.y + this.lookAtHeight,
      this.target.z
    );
    this.camera.lookAt(lookTarget);
  }

  /**
   * Check collision between pivot and desired camera position
   * @returns {number} - Safe distance
   */
  _checkCollision(pivot, desiredPos, scene) {
    // Cast ray from pivot toward camera
    const direction = this._tmpDirection.subVectors(desiredPos, pivot).normalize();
    const maxDistance = pivot.distanceTo(desiredPos);

    this._raycaster.set(pivot, direction);
    this._raycaster.far = maxDistance;

    // Use cached collision objects (set via setCollisionObjects)
    const collisionTargets = this._collisionObjects.length > 0
      ? this._collisionObjects
      : this._getCollisionMeshes(scene);

    const intersects = this._raycaster.intersectObjects(collisionTargets, false);

    if (intersects.length > 0) {
      // Found collision - pull camera forward
      const hitDistance = intersects[0].distance - this.collisionOffset;
      return Math.max(this.minDistance, hitDistance);
    }

    return this.distance;
  }

  /**
   * Get meshes that should block camera (exclude debug, particles, etc.)
   * Fallback when collision objects haven't been explicitly cached.
   */
  _getCollisionMeshes(scene) {
    const meshes = [];
    scene.traverse((obj) => {
      if (obj.isMesh &&
          obj.visible &&
          !obj.name.includes('debug') &&
          !obj.name.includes('particle') &&
          obj.geometry) {
        meshes.push(obj);
      }
    });
    return meshes;
  }

  /**
   * Set objects for collision (call once after scene setup, and whenever scene geometry changes)
   */
  setCollisionObjects(objects) {
    this._collisionObjects = objects;
  }

  /**
   * Get yaw for character movement
   */
  getYaw() {
    return this.yaw;
  }

  /**
   * Get pitch
   */
  getPitch() {
    return this.pitch;
  }

  /**
   * Reset camera position (teleport)
   */
  resetPosition() {
    const pivot = this._tmpPivot.set(
      this.target.x,
      this.target.y + this.pivotHeight,
      this.target.z
    );

    const forward = this._tmpForward.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );

    this._smoothedPosition.copy(pivot).addScaledVector(forward, -this.distance);
    this._currentDistance = this.distance;
  }
}
