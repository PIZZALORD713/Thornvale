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
      visual.position.set(0, 0, 0);
      visual.rotation.set(0, 0, 0);
      this.calibratedOffsetY = 0;

      if (options.visualOffsetY !== undefined) {
        this.visualOffsetY = options.visualOffsetY;
      }

      if (options.autoAlign && options.capsuleHalfHeight !== undefined && options.capsuleRadius !== undefined) {
        const calibration = () => {
          if (this.visual !== visual || this.calibrationRevision !== calibrationRevision) return;
          this.calibrateVisualOffset(
            options.capsuleHalfHeight,
            options.capsuleRadius,
            options.clearance ?? 0.015,
          );
        };

        let hasSkinnedMesh = false;
        visual.traverse((object) => {
          if (object.isSkinnedMesh) hasSkinnedMesh = true;
        });

        if (hasSkinnedMesh && typeof globalThis.requestAnimationFrame === 'function') {
          // Bone/world matrices settle during the first rendered frame after an
          // async fRiENDSiES swap. Measuring before that frame sees the bind-pose
          // root and can bury the model. Recheck on two frames; the second pass
          // also covers attachments retargeted to the body skeleton.
          globalThis.requestAnimationFrame(() => {
            calibration();
            globalThis.requestAnimationFrame(calibration);
          });
        } else {
          calibration();
        }
      }
    }
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
      position.y + this.calibratedOffsetY + this.visualOffsetY,
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
  }
}
