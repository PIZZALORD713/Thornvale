/**
 * DynamicBody - Helper for creating physics toys
 * 
 * A simple wrapper to keep track of dynamic rigidbody + mesh pairs.
 * Most functionality is in PhysicsWorld, this is for organization.
 */

import * as THREE from 'three';

export class DynamicBody {
  constructor(body, collider, mesh) {
    this.body = body;
    this.collider = collider;
    this.mesh = mesh;
    
    // Track if disposed
    this.disposed = false;
  }

  /**
   * Sync mesh transform to physics body
   */
  syncMesh() {
    if (!this.body || !this.mesh || this.disposed) return;
    
    const pos = this.body.translation();
    const rot = this.body.rotation();
    
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  }

  /**
   * Apply impulse at center of mass
   */
  applyImpulse(impulse) {
    if (this.body && !this.disposed) {
      this.body.applyImpulse(impulse, true);
    }
  }

  /**
   * Apply force at center of mass
   */
  applyForce(force) {
    if (this.body && !this.disposed) {
      this.body.addForce(force, true);
    }
  }

  /**
   * Get current position
   */
  getPosition() {
    if (!this.body) return new THREE.Vector3();
    const pos = this.body.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  /**
   * Get current velocity
   */
  getVelocity() {
    if (!this.body) return new THREE.Vector3();
    const vel = this.body.linvel();
    return new THREE.Vector3(vel.x, vel.y, vel.z);
  }

  /**
   * Reset to position
   */
  reset(position, rotation = null) {
    if (!this.body || this.disposed) return;
    
    this.body.setTranslation(position, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    
    if (rotation) {
      this.body.setRotation(rotation, true);
    }
  }

  /**
   * Remove from scene and mark as disposed
   */
  dispose(scene) {
    if (this.mesh && scene) {
      scene.remove(this.mesh);
      this.mesh.geometry?.dispose();
      this.mesh.material?.dispose();
    }
    this.disposed = true;
  }
}
