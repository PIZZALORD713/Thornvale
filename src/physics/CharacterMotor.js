/**
 * CharacterMotor - Rapier Character Controller (KCC) capsule
 * 
 * Responsibilities:
 * - Capsule collider for player
 * - computeColliderMovement for collision resolution
 * - Ground detection
 * - Autostep over small obstacles
 * - Snap to ground
 * - Apply platform motion
 */

import * as THREE from 'three';

export class CharacterMotor {
  constructor(physicsWorld) {
    this.physics = physicsWorld;
    
    /** @type {import('@dimforge/rapier3d-compat').KinematicCharacterController} */
    this.controller = null;
    
    /** @type {import('@dimforge/rapier3d-compat').RigidBody} */
    this.body = null;
    
    /** @type {import('@dimforge/rapier3d-compat').Collider} */
    this.collider = null;
    
    // Capsule dimensions
    this.radius = 0.35;
    this.halfHeight = 0.55; // Total height = 2 * halfHeight + 2 * radius ≈ 1.8m
    
    // Movement settings
    this.maxSpeed = 6.0;
    this.acceleration = 40.0;
    this.friction = 15.0;
    this.airControl = 0.3;
    
    // State
    this.velocity = new THREE.Vector3();
    this.isGrounded = false;
    this.groundedTimer = 0;
    this.coyoteTime = 0.1; // Grace period after leaving ground
    
    // Platform tracking
    this.platformVelocity = new THREE.Vector3();
    this.lastPlatformCollider = null;
    
    // Visual mesh (debug)
    this.debugMesh = null;
  }

  /**
   * Initialize the character controller
   * @param {THREE.Vector3} position - Spawn position
   * @param {THREE.Scene} scene - Scene for debug mesh
   */
  init(position, scene) {
    const { RAPIER, world } = this.physics;
    
    // Create kinematic rigidbody
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(position.x, position.y, position.z);
    this.body = world.createRigidBody(bodyDesc);
    
    // Create capsule collider
    const colliderDesc = RAPIER.ColliderDesc.capsule(this.halfHeight, this.radius)
      .setCollisionGroups(
        this.physics.makeCollisionGroups(
          this.physics.GROUPS.PLAYER,
          this.physics.GROUPS.GROUND | this.physics.GROUPS.DYNAMIC | this.physics.GROUPS.PLATFORM
        )
      );
    this.collider = world.createCollider(colliderDesc, this.body);
    
    // Create character controller
    this.controller = world.createCharacterController(0.01); // offset
    
    // Configure controller
    this.controller.enableAutostep(0.3, 0.2, true);  // maxHeight, minWidth, includeDynamic
    this.controller.enableSnapToGround(0.3);          // distance
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(80);             // kg
    
    // Slope handling
    this.controller.setMaxSlopeClimbAngle(Math.PI / 4); // 45 degrees
    this.controller.setMinSlopeSlideAngle(Math.PI / 4); // Start sliding at 45 degrees
    
    // Debug mesh
    if (scene) {
      this._createDebugMesh(scene);
    }
    
    console.log('[CharacterMotor] Initialized at', position);
    return this;
  }

  /**
   * Update the character motor
   * @param {number} dt - Delta time
   * @param {{ x: number, z: number }} inputDir - Input direction (camera-relative)
   * @param {number} cameraYaw - Camera yaw for movement direction
   */
  update(dt, inputDir, cameraYaw) {
    if (!this.controller || !this.body || !this.collider) return;
    
    const { world } = this.physics;
    
    // Calculate world-space movement direction from camera
    const forward = new THREE.Vector3(
      Math.sin(cameraYaw),
      0,
      Math.cos(cameraYaw)
    );
    const right = new THREE.Vector3(
      Math.cos(cameraYaw),
      0,
      -Math.sin(cameraYaw)
    );
    
    // Desired horizontal velocity
    const desiredDir = new THREE.Vector3();
    desiredDir.addScaledVector(forward, -inputDir.z);
    desiredDir.addScaledVector(right, inputDir.x);
    
    const hasInput = desiredDir.lengthSq() > 0.001;
    
    // Acceleration / friction
    if (hasInput) {
      desiredDir.normalize();
      const targetVel = desiredDir.clone().multiplyScalar(this.maxSpeed);
      
      // Interpolate toward target velocity
      const accelRate = this.isGrounded ? this.acceleration : this.acceleration * this.airControl;
      const accelVec = targetVel.sub(this.velocity).multiplyScalar(accelRate * dt);
      
      this.velocity.x += accelVec.x;
      this.velocity.z += accelVec.z;
    } else {
      // Apply friction
      const frictionRate = this.isGrounded ? this.friction : this.friction * this.airControl;
      const friction = Math.exp(-frictionRate * dt);
      this.velocity.x *= friction;
      this.velocity.z *= friction;
      
      // Stop if very slow
      if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
      if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;
    }
    
    // Gravity
    if (!this.isGrounded) {
      this.velocity.y += -20 * dt; // Gravity
      this.velocity.y = Math.max(this.velocity.y, -50); // Terminal velocity
    } else {
      // Small downward force to maintain ground contact
      this.velocity.y = -2;
    }
    
    // Add platform velocity
    const movement = this.velocity.clone().multiplyScalar(dt);
    movement.add(this.platformVelocity.clone().multiplyScalar(dt));
    
    // Compute movement with collision
    this.controller.computeColliderMovement(
      this.collider,
      { x: movement.x, y: movement.y, z: movement.z },
      undefined,  // filterFlags
      undefined   // filterGroups
    );
    
    // Get corrected movement
    const corrected = this.controller.computedMovement();
    
    // Update grounded state
    this.isGrounded = this.controller.computedGrounded();
    
    if (this.isGrounded) {
      this.groundedTimer = this.coyoteTime;
      if (this.velocity.y < 0) {
        this.velocity.y = 0;
      }
    } else {
      this.groundedTimer -= dt;
    }
    
    // Apply movement to rigidbody
    const currentPos = this.body.translation();
    const newPos = {
      x: currentPos.x + corrected.x,
      y: currentPos.y + corrected.y,
      z: currentPos.z + corrected.z,
    };
    
    this.body.setNextKinematicTranslation(newPos);
    
    // Update debug mesh
    if (this.debugMesh) {
      this.debugMesh.position.set(newPos.x, newPos.y, newPos.z);
    }
  }

  /**
   * Set platform velocity (called by PlatformCarrier)
   */
  setPlatformVelocity(velocity) {
    this.platformVelocity.copy(velocity);
  }

  /**
   * Get current position
   * @returns {THREE.Vector3}
   */
  getPosition() {
    if (!this.body) return new THREE.Vector3();
    const pos = this.body.translation();
    return new THREE.Vector3(pos.x, pos.y, pos.z);
  }

  /**
   * Get current velocity
   * @returns {THREE.Vector3}
   */
  getVelocity() {
    return this.velocity.clone();
  }

  /**
   * Get facing yaw based on velocity
   * @returns {number} - Angle in radians
   */
  getFacingYaw() {
    const vel = this.velocity;
    if (vel.x * vel.x + vel.z * vel.z < 0.01) {
      return null; // No movement, keep current facing
    }
    return Math.atan2(vel.x, vel.z);
  }

  /**
   * Check if grounded (with coyote time)
   */
  canJump() {
    return this.groundedTimer > 0;
  }

  /**
   * Apply jump impulse
   */
  jump(strength = 8, allowAir = false) {
    if (this.canJump() || allowAir) {
      this.velocity.y = strength;
      this.groundedTimer = 0;
      this.isGrounded = false;
    }
  }

  /**
   * Teleport to position
   */
  teleport(position) {
    if (this.body) {
      this.body.setNextKinematicTranslation({
        x: position.x,
        y: position.y,
        z: position.z,
      });
      this.velocity.set(0, 0, 0);
    }
  }

  /**
   * Create debug visualization
   */
  _createDebugMesh(scene) {
    const totalHeight = this.halfHeight * 2 + this.radius * 2;
    
    // Capsule approximation with cylinder + hemispheres
    const group = new THREE.Group();
    
    // Cylinder body
    const cylGeo = new THREE.CylinderGeometry(
      this.radius,
      this.radius,
      this.halfHeight * 2,
      16
    );
    const mat = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5,
      wireframe: true,
    });
    const cylinder = new THREE.Mesh(cylGeo, mat);
    group.add(cylinder);
    
    // Top hemisphere
    const topGeo = new THREE.SphereGeometry(this.radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const topSphere = new THREE.Mesh(topGeo, mat);
    topSphere.position.y = this.halfHeight;
    group.add(topSphere);
    
    // Bottom hemisphere
    const botGeo = new THREE.SphereGeometry(this.radius, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const botSphere = new THREE.Mesh(botGeo, mat);
    botSphere.position.y = -this.halfHeight;
    group.add(botSphere);
    
    this.debugMesh = group;
    scene.add(group);
  }

  /**
   * Toggle debug mesh visibility
   */
  setDebugVisible(visible) {
    if (this.debugMesh) {
      this.debugMesh.visible = visible;
    }
  }

  /**
   * Clean up
   */
  dispose() {
    if (this.debugMesh) {
      this.debugMesh.parent?.remove(this.debugMesh);
    }
    // Rapier cleanup handled by world.free()
  }
}
