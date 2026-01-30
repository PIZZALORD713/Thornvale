/**
 * VisualRig - Visual representation that follows physics body
 * 
 * Responsibilities:
 * - Group containing visual mesh
 * - Smooth follow of physics position
 * - Smooth facing rotation toward velocity
 * - Can swap between different visual meshes (for character possession)
 */

import * as THREE from 'three';
import { dampAngle } from '../utils/math.js';

export class VisualRig {
  constructor() {
    // Container group
    this.group = new THREE.Group();
    this.group.name = 'VisualRig';
    
    // Current visual mesh/model
    this.visual = null;
    
    // Facing angle (yaw)
    this.facingYaw = 0;
    
    // Smoothing
    this.rotationSharpness = 12.0;
    
    // State
    this.isMoving = false;
  }

  /**
   * Set the visual mesh/model
   * @param {THREE.Object3D} visual - The visual to display
   */
  setVisual(visual) {
    // Remove old visual
    if (this.visual) {
      this.group.remove(this.visual);
    }
    
    this.visual = visual;
    
    if (visual) {
      this.group.add(visual);
      visual.position.set(0, 0, 0);
      visual.rotation.set(0, 0, 0);
    }
  }

  /**
   * Update visual position and rotation
   * @param {number} dt - Delta time
   * @param {THREE.Vector3} position - Physics position
   * @param {number|null} targetYaw - Target facing yaw (null = keep current)
   */
  update(dt, position, targetYaw) {
    // Update position (direct follow, no smoothing needed as physics handles it)
    this.group.position.copy(position);
    
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
    if (this.visual) {
      this.group.remove(this.visual);
      this.visual = null;
    }
  }
}
