/**
 * VisualRig - Visual representation that follows physics body
 *
 * Responsibilities:
 * - Group containing visual mesh
 * - Smooth follow of physics position
 * - Smooth facing rotation toward velocity
 * - Can swap between different visual meshes (for character possession)
 */

import { Group, Box3, Matrix4 } from 'three';
import { dampAngle } from '../utils/math.js';

export class VisualRig {
  constructor() {
    // Container group
    this.group = new Group();
    this.group.name = 'VisualRig';

    // Current visual mesh/model
    this.visual = null;

    // Facing angle (yaw)
    this.facingYaw = 0;

    // Smoothing
    this.rotationSharpness = 12.0;

    // State
    this.isMoving = false;

    // Visual offset for aligning meshes to capsule
    this.visualOffsetY = 0;

    // Calibrated offset from model bounds
    this.calibratedOffsetY = 0;
    this.groundingOffsetY = 0;
    this.groundingSampleTimer = 0;
    this.calibrationReady = true;
    this.visualAuthoredVisibility = true;
    this.cameraOccluded = false;

    // Invalidates deferred skinned-mesh calibration after a visual swap.
    this.calibrationRevision = 0;
  }

  /**
   * Set the visual mesh/model
   * @param {THREE.Object3D} visual - The visual to display
   */
  setVisual(visual, options = {}) {
    // Remove old visual
    if (this.visual) {
      this.group.remove(this.visual);
    }

    this.visual = visual;
    const calibrationRevision = ++this.calibrationRevision;

    if (visual) {
      this.group.add(visual);
      this.visualAuthoredVisibility = visual.visible;
      visual.position.set(0, 0, 0);
      visual.rotation.set(0, 0, 0);
      this.calibratedOffsetY = 0;
      this.groundingOffsetY = 0;
      this.groundingSampleTimer = 0;
      this.calibrationReady = true;

      if (options.visualOffsetY !== undefined) {
        this.visualOffsetY = options.visualOffsetY;
      }

      if (options.autoAlign && options.capsuleHalfHeight !== undefined && options.capsuleRadius !== undefined) {
        const calibration = (finalize = true) => {
          if (this.visual !== visual || this.calibrationRevision !== calibrationRevision) return;
          this.calibrateVisualOffset(
            options.capsuleHalfHeight,
            options.capsuleRadius,
            options.clearance ?? 0.015,
          );
          if (finalize) {
            this.calibrationReady = true;
            this._applyVisualVisibility();
          }
        };

        let hasSkinnedMesh = false;
        visual.traverse((object) => {
          if (object.isSkinnedMesh) hasSkinnedMesh = true;
        });

        if (hasSkinnedMesh && typeof globalThis.requestAnimationFrame === 'function') {
          this.calibrationReady = false;
          visual.visible = false;
          // Bone/world matrices settle during the first rendered frame after an
          // async fRiENDSiES swap. Measuring before that frame sees the bind-pose
          // root and can bury the model. Recheck on two frames; the second pass
          // also covers attachments retargeted to the body skeleton.
          globalThis.requestAnimationFrame(() => {
            calibration(false);
            globalThis.requestAnimationFrame(() => calibration(true));
          });
        } else {
          calibration(true);
        }
      }
      this._applyVisualVisibility();
    }
  }

  _applyVisualVisibility() {
    if (!this.visual) return;
    this.visual.visible = Boolean(
      this.calibrationReady
      && this.visualAuthoredVisibility
      && !this.cameraOccluded
    );
  }

  setCameraOccluded(occluded) {
    const next = Boolean(occluded);
    if (next === this.cameraOccluded) return this;
    this.cameraOccluded = next;
    this._applyVisualVisibility();
    return this;
  }

  /**
   * Calibrate visual offset so model feet sit on capsule bottom
   */
  calibrateVisualOffset(capsuleHalfHeight, capsuleRadius, clearance = 0.015) {
    if (!this.visual) return;

    this.visual.position.set(0, 0, 0);
    this.visual.rotation.set(0, 0, 0);
    this.group.updateWorldMatrix(true, true);

    // Use precise deformed-vertex bounds so skinned fRiENDSiES parts are
    // measured exactly as rendered. setFromObject returns world-space bounds;
    // convert that AABB back into VisualRig-local space before comparing it to
    // the capsule. This keeps asynchronous model swaps independent of the
    // settled capsule's current world Y and avoids double-transforming bones.
    const bounds = new Box3().setFromObject(this.visual, true);
    const inverseRigMatrix = new Matrix4().copy(this.group.matrixWorld).invert();
    bounds.applyMatrix4(inverseRigMatrix);

    if (!Number.isFinite(bounds.min.y) || !Number.isFinite(bounds.max.y)) {
      return;
    }

    const targetBottom = -(capsuleHalfHeight + capsuleRadius) + clearance;
    this.calibratedOffsetY = targetBottom - bounds.min.y;
    this.groundingOffsetY = 0;
  }

  /**
   * Periodically correct the current deformed shoe bounds against the ground.
   * This handles clips whose root-height baseline differs from the bind pose
   * without performing a precise skinned-mesh bounds pass every frame.
   */
  stabilizeGrounding(dt, targetBottomY, options = {}) {
    if (!this.visual || !this.calibrationReady || !Number.isFinite(Number(targetBottomY))) return this;

    const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.075);

    const applyCorrection = (measuredBottomY, defaultMaxOffset) => {
      const clearance = Number.isFinite(Number(options.clearance))
        ? Number(options.clearance)
        : 0.018;
      const deadZone = Math.max(0, Number(options.deadZone) || 0.003);
      const maxOffset = Math.max(0.005, Number(options.maxOffset) || defaultMaxOffset);
      const sharpness = Math.max(0, Number(options.sharpness) || 8);
      const maxSpeed = Math.max(0.005, Number(options.maxSpeed) || 0.14);
      const rawError = Number(targetBottomY) + clearance - Number(measuredBottomY);
      const error = Math.abs(rawError) <= deadZone ? 0 : rawError;
      const targetOffset = Math.max(
        -maxOffset,
        Math.min(maxOffset, this.groundingOffsetY + error),
      );
      const dampedStep = (targetOffset - this.groundingOffsetY)
        * (1 - Math.exp(-sharpness * safeDt));
      const maxStep = maxSpeed * safeDt;
      const step = Math.max(-maxStep, Math.min(maxStep, dampedStep));

      this.groundingOffsetY += step;
      this.group.position.y += step;
    };

    const hasMeasuredBottom = options.measuredBottomY != null
      && Number.isFinite(Number(options.measuredBottomY));
    const measuredBottomY = Number(options.measuredBottomY);
    if (hasMeasuredBottom) {
      applyCorrection(measuredBottomY, 0.055);
      return this;
    }

    this.groundingSampleTimer -= safeDt;
    if (this.groundingSampleTimer > 0) return this;
    this.groundingSampleTimer = Math.max(0.05, Number(options.sampleInterval) || 0.1);

    this.group.updateWorldMatrix(true, true);
    const bounds = new Box3().setFromObject(this.visual, true);
    if (!Number.isFinite(bounds.min.y)) return this;

    applyCorrection(bounds.min.y, 0.08);
    return this;
  }

  /**
   * Set visual offset manually
   */
  setVisualOffsetY(offsetY) {
    this.visualOffsetY = offsetY;
  }

  /**
   * Get current visual offset
   */
  getVisualOffsetY() {
    return this.visualOffsetY;
  }

  /**
   * Update visual position and rotation
   * @param {number} dt - Delta time
   * @param {import('three').Vector3} position - Physics position
   * @param {number|null} targetYaw - Target facing yaw (null = keep current)
   */
  update(dt, position, targetYaw) {
    // Update position (direct follow, no smoothing needed as physics handles it)
    this.group.position.set(
      position.x,
      position.y + this.calibratedOffsetY + this.groundingOffsetY + this.visualOffsetY,
      position.z
    );

    // Update facing
    if (targetYaw !== null) {
      this.isMoving = true;
      this.facingYaw = dampAngle(this.facingYaw, targetYaw, this.rotationSharpness, dt);
    } else {
      this.isMoving = false;
    }

    this.group.rotation.y = this.facingYaw;
  }

  /**
   * Immediately set facing direction
   */
  setFacing(yaw) {
    this.facingYaw = yaw;
    this.group.rotation.y = yaw;
  }

  /**
   * Get current position
   */
  getPosition() {
    return this.group.position.clone();
  }

  /**
   * Get facing yaw
   */
  getFacing() {
    return this.facingYaw;
  }

  /**
   * Add to scene
   */
  addToScene(scene) {
    scene.add(this.group);
  }

  /**
   * Remove from scene
   */
  removeFromScene(scene) {
    scene.remove(this.group);
  }

  /**
   * Dispose
   */
  dispose() {
    this.calibrationRevision += 1;
    if (this.visual) {
      this.group.remove(this.visual);
      this.visual = null;
    }
    this.cameraOccluded = false;
    this.visualAuthoredVisibility = true;
  }
}
