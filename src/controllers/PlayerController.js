/**
 * PlayerController - Orchestrates player systems
 *
 * Responsibilities:
 * - Connect InputManager -> CharacterMotor
 * - Connect CharacterMotor -> VisualRig
 * - Connect InputManager -> CameraRig
 * - Handle possession (swap visual rig)
 */

export class PlayerController {
  /**
   * @param {import('../core/InputManager.js').InputManager} input
   * @param {import('../physics/CharacterMotor.js').CharacterMotor} motor
   * @param {import('../game/camera/CameraRig.js').CameraRig} cameraRig
   * @param {import('../visuals/VisualRig.js').VisualRig} visualRig
   */
  constructor(input, motor, cameraRig, visualRig) {
    this.input = input;
    this.motor = motor;
    this.cameraRig = cameraRig;
    this.visualRig = visualRig;

    // Platform carrier (set externally)
    this.platformCarrier = null;

    // Jump settings
    this.jumpStrength = 8.0;
    this.jumpCooldown = 0;
    this.jumpCooldownDuration = 0.16;
    this.jumpBufferTime = 0.12;
    this.jumpBufferTimer = 0;
    this.maxAirJumps = 1;
    this.airJumpsRemaining = this.maxAirJumps;

    // Reused intent objects keep InputManager's shared return object immutable
    // and avoid allocating on every frame.
    this._moveIntent = { x: 0, z: 0 };
    this._motorIntent = {
      targetSpeed: this.motor.walkSpeed ?? this.motor.maxSpeed ?? 4.2,
      jumpHeld: false,
      sprinting: false,
    };
    this._jumpHeldLastUpdate = false;
  }

  /**
   * Update player systems
   * @param {number} dt - Delta time
   */
  update(dt) {
    const safeDt = Math.max(0, Number(dt) || 0);

    // --- Input -> Camera ---
    const mouseDelta = this.input.consumeMouseDelta();
    this.cameraRig.applyInput(mouseDelta.x, mouseDelta.y);

    // --- Platform velocity ---
    if (this.platformCarrier && this.motor.collider) {
      const charPos = this.motor.getPosition();
      const platformVel = this.platformCarrier.getPlatformVelocity(null, charPos);
      this.motor.setPlatformVelocity(platformVel);
    } else {
      this.motor.setPlatformVelocity(null);
    }

    // --- Input -> Motor ---
    const rawMoveInput = this.input.getMovementInput();
    const moveInput = this._moveIntent;
    moveInput.x = -rawMoveInput.x; // Preserve the established camera-relative handedness.
    moveInput.z = rawMoveInput.z;
    const cameraYaw = this.cameraRig.getYaw();

    // --- Jump ---
    if (this.motor.isGrounded) {
      this.airJumpsRemaining = this.maxAirJumps;
    }

    this.jumpCooldown = Math.max(0, this.jumpCooldown - safeDt);
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - safeDt);

    const jumpHeld = Boolean(this.input.keys?.jump);
    const jumpPressed = typeof this.input.consumeKeyPress === 'function'
      ? this.input.consumeKeyPress('Space')
      : (jumpHeld && !this._jumpHeldLastUpdate);
    this._jumpHeldLastUpdate = jumpHeld;

    if (jumpPressed) {
      this.jumpBufferTimer = this.jumpBufferTime;
    }
    this._consumeBufferedJump();

    const sprinting = Boolean(this.input.keys?.sprint)
      && (moveInput.x * moveInput.x + moveInput.z * moveInput.z > 0.001);
    this._motorIntent.targetSpeed = sprinting
      ? (this.motor.sprintSpeed ?? 5.6)
      : (this.motor.walkSpeed ?? this.motor.maxSpeed ?? 4.2);
    this._motorIntent.jumpHeld = jumpHeld;
    this._motorIntent.sprinting = sprinting;

    this.motor.update(safeDt, moveInput, cameraYaw, this._motorIntent);

    if (this.motor.isGrounded) {
      this.airJumpsRemaining = this.maxAirJumps;
    }

    // --- Motor -> Visual ---
    const position = this.motor.getPosition();
    const facingYaw = this.motor.getFacingYaw();

    this.visualRig.update(dt, position, facingYaw);

    // --- Motor -> Camera (setTarget copies, safe with reusable vector) ---
    this.cameraRig.setTarget(position);
  }

  /** Consume a buffered press once a ground/coyote or air jump is available. */
  _consumeBufferedJump() {
    if (this.jumpBufferTimer <= 0 || this.jumpCooldown > 0) return false;

    let didJump = false;
    if (this.motor.canJump()) {
      didJump = this.motor.jump(this.jumpStrength);
    } else if (!this.motor.isGrounded && this.airJumpsRemaining > 0) {
      didJump = this.motor.jump(this.jumpStrength, true);
      if (didJump) this.airJumpsRemaining -= 1;
    }

    if (!didJump) return false;
    this.jumpBufferTimer = 0;
    this.jumpCooldown = this.jumpCooldownDuration;
    return true;
  }

  /**
   * Late update (after physics step, before render)
   * @param {number} dt
   */
  lateUpdate(dt, scene) {
    this.cameraRig.update(dt, scene);
  }

  /**
   * Possess a new visual rig
   * @param {import('../visuals/VisualRig.js').VisualRig} newVisualRig
   */
  possess(newVisualRig) {
    // Keep motor, swap visual
    this.visualRig = newVisualRig;

    // Sync visual position to motor
    const pos = this.motor.getPosition();
    this.visualRig.update(0, pos, this.visualRig.getFacing());
  }

  /**
   * Teleport player
   */
  teleport(position) {
    this.motor.teleport(position);
    this.jumpBufferTimer = 0;
    this.jumpCooldown = 0;
    this.airJumpsRemaining = this.maxAirJumps;
    this.visualRig.update(0, position, null);
    this.cameraRig.setTarget(position);
    this.cameraRig.resetPosition();
  }

  /**
   * Get debug info
   */
  getDebugInfo() {
    const pos = this.motor.getPosition();
    const vel = this.motor.getVelocity();
    const hover = this.motor.computeHoverMeters();
    const visOffsetY = this.visualRig?.getVisualOffsetY?.();

    return {
      position: `${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`,
      velocity: `${vel.x.toFixed(2)}, ${vel.y.toFixed(2)}, ${vel.z.toFixed(2)}`,
      speed: vel.length().toFixed(2),
      grounded: this.motor.isGrounded,
      phase: this.motor.phase || (this.motor.isGrounded ? 'grounded' : 'falling'),
      platform: this.platformCarrier?.getCurrentPlatformName() || 'none',
      hover: hover === null ? '—' : `${hover.toFixed(3)}m`,
      visOffsetY: Number.isFinite(visOffsetY) ? visOffsetY.toFixed(3) : '—',
    };
  }

  /** Animation-ready state owned by the motor (reused; do not mutate/store). */
  getLocomotionState() {
    return this.motor.getMotionState?.() || {
      phase: this.motor.isGrounded ? 'grounded' : 'falling',
      grounded: this.motor.isGrounded,
      justJumped: false,
      justLanded: false,
      landingSpeed: 0,
      horizontalSpeed: Math.hypot(this.motor.velocity?.x || 0, this.motor.velocity?.z || 0),
      verticalVelocity: this.motor.velocity?.y || 0,
      isSprinting: false,
    };
  }
}
