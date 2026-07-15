/**
 * CameraRig - Third-person shoulder camera with collision and stage-floor safety
 *
 * Responsibilities:
 * - Orbit around target (yaw/pitch)
 * - Shoulder offset for over-the-shoulder view
 * - Smooth follow
 * - Collision raycast to prevent clipping
 * - Hard world-floor constraint so the lens never reveals the underside of the stage
 */

import {
  Matrix4,
  Quaternion,
  Raycaster,
  Vector3,
} from 'three';
import { clamp, damp } from '../../utils/math.js';

function smoothstep(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function asVector3(value) {
  if (value?.isVector3) return value.clone();
  if (Array.isArray(value)) return new Vector3().fromArray(value);
  return new Vector3(
    Number(value?.x) || 0,
    Number(value?.y) || 0,
    Number(value?.z) || 0,
  );
}

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
    // Collision may need to move the lens closer than the normal framing
    // minimum when the player is standing directly against a wall.
    this.collisionMinDistance = 0.12;
    this.playerHideDistance = 0.72;

    // Stage-floor safety. Raycasts improve framing near the ground, while this
    // invariant remains authoritative when collision geometry is missing.
    this.floorConstraintEnabled = true;
    this.floorHeight = 0;
    this.floorClearance = 0.35;

    // Internal state
    this._currentDistance = this.distance;
    this._collisionActive = false;
    this._collisionObject = null;
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
    this._focusTargetDelta = new Vector3();
    this._focusMatrix = new Matrix4();
    this._focusShot = null;
    this._focusPromise = null;
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
    if (this._focusShot) return;
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
    if (this._focusShot) {
      this._updateFocusShot(dt);
      return;
    }

    // Calculate pivot point (above target)
    const pivot = this._tmpPivot.set(
      this.target.x,
      this.target.y + this.pivotHeight,
      this.target.z
    );

    // Calculate the viewing direction from the camera toward the pivot. A
    // positive pitch puts the camera above the player, looking downward.
    const forward = this._setOrbitForward();

    // Calculate right vector for shoulder offset
    const up = this._tmpUp.set(0, 1, 0);
    const right = this._tmpRight.crossVectors(up, forward).normalize();

    // Desired camera position
    let desiredDistance = this.distance;

    const desiredPos = this._tmpDesiredPos.copy(pivot);
    desiredPos.addScaledVector(forward, -desiredDistance);
    desiredPos.addScaledVector(right, this.shoulderOffset);

    // Collision check
    this._collisionActive = false;
    this._collisionObject = null;
    if (this.collisionEnabled && scene) {
      desiredDistance = this._checkCollision(pivot, desiredPos, scene);
    }

    // Snap inward so smoothing cannot carry the lens through a newly hit wall;
    // ease back out once the obstruction clears.
    this._currentDistance = this._collisionActive
      ? desiredDistance
      : damp(this._currentDistance, desiredDistance, this.positionSharpness, dt);

    // The collision ray includes the shoulder offset. Scale the shoulder with
    // the shortened orbit so the final camera remains on that tested ray.
    const shoulderScale = this.distance > 0
      ? clamp(this._currentDistance / this.distance, 0, 1)
      : 0;

    // Recalculate position with smoothed distance
    const targetPos = this._tmpTargetPos.copy(pivot);
    targetPos.addScaledVector(forward, -this._currentDistance);
    targetPos.addScaledVector(right, this.shoulderOffset * shoulderScale);
    this._constrainAboveFloor(targetPos);

    // Smooth camera movement
    if (this._collisionActive) {
      this._smoothedPosition.copy(targetPos);
    } else {
      this._smoothedPosition.x = damp(this._smoothedPosition.x, targetPos.x, this.positionSharpness, dt);
      this._smoothedPosition.y = damp(this._smoothedPosition.y, targetPos.y, this.positionSharpness, dt);
      this._smoothedPosition.z = damp(this._smoothedPosition.z, targetPos.z, this.positionSharpness, dt);
    }
    // Damping can otherwise carry an old below-floor position across several
    // frames, so enforce the invariant again after smoothing.
    this._constrainAboveFloor(this._smoothedPosition);

    this.camera.position.copy(this._smoothedPosition);

    // Look at target (offset by lookAtHeight)
    const collisionLookBlend = this._collisionActive ? 1 - shoulderScale : 0;
    const effectiveLookAtHeight = this.lookAtHeight
      + (this.pivotHeight - this.lookAtHeight) * collisionLookBlend;
    const lookTarget = this._tmpLookTarget.set(
      this.target.x,
      this.target.y + effectiveLookAtHeight,
      this.target.z
    );
    this.camera.lookAt(lookTarget);
  }

  /** Temporarily frame an authored subject, then restore the exact player view. */
  playFocusShot({
    position,
    lookAt,
    flyIn = 0.75,
    hold = 1,
    flyOut = 0.75,
    onReveal = null,
  } = {}) {
    if (this._focusShot) return this._focusPromise;
    if (!position || !lookAt) {
      return Promise.reject(new TypeError('CameraRig.playFocusShot requires position and lookAt'));
    }

    const focusPosition = asVector3(position);
    const focusLookAt = asVector3(lookAt);
    const focusQuaternion = new Quaternion().setFromRotationMatrix(
      this._focusMatrix.lookAt(focusPosition, focusLookAt, this.camera.up),
    );
    const shot = {
      elapsed: 0,
      flyIn: Math.max(0, Number(flyIn) || 0),
      hold: Math.max(0, Number(hold) || 0),
      flyOut: Math.max(0, Number(flyOut) || 0),
      startPosition: this.camera.position.clone(),
      startQuaternion: this.camera.quaternion.clone(),
      startTarget: this.target.clone(),
      focusPosition,
      focusQuaternion,
      onReveal: typeof onReveal === 'function' ? onReveal : null,
      revealed: false,
      error: null,
      resolve: null,
      reject: null,
    };
    this._focusShot = shot;
    this._focusPromise = new Promise((resolve, reject) => {
      shot.resolve = resolve;
      shot.reject = reject;
    });
    return this._focusPromise;
  }

  isFocusShotActive() {
    return Boolean(this._focusShot);
  }

  skipFocusShot() {
    if (!this._focusShot) return false;
    this._revealFocusShot(this._focusShot);
    this._finishFocusShot({ skipped: true });
    return true;
  }

  cancelFocusShot() {
    if (!this._focusShot) return false;
    this._finishFocusShot({ cancelled: true });
    return true;
  }

  _updateFocusShot(dt) {
    const shot = this._focusShot;
    if (!shot) return;
    shot.elapsed += Math.max(0, Number(dt) || 0);

    if (shot.flyIn > 0 && shot.elapsed < shot.flyIn) {
      const t = smoothstep(shot.elapsed / shot.flyIn);
      this.camera.position.lerpVectors(shot.startPosition, shot.focusPosition, t);
      this.camera.quaternion.slerpQuaternions(
        shot.startQuaternion,
        shot.focusQuaternion,
        t,
      );
      return;
    }

    this._revealFocusShot(shot);
    const returnElapsed = shot.elapsed - shot.flyIn - shot.hold;
    if (returnElapsed <= 0) {
      this.camera.position.copy(shot.focusPosition);
      this.camera.quaternion.copy(shot.focusQuaternion);
      return;
    }

    if (shot.flyOut > 0 && returnElapsed < shot.flyOut) {
      const t = smoothstep(returnElapsed / shot.flyOut);
      this.camera.position.lerpVectors(shot.focusPosition, shot.startPosition, t);
      this.camera.quaternion.slerpQuaternions(
        shot.focusQuaternion,
        shot.startQuaternion,
        t,
      );
      return;
    }

    this._finishFocusShot();
  }

  _revealFocusShot(shot) {
    if (!shot || shot.revealed) return;
    shot.revealed = true;
    try {
      shot.onReveal?.();
    } catch (error) {
      shot.error = error;
    }
  }

  _finishFocusShot(result = {}) {
    const shot = this._focusShot;
    if (!shot) return;
    // Action lock suppresses intentional travel, but gravity or moving ground
    // may still move the followed target during the shot. Restore the same
    // player-relative framing at the target's current position so normal
    // follow does not lurch on the next frame.
    this._focusTargetDelta.subVectors(this.target, shot.startTarget);
    this.camera.position.copy(shot.startPosition).add(this._focusTargetDelta);
    this._constrainAboveFloor(this.camera.position);
    this.camera.quaternion.copy(shot.startQuaternion);
    this._smoothedPosition.copy(this.camera.position);
    this._focusShot = null;
    this._focusPromise = null;
    if (shot.error) shot.reject?.(shot.error);
    else shot.resolve?.({ ...result, revealed: shot.revealed });
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
      // Scale the entire tested offset (orbit distance plus shoulder) to stop
      // before the surface. The normal minDistance is framing guidance, not a
      // collision constraint: forcing it here can put the lens beyond a wall
      // that is closer than that minimum.
      const safeRayDistance = Math.max(
        this.collisionMinDistance,
        intersects[0].distance - this.collisionOffset,
      );
      const safeFraction = maxDistance > 0
        ? clamp(safeRayDistance / maxDistance, 0, 1)
        : 0;
      this._collisionActive = safeFraction < 0.999999;
      this._collisionObject = intersects[0].object;
      return this.distance * safeFraction;
    }

    this._collisionActive = false;
    this._collisionObject = null;
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

  /** Build the camera-to-pivot viewing direction for the current orbit. */
  _setOrbitForward() {
    return this._tmpForward.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();
  }

  /** Keep a camera position safely above the authored stage floor. */
  _constrainAboveFloor(position) {
    if (!this.floorConstraintEnabled || !Number.isFinite(this.floorHeight)) return position;

    const clearance = Number.isFinite(this.floorClearance)
      ? Math.max(0, this.floorClearance)
      : 0;
    position.y = Math.max(position.y, this.floorHeight + clearance);
    return position;
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

  getCurrentDistance() {
    return this._currentDistance;
  }

  shouldHideTarget() {
    return this._collisionActive && this._currentDistance <= this.playerHideDistance;
  }

  getCollisionObject() {
    return this._collisionObject;
  }

  /**
   * Reset camera position (teleport)
   */
  resetPosition() {
    this.cancelFocusShot();
    const pivot = this._tmpPivot.set(
      this.target.x,
      this.target.y + this.pivotHeight,
      this.target.z
    );

    const forward = this._setOrbitForward();
    const right = this._tmpRight.crossVectors(this._tmpUp.set(0, 1, 0), forward).normalize();

    this._smoothedPosition
      .copy(pivot)
      .addScaledVector(forward, -this.distance)
      .addScaledVector(right, this.shoulderOffset);
    this._constrainAboveFloor(this._smoothedPosition);
    this._currentDistance = this.distance;
    this._collisionActive = false;
    this._collisionObject = null;
    this.camera.position.copy(this._smoothedPosition);

    const lookTarget = this._tmpLookTarget.set(
      this.target.x,
      this.target.y + this.lookAtHeight,
      this.target.z
    );
    this.camera.lookAt(lookTarget);
  }
}
