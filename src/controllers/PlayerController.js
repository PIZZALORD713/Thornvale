/**
 * PlayerController - Orchestrates player systems
 * 
 * Responsibilities:
 * - Connect InputManager → CharacterMotor
 * - Connect CharacterMotor → VisualRig
 * - Connect InputManager → CameraRig
 * - Handle possession (swap visual rig)
 */

import * as THREE from 'three';

export class PlayerController {
  /**
   * @param {import('../core/InputManager.js').InputManager} input
   * @param {import('../physics/CharacterMotor.js').CharacterMotor} motor
   * @param {import('./CameraRig.js').CameraRig} cameraRig
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
    this.maxAirJumps = 1;
    this.airJumpsRemaining = this.maxAirJumps;
  }

  /**
   * Update player systems
   * @param {number} dt - Delta time
   */
  update(dt) {
    // --- Input → Camera ---
    const mouseDelta = this.input.consumeMouseDelta();
    this.cameraRig.applyInput(mouseDelta.x, mouseDelta.y);
    
    // --- Platform velocity ---
    if (this.platformCarrier && this.motor.collider) {
      // TODO: Need to get ground collider from controller
      // For now, use any platform we registered
      const charPos = this.motor.getPosition();
      const platformVel = this.platformCarrier.getPlatformVelocity(null, charPos);
      this.motor.setPlatformVelocity(platformVel);
    }
    
    // --- Input → Motor ---
    const moveInput = this.input.getMovementInput();
    moveInput.x *= -1; // Fix inverted left/right controls
    const cameraYaw = this.cameraRig.getYaw();
    
    this.motor.update(dt, moveInput, cameraYaw);
    
    // --- Jump ---
    if (this.motor.isGrounded) {
      this.airJumpsRemaining = this.maxAirJumps;
    }
    if (this.input.keys.jump && this.jumpCooldown <= 0) {
      if (this.motor.canJump()) {
        this.motor.jump(this.jumpStrength);
        this.jumpCooldown = 0.2; // Prevent spam
      } else if (this.airJumpsRemaining > 0) {
        this.motor.jump(this.jumpStrength, true);
        this.airJumpsRemaining -= 1;
        this.jumpCooldown = 0.2;
      }
    }
    this.jumpCooldown -= dt;
    
    // --- Motor → Visual ---
    const position = this.motor.getPosition();
    const facingYaw = this.motor.getFacingYaw();
    
    this.visualRig.update(dt, position, facingYaw);
    
    // --- Motor → Camera ---
    // Offset camera target to capsule center
    const cameraTarget = position.clone();
    this.cameraRig.setTarget(cameraTarget);
  }

  /**
   * Late update (after physics step, before render)
   * @param {number} dt
   * @param {THREE.Scene} scene
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
   * @param {THREE.Vector3} position
   */
  teleport(position) {
    this.motor.teleport(position);
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
      platform: this.platformCarrier?.getCurrentPlatformName() || 'none',
      hover: hover === null ? '—' : `${hover.toFixed(3)}m`,
      visOffsetY: Number.isFinite(visOffsetY) ? visOffsetY.toFixed(3) : '—',
    };
  }
}
