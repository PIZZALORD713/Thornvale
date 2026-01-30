/**
 * PlatformCarrier - Tracks platform motion for character riding
 * 
 * Responsibilities:
 * - Detect which platform the character is standing on
 * - Calculate platform velocity from frame-to-frame position changes
 * - Apply platform motion to character before KCC solve
 */

import * as THREE from 'three';

export class PlatformCarrier {
  constructor(physicsWorld) {
    this.physics = physicsWorld;
    
    // Tracked platforms: colliderHandle -> { body, prevPos, prevRot }
    this.platforms = new Map();
    
    // Current platform we're standing on
    this.currentPlatform = null;
    this.platformVelocity = new THREE.Vector3();
    this.platformAngularVelocity = 0;
    
    // Temp vectors
    this._prevPos = new THREE.Vector3();
    this._currPos = new THREE.Vector3();
    this._prevQuat = new THREE.Quaternion();
    this._currQuat = new THREE.Quaternion();
  }

  /**
   * Register a platform for tracking
   * @param {import('@dimforge/rapier3d-compat').Collider} collider
   * @param {import('@dimforge/rapier3d-compat').RigidBody} body
   */
  registerPlatform(collider, body) {
    const handle = collider.handle;
    const pos = body.translation();
    const rot = body.rotation();
    
    this.platforms.set(handle, {
      body,
      collider,
      prevPos: new THREE.Vector3(pos.x, pos.y, pos.z),
      prevRot: new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w),
    });
  }

  /**
   * Update platform velocities (call after physics step)
   * @param {number} dt - Delta time
   */
  update(dt) {
    for (const [handle, platform] of this.platforms) {
      const pos = platform.body.translation();
      const rot = platform.body.rotation();
      
      this._currPos.set(pos.x, pos.y, pos.z);
      this._currQuat.set(rot.x, rot.y, rot.z, rot.w);
      
      // Calculate linear velocity
      platform.linearVelocity = this._currPos.clone().sub(platform.prevPos).divideScalar(dt);
      
      // Calculate angular velocity (Y-axis only for simplicity)
      const prevYaw = this._quatToYaw(platform.prevRot);
      const currYaw = this._quatToYaw(this._currQuat);
      let deltaYaw = currYaw - prevYaw;
      
      // Normalize delta
      while (deltaYaw > Math.PI) deltaYaw -= Math.PI * 2;
      while (deltaYaw < -Math.PI) deltaYaw += Math.PI * 2;
      
      platform.angularVelocityY = deltaYaw / dt;
      
      // Store for next frame
      platform.prevPos.copy(this._currPos);
      platform.prevRot.copy(this._currQuat);
    }
  }

  /**
   * Check if character is on a platform and get velocity
   * @param {import('@dimforge/rapier3d-compat').Collider} groundCollider - Collider we're standing on
   * @param {THREE.Vector3} characterPos - Character position
   * @returns {THREE.Vector3} - Platform velocity to apply
   */
  getPlatformVelocity(groundCollider, characterPos) {
    this.platformVelocity.set(0, 0, 0);
    this.currentPlatform = null;
    
    if (!groundCollider) return this.platformVelocity;
    
    const handle = groundCollider.handle;
    const platform = this.platforms.get(handle);
    
    if (!platform) return this.platformVelocity;
    
    this.currentPlatform = platform;
    
    // Linear velocity
    this.platformVelocity.copy(platform.linearVelocity);
    
    // Angular velocity contribution (tangential)
    if (Math.abs(platform.angularVelocityY) > 0.001) {
      const platformPos = platform.body.translation();
      
      // Vector from platform center to character
      const toChar = new THREE.Vector3(
        characterPos.x - platformPos.x,
        0,
        characterPos.z - platformPos.z
      );
      
      // Tangential velocity = omega × r
      // For Y-axis rotation: perpendicular to radius on XZ plane
      const tangent = new THREE.Vector3(-toChar.z, 0, toChar.x);
      tangent.multiplyScalar(platform.angularVelocityY);
      
      this.platformVelocity.add(tangent);
    }
    
    return this.platformVelocity;
  }

  /**
   * Get current platform name (for debug)
   */
  getCurrentPlatformName() {
    return this.currentPlatform ? 'platform' : 'none';
  }

  /**
   * Extract yaw from quaternion
   */
  _quatToYaw(q) {
    // Assuming Y-up, extract yaw rotation
    const siny_cosp = 2 * (q.w * q.y + q.x * q.z);
    const cosy_cosp = 1 - 2 * (q.y * q.y + q.x * q.x);
    return Math.atan2(siny_cosp, cosy_cosp);
  }
}
