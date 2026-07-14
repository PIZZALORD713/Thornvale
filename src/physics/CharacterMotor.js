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

import { Vector3, Group, CylinderGeometry, SphereGeometry, MeshStandardMaterial, Mesh } from 'three';

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

    // Movement settings. Speeds are metres/second; acceleration/friction are
    // metres/second squared so they remain stable when the render rate changes.
    this.walkSpeed = 4.2;
    this.sprintSpeed = 5.6;
    this.maxSpeed = this.walkSpeed; // Backwards-compatible default speed.
    this.acceleration = 24.0;
    this.friction = 30.0;
    this.airControl = 0.35;
    this.airFriction = 2.0;

    // Vertical movement settings
    this.gravity = -20.0;
    this.fallGravityMultiplier = 1.25;
    this.jumpReleaseGravityMultiplier = 1.75;
    this.terminalVelocity = -50.0;
    this.groundStickSpeed = -2.0;
    this.groundedPendingThreshold = 0.002;
    this.groundProbeDistance = 0.08;
    this.groundProbePenetration = 0.05;
    this.groundRenderSharpness = 20.0;
    this.groundRenderMaxSpeed = 1.6;
    this.groundRenderMaxLag = 0.025;
    this.maxDeltaTime = 0.075;

    // State
    this.velocity = new Vector3();
    this.isGrounded = false;
    this.rawGrounded = false;
    this.groundedTimer = 0;
    this.coyoteTime = 0.12; // Grace period after leaving ground
    this.groundContactGrace = 0.08;
    this._groundContactTimer = 0;

    // Animation-facing locomotion state. Transition flags are true for one
    // motor update and avoid consumers having to infer jumps from noisy Y data.
    this.phase = 'falling';
    this.justJumped = false;
    this.justLanded = false;
    this.justLeftGround = false;
    this.landingSpeed = 0;
    this.lastLandingSpeed = 0;
    this.airTime = 0;
    this.lastAirTime = 0;
    this.horizontalSpeed = 0;
    this.speedRatio = 0;
    this.isSprinting = false;
    this.facingSpeedThreshold = 0.18;
    this._groundedLastUpdate = false;
    this._hasUpdated = false;
    this._jumpEventPending = false;

    // Platform tracking
    this.platformVelocity = new Vector3();
    this.lastPlatformCollider = null;

    // Visual mesh (debug)
    this.debugMesh = null;

    // Character controller skin width
    this.controllerSkin = 0.01;

    // Pre-allocated temp vectors to avoid per-frame GC pressure
    this._tmpForward = new Vector3();
    this._tmpRight = new Vector3();
    this._tmpDesiredDir = new Vector3();
    this._tmpTargetVel = new Vector3();
    this._tmpMovement = new Vector3();
    this._tmpPendingMovement = new Vector3();
    this._tmpPosition = new Vector3();
    this._tmpPhysicsPosition = new Vector3();
    this._targetPosition = new Vector3();
    this._renderPosition = new Vector3();
    this._hasTargetPosition = false;
    this._hasRenderPosition = false;
    this._groundYSamples = new Float64Array(5);
    this._groundYSorted = new Float64Array(5);
    this._groundYSampleCount = 0;
    this._groundYSampleIndex = 0;
    this._groundRay = null;
    this._motionState = {
      phase: this.phase,
      grounded: this.isGrounded,
      rawGrounded: this.rawGrounded,
      justJumped: false,
      justLanded: false,
      justLeftGround: false,
      landingSpeed: 0,
      airTime: 0,
      horizontalSpeed: 0,
      verticalVelocity: 0,
      speedRatio: 0,
      isSprinting: false,
    };
  }

  /**
   * Initialize the character controller
   * @param {Vector3} position - Spawn position
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

    this._targetPosition.copy(position);
    this._renderPosition.copy(position);
    this._hasTargetPosition = true;
    this._hasRenderPosition = true;
    this._groundRay = new RAPIER.Ray(
      { x: position.x, y: position.y, z: position.z },
      { x: 0, y: -1, z: 0 },
    );

    // Create character controller
    this.controller = world.createCharacterController(this.controllerSkin); // skin width

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
   * @param {{targetSpeed?: number, jumpHeld?: boolean, sprinting?: boolean}} [intent]
   */
  update(dt, inputDir, cameraYaw, intent = {}) {
    if (!this.controller || !this.body || !this.collider) return;

    const safeDt = Math.min(
      this.maxDeltaTime,
      Math.max(0, Number.isFinite(Number(dt)) ? Number(dt) : 0),
    );
    const wasGrounded = this._groundedLastUpdate;
    this.justJumped = this._jumpEventPending;
    this._jumpEventPending = false;
    this.justLanded = false;
    this.justLeftGround = false;
    this.landingSpeed = 0;

    const requestedSpeed = Number(intent?.targetSpeed);
    const targetSpeed = Number.isFinite(requestedSpeed)
      ? Math.max(0, requestedSpeed)
      : this.maxSpeed;
    const jumpHeld = intent?.jumpHeld !== false;
    this.isSprinting = Boolean(intent?.sprinting) && targetSpeed > this.walkSpeed;

    // Calculate world-space movement direction from camera
    const forward = this._tmpForward.set(
      Math.sin(cameraYaw),
      0,
      Math.cos(cameraYaw)
    );
    const right = this._tmpRight.set(
      Math.cos(cameraYaw),
      0,
      -Math.sin(cameraYaw)
    );

    // Desired horizontal velocity
    const desiredDir = this._tmpDesiredDir.set(0, 0, 0);
    desiredDir.addScaledVector(forward, -inputDir.z);
    desiredDir.addScaledVector(right, inputDir.x);

    const inputMagnitude = Math.min(1, desiredDir.length());
    const hasInput = inputMagnitude > 0.001;

    // Acceleration / friction
    if (hasInput) {
      desiredDir.multiplyScalar(1 / inputMagnitude);
      const targetVel = this._tmpTargetVel
        .copy(desiredDir)
        .multiplyScalar(targetSpeed * inputMagnitude);

      // Move toward the requested velocity by a bounded amount. The old
      // error * acceleration * dt interpolation overshot whenever dt > 25 ms,
      // producing alternating velocity and visible turn jitter.
      const accelRate = this.isGrounded ? this.acceleration : this.acceleration * this.airControl;
      this._moveHorizontalVelocityToward(targetVel.x, targetVel.z, accelRate * safeDt);
    } else {
      const frictionRate = this.isGrounded ? this.friction : this.airFriction;
      this._moveHorizontalVelocityToward(0, 0, frictionRate * safeDt);
    }

    // The short stabilized contact window prevents a one-frame Rapier seam
    // from switching between gravity and ground-stick. Real ledge exits begin
    // accelerating after groundContactGrace (80 ms), while coyote jump remains
    // independently available for the full coyoteTime.
    if (!this.isGrounded) {
      let gravityScale = this.velocity.y < 0 ? this.fallGravityMultiplier : 1;
      if (!jumpHeld && this.velocity.y > 0) {
        gravityScale = Math.max(gravityScale, this.jumpReleaseGravityMultiplier);
      }
      this.velocity.y += this.gravity * gravityScale * safeDt;
      this.velocity.y = Math.max(this.velocity.y, this.terminalVelocity);
    } else {
      // Small downward force to maintain ground contact
      this.velocity.y = this.groundStickSpeed;
    }

    const currentPos = this.body.translation();
    if (!this._hasTargetPosition) {
      this._targetPosition.set(currentPos.x, currentPos.y, currentPos.z);
      this._hasTargetPosition = true;
    }

    // A render update may run without a Rapier fixed step. Keep the previously
    // requested, collision-corrected displacement and add this frame's delta
    // instead of overwriting setNextKinematicTranslation. This makes travel
    // distance and visuals independent of 60/120/144 Hz display cadence.
    const pendingY = this._targetPosition.y - currentPos.y;
    const preserveGroundedY = this.rawGrounded
      && Math.abs(pendingY) > this.groundedPendingThreshold;
    const pending = this._tmpPendingMovement.set(
      this._targetPosition.x - currentPos.x,
      this.rawGrounded && !preserveGroundedY ? 0 : pendingY,
      this._targetPosition.z - currentPos.z,
    );
    const movement = this._tmpMovement.copy(pending);
    movement.x += (this.velocity.x + this.platformVelocity.x) * safeDt;
    movement.z += (this.velocity.z + this.platformVelocity.z) * safeDt;
    movement.y += this.platformVelocity.y * safeDt;

    if (!this.rawGrounded) {
      // Airborne displacement must accumulate between render and fixed steps.
      movement.y += this.velocity.y * safeDt;
    } else {
      // Preserve any collision-corrected Y that Rapier has not applied yet,
      // but keep extending the grounded probe on every render update. Without
      // this addition, a 120 Hz descent can advance horizontally while reusing
      // only the previous frame's small vertical correction; the slope then
      // falls away before the next fixed 60 Hz body step and raw contact drops.
      movement.y += this.groundStickSpeed * safeDt;
    }

    // Compute movement with collision
    this.controller.computeColliderMovement(
      this.collider,
      { x: movement.x, y: movement.y, z: movement.z },
      undefined,  // filterFlags
      undefined   // filterGroups
    );

    // Get corrected movement
    const corrected = this.controller.computedMovement();

    // Update grounded state. Upward motion always wins over a stale contact
    // reported on the takeoff frame, preventing ground/air animation flicker.
    const collisionCount = typeof this.controller.numComputedCollisions === 'function'
      ? this.controller.numComputedCollisions()
      : null;
    const missedGroundProbe = this.isGrounded
      && !this.justJumped
      && !preserveGroundedY
      && this.platformVelocity.y === 0
      && movement.y < -1e-5
      && collisionCount === 0;
    let correctedY = corrected.y;
    if (missedGroundProbe) correctedY = 0;

    this.rawGrounded = Boolean(this.controller.computedGrounded()) && !missedGroundProbe;
    const hasValidGroundContact = this.rawGrounded
      && !this.justJumped
      && this.velocity.y <= 0;
    const hasProbedGroundSupport = wasGrounded
      && !this.justJumped
      && this.velocity.y <= 0
      && this._hasGroundBelow(
        currentPos.x + corrected.x,
        currentPos.y + correctedY,
        currentPos.z + corrected.z,
      );
    const hasStableGroundContact = hasValidGroundContact || hasProbedGroundSupport;

    if (hasStableGroundContact) {
      this.groundedTimer = this.coyoteTime;
      this._groundContactTimer = this.groundContactGrace;
    } else {
      this.groundedTimer = Math.max(0, this.groundedTimer - safeDt);
      this._groundContactTimer = Math.max(0, this._groundContactTimer - safeDt);
    }

    // Brief raw contact gaps happen at fixed/render-step boundaries and on
    // small seams. Keep the animation-facing state grounded during coyote time;
    // explicit jumps clear the timer and transition immediately.
    this.isGrounded = hasStableGroundContact || (
      wasGrounded
      && !this.justJumped
      && this._groundContactTimer > 0
      && this.velocity.y <= 0
    );

    if (this.isGrounded) {
      if (this._hasUpdated && !wasGrounded) {
        this.justLanded = true;
        this.landingSpeed = Math.max(0, -this.velocity.y);
        this.lastLandingSpeed = this.landingSpeed;
        this.lastAirTime = this.airTime;
      }
      this.airTime = 0;
      if (this.velocity.y < 0) {
        this.velocity.y = 0;
      }
    } else {
      this.airTime = wasGrounded ? safeDt : this.airTime + safeDt;
    }

    this.justLeftGround = wasGrounded && !this.isGrounded;
    this.horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.speedRatio = targetSpeed > 0
      ? Math.min(1, this.horizontalSpeed / targetSpeed)
      : 0;
    this.phase = this.justLanded
      ? 'landing'
      : (this.isGrounded ? 'grounded' : (this.velocity.y > 0.1 ? 'rising' : 'falling'));

    // Apply movement to rigidbody
    this._targetPosition.set(
      currentPos.x + corrected.x,
      currentPos.y + correctedY,
      currentPos.z + corrected.z,
    );
    this.body.setNextKinematicTranslation(this._targetPosition);

    // Horizontal pending motion is already collision-corrected and should be
    // visible immediately. A five-sample median filters short KCC skin/snap
    // bursts without averaging real slope, step, or vertical-platform motion.
    if (!this._hasRenderPosition) {
      this._renderPosition.copy(this._targetPosition);
      this._hasRenderPosition = true;
    } else {
      this._renderPosition.x = this._targetPosition.x;
      this._renderPosition.z = this._targetPosition.z;

      if (this.justJumped || !this.isGrounded || this.justLanded) {
        this._renderPosition.y = this._targetPosition.y;
        this._groundYSampleCount = 0;
        this._groundYSampleIndex = 0;
      } else {
        if (hasValidGroundContact) {
          this._groundYSamples[this._groundYSampleIndex] = this._targetPosition.y;
          this._groundYSampleIndex = (this._groundYSampleIndex + 1) % 5;
          this._groundYSampleCount = Math.min(5, this._groundYSampleCount + 1);
          if (this._groundYSampleCount === 5) {
            this._groundYSorted.set(this._groundYSamples);
            for (let index = 1; index < this._groundYSorted.length; index += 1) {
              const value = this._groundYSorted[index];
              let insertAt = index - 1;
              while (insertAt >= 0 && this._groundYSorted[insertAt] > value) {
                this._groundYSorted[insertAt + 1] = this._groundYSorted[insertAt];
                insertAt -= 1;
              }
              this._groundYSorted[insertAt + 1] = value;
            }
            const filteredY = this._groundYSorted[2];
            const deltaY = filteredY - this._renderPosition.y;
            const dampedStep = deltaY * (1 - Math.exp(-this.groundRenderSharpness * safeDt));
            const maxStep = this.groundRenderMaxSpeed * safeDt;
            this._renderPosition.y += Math.max(-maxStep, Math.min(maxStep, dampedStep));
          }
        }

        // Median damping removes KCC skin noise, but it must not leave the
        // visible feet far behind a continuously changing physical surface.
        // Keep a small bounded lag even during a probe-stabilized contact gap.
        const physicalLag = this._targetPosition.y - this._renderPosition.y;
        if (Math.abs(physicalLag) > this.groundRenderMaxLag) {
          const excessLag = Math.abs(physicalLag) - this.groundRenderMaxLag;
          const catchupStep = Math.min(
            excessLag,
            this.groundRenderMaxSpeed * safeDt,
          );
          this._renderPosition.y += Math.sign(physicalLag) * catchupStep;
        }
      }
    }

    this._groundedLastUpdate = this.isGrounded;
    this._hasUpdated = true;

    // Update debug mesh
    if (this.debugMesh) {
      this.debugMesh.position.copy(this._targetPosition);
    }
  }

  /** Move horizontal velocity toward a target without overshoot. */
  _moveHorizontalVelocityToward(targetX, targetZ, maxDelta) {
    const deltaX = targetX - this.velocity.x;
    const deltaZ = targetZ - this.velocity.z;
    const distance = Math.hypot(deltaX, deltaZ);

    if (distance <= maxDelta || distance <= 1e-6) {
      this.velocity.x = targetX;
      this.velocity.z = targetZ;
      return;
    }

    const scale = Math.max(0, maxDelta) / distance;
    this.velocity.x += deltaX * scale;
    this.velocity.z += deltaZ * scale;
  }

  /** Supplement transient KCC contact gaps without acquiring early landings. */
  _hasGroundBelow(x, y, z) {
    const { RAPIER, world } = this.physics || {};
    if (!RAPIER || !world || !this.collider) return false;

    const bottomY = y - (this.halfHeight + this.radius);
    const rayLift = this.groundProbeDistance;
    if (!this._groundRay) {
      this._groundRay = new RAPIER.Ray(
        { x, y: bottomY + rayLift, z },
        { x: 0, y: -1, z: 0 },
      );
    } else {
      this._groundRay.origin.x = x;
      this._groundRay.origin.y = bottomY + rayLift;
      this._groundRay.origin.z = z;
      this._groundRay.dir.x = 0;
      this._groundRay.dir.y = -1;
      this._groundRay.dir.z = 0;
    }

    const maxToi = rayLift + this.groundProbeDistance;
    const hit = world.castRay(
      this._groundRay,
      maxToi,
      true,
      undefined,
      undefined,
      this.collider,
    );
    if (!hit) return false;

    const timeOfImpact = Number(hit.timeOfImpact ?? hit.toi);
    if (!Number.isFinite(timeOfImpact)) return false;
    const hitY = this._groundRay.origin.y - timeOfImpact;
    const hover = bottomY - hitY;
    return hover <= this.groundProbeDistance
      && hover >= -this.groundProbePenetration;
  }

  /**
   * Set platform velocity
   */
  setPlatformVelocity(velocity) {
    if (velocity) {
      this.platformVelocity.copy(velocity);
    } else {
      this.platformVelocity.set(0, 0, 0);
    }
  }

  /**
   * Get current position (returns reusable vector — do not store)
   * @returns {Vector3}
   */
  getPosition() {
    if (!this.body) return this._tmpPosition.set(0, 0, 0);
    if (this._hasRenderPosition) return this._tmpPosition.copy(this._renderPosition);
    if (this._hasTargetPosition) return this._tmpPosition.copy(this._targetPosition);
    const pos = this.body.translation();
    return this._tmpPosition.set(pos.x, pos.y, pos.z);
  }

  /** Get Rapier's pending physical pose rather than the filtered render pose. */
  getPhysicsPosition() {
    if (!this.body) return this._tmpPhysicsPosition.set(0, 0, 0);
    if (this._hasTargetPosition) return this._tmpPhysicsPosition.copy(this._targetPosition);
    const pos = this.body.translation();
    return this._tmpPhysicsPosition.set(pos.x, pos.y, pos.z);
  }

  /**
   * Get current velocity (returns internal reference — do not mutate)
   * @returns {Vector3}
   */
  getVelocity() {
    return this.velocity;
  }

  /**
   * Get facing yaw based on velocity
   * @returns {number} - Angle in radians
   */
  getFacingYaw() {
    const vel = this.velocity;
    if (vel.x * vel.x + vel.z * vel.z < this.facingSpeedThreshold ** 2) {
      return null; // No movement, keep current facing
    }
    return Math.atan2(vel.x, vel.z);
  }

  /**
   * Get animation-ready locomotion state (returns a reusable object).
   */
  getMotionState() {
    const state = this._motionState;
    state.phase = this.phase;
    state.grounded = this.isGrounded;
    state.rawGrounded = this.rawGrounded;
    state.justJumped = this.justJumped;
    state.justLanded = this.justLanded;
    state.justLeftGround = this.justLeftGround;
    state.landingSpeed = this.landingSpeed;
    state.airTime = this.airTime;
    state.horizontalSpeed = this.horizontalSpeed;
    state.verticalVelocity = this.velocity.y;
    state.speedRatio = this.speedRatio;
    state.isSprinting = this.isSprinting;
    return state;
  }

  /**
   * Get rendered capsule bottom Y in world space (used for visual grounding).
   */
  getCapsuleBottomY() {
    if (!this.body) return 0;
    const pos = this._hasRenderPosition
      ? this._renderPosition
      : (this._hasTargetPosition ? this._targetPosition : this.body.translation());
    return pos.y - (this.halfHeight + this.radius);
  }

  /** Get pending physical capsule bottom Y for collision diagnostics. */
  getPhysicsCapsuleBottomY() {
    if (!this.body) return 0;
    const pos = this._hasTargetPosition ? this._targetPosition : this.body.translation();
    return pos.y - (this.halfHeight + this.radius);
  }

  /**
   * Compute hover distance from capsule bottom to ground hit
   * @returns {number|null}
   */
  computeHoverMeters() {
    if (!this.body || !this.collider) {
      return null;
    }

    const { RAPIER, world } = this.physics;
    if (!RAPIER || !world) return null;

    const pos = this._hasTargetPosition ? this._targetPosition : this.body.translation();
    const bottomY = this.getPhysicsCapsuleBottomY();
    const rayOrigin = { x: pos.x, y: bottomY + 0.2, z: pos.z };
    const rayDir = { x: 0, y: -1, z: 0 };
    const ray = new RAPIER.Ray(rayOrigin, rayDir);
    const maxToi = 1.0;
    const hit = world.castRay(ray, maxToi, true, undefined, undefined, this.collider);
    if (!hit) return null;

    const timeOfImpact = Number(hit.timeOfImpact ?? hit.toi);
    if (!Number.isFinite(timeOfImpact)) return null;
    const hitY = rayOrigin.y - timeOfImpact;
    const hover = bottomY - hitY;
    return Number.isFinite(hover) ? hover : null;
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
      this._groundContactTimer = 0;
      this.isGrounded = false;
      this.rawGrounded = false;
      this.airTime = 0;
      this.phase = 'rising';
      this.justJumped = true;
      this.justLanded = false;
      this._jumpEventPending = true;
      return true;
    }
    return false;
  }

  /**
   * Teleport to position
   */
  teleport(position) {
    if (this.body) {
      const target = {
        x: position.x,
        y: position.y,
        z: position.z,
      };
      // Update both the current and next kinematic pose. Only setting the next
      // pose can be overwritten by the controller on the following frame,
      // which made consecutive teleports intermittently fail.
      this.body.setTranslation(target, true);
      this.body.setNextKinematicTranslation(target);
      this._targetPosition.set(target.x, target.y, target.z);
      this._renderPosition.set(target.x, target.y, target.z);
      this._hasTargetPosition = true;
      this._hasRenderPosition = true;
      this._groundYSampleCount = 0;
      this._groundYSampleIndex = 0;
      this.velocity.set(0, 0, 0);
      this.isGrounded = false;
      this.rawGrounded = false;
      this.groundedTimer = 0;
      this._groundContactTimer = 0;
      this.airTime = 0;
      this.phase = 'falling';
      this.justJumped = false;
      this.justLanded = false;
      this.justLeftGround = false;
      this.landingSpeed = 0;
      this.horizontalSpeed = 0;
      this.speedRatio = 0;
      this.isSprinting = false;
      this._groundedLastUpdate = false;
      this._hasUpdated = false;
      this._jumpEventPending = false;
      if (this.debugMesh) this.debugMesh.position.set(target.x, target.y, target.z);
    }
  }

  /**
   * Create debug visualization
   */
  _createDebugMesh(scene) {
    // Capsule approximation with cylinder + hemispheres
    const group = new Group();

    // Cylinder body
    const cylGeo = new CylinderGeometry(
      this.radius,
      this.radius,
      this.halfHeight * 2,
      16
    );
    const mat = new MeshStandardMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5,
      wireframe: true,
    });
    const cylinder = new Mesh(cylGeo, mat);
    group.add(cylinder);

    // Top hemisphere
    const topGeo = new SphereGeometry(this.radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const topSphere = new Mesh(topGeo, mat);
    topSphere.position.y = this.halfHeight;
    group.add(topSphere);

    // Bottom hemisphere
    const botGeo = new SphereGeometry(this.radius, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    const botSphere = new Mesh(botGeo, mat);
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
