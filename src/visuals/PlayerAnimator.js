import { Euler, MathUtils, Quaternion, Vector3 } from 'three';

function damp(current, target, sharpness, dt) {
  return MathUtils.lerp(current, target, 1 - Math.exp(-sharpness * dt));
}

function clampDt(dt) {
  return Math.min(Math.max(Number(dt) || 0, 0), 0.075);
}

/**
 * Adds an expressive procedural motion layer to a VisualRig.
 *
 * The animator only touches the local transform of `visualRig.visual`; world
 * position and facing remain owned by VisualRig. Child skeletons are never
 * modified, so skeletal clips can continue playing beneath this root motion.
 */
export class PlayerAnimator {
  constructor(visualRig, options = {}) {
    this.visualRig = visualRig || null;
    this.enabled = options.enabled !== false;
    this.maxSpeed = Math.max(0.1, options.maxSpeed ?? 6);
    this.motionScale = Math.max(0, options.motionScale ?? 1);

    this.settings = {
      idleBob: options.idleBob ?? 0.014,
      idleFrequency: options.idleFrequency ?? 1.85,
      runBob: options.runBob ?? 0.055,
      runSway: options.runSway ?? 0.055,
      strideFrequency: options.strideFrequency ?? 9.5,
      forwardLean: options.forwardLean ?? 0.075,
      airStretch: options.airStretch ?? 0.065,
      landingSquash: options.landingSquash ?? 0.14,
      landingSpring: options.landingSpring ?? 72,
      landingDamping: options.landingDamping ?? 12,
    };

    this.visual = null;
    this._basePosition = new Vector3();
    this._baseQuaternion = new Quaternion();
    this._baseScale = new Vector3(1, 1, 1);
    this._offsetEuler = new Euler(0, 0, 0, 'YXZ');
    this._offsetQuaternion = new Quaternion();

    this._time = 0;
    this._stride = 0;
    this._moveBlend = 0;
    this._airBlend = 0;
    this._wasGrounded = true;
    this._lastAirVelocityY = 0;
    this._landing = 0;
    this._landingVelocity = 0;
    this._emote = null;
    this._reducedMotion = options.reducedMotion ?? this._prefersReducedMotion();

    this.captureBasePose();
  }

  _prefersReducedMotion() {
    try {
      return Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
    } catch {
      return false;
    }
  }

  /**
   * Capture the visual's authored transform as the neutral pose. This is also
   * called automatically whenever VisualRig swaps to another model.
   */
  captureBasePose() {
    const nextVisual = this.visualRig?.visual || null;
    if (this.visual && this.visual !== nextVisual) this._restoreBasePose();
    this.visual = nextVisual;

    if (this.visual) {
      this._basePosition.copy(this.visual.position);
      this._baseQuaternion.copy(this.visual.quaternion);
      this._baseScale.copy(this.visual.scale);
    }
    return this;
  }

  /**
   * Update after PlayerController.update(), so the rig has already followed the
   * physics body for this frame.
   *
   * @param {number} dt
   * @param {{velocity?: {x:number,y:number,z:number}, isGrounded?: boolean, grounded?: boolean}} state
   */
  update(dt, state = {}) {
    if (!this.enabled) return;
    if (this.visualRig?.visual !== this.visual) this.captureBasePose();
    if (!this.visual) return;

    const safeDt = clampDt(dt);
    this._time += safeDt;

    const velocity = state.velocity || { x: 0, y: 0, z: 0 };
    const vx = Number(velocity.x) || 0;
    const vy = Number(velocity.y) || 0;
    const vz = Number(velocity.z) || 0;
    const grounded = Boolean(state.isGrounded ?? state.grounded ?? true);
    const speed = Math.sqrt(vx * vx + vz * vz);
    const speed01 = MathUtils.clamp(speed / this.maxSpeed, 0, 1);

    this._moveBlend = damp(this._moveBlend, speed01, grounded ? 9 : 4, safeDt);
    this._airBlend = damp(this._airBlend, grounded ? 0 : 1, grounded ? 12 : 7, safeDt);

    if (!grounded) this._lastAirVelocityY = Math.min(this._lastAirVelocityY, vy);
    if (grounded && !this._wasGrounded) {
      const impact = MathUtils.clamp(Math.abs(this._lastAirVelocityY) / 12, 0.28, 1);
      this.triggerLanding(impact);
      this._lastAirVelocityY = 0;
    } else if (!grounded && this._wasGrounded) {
      this._lastAirVelocityY = Math.min(0, vy);
    }
    this._wasGrounded = grounded;

    const strideRate = MathUtils.lerp(3.2, this.settings.strideFrequency, this._moveBlend);
    this._stride += safeDt * strideRate;
    this._updateLandingSpring(safeDt);

    const reducedScale = this._reducedMotion ? 0.22 : 1;
    const motion = this.motionScale * reducedScale;
    const idleWeight = 1 - this._moveBlend;
    const idleWave = Math.sin(this._time * this.settings.idleFrequency * Math.PI * 2);
    const idleBreath = Math.sin(this._time * this.settings.idleFrequency * Math.PI);
    const strideSin = Math.sin(this._stride);
    const strideCos = Math.cos(this._stride);
    const footfall = 1 - Math.abs(strideSin);

    const runBob = footfall * this.settings.runBob * this._moveBlend;
    let yOffset = (
      idleWave * this.settings.idleBob * idleWeight
      + runBob
      + this._landing * 0.12
    ) * motion;

    let pitch = (
      -this.settings.forwardLean * this._moveBlend
      + strideCos * 0.025 * this._moveBlend
    ) * motion;
    let yaw = strideSin * 0.02 * this._moveBlend * motion;
    let roll = strideSin * this.settings.runSway * this._moveBlend * motion;

    const verticalAir = MathUtils.clamp(vy / 9, -1, 1);
    const airStretch = this.settings.airStretch * this._airBlend * (0.45 + Math.abs(verticalAir) * 0.55) * motion;
    pitch += -verticalAir * 0.045 * this._airBlend * motion;

    const emoteOffsets = this._updateEmote(safeDt, motion);
    yOffset += emoteOffsets.y;
    pitch += emoteOffsets.pitch;
    yaw += emoteOffsets.yaw;
    roll += emoteOffsets.roll;

    const landingSquash = MathUtils.clamp(this._landing, -0.24, 0.18)
      * (this.settings.landingSquash / 0.14)
      * motion;
    const breathScale = idleBreath * 0.008 * idleWeight * motion;
    const scaleY = Math.max(0.72, 1 + landingSquash + airStretch + breathScale + emoteOffsets.scaleY);
    const scaleXZ = Math.max(0.78, 1 - landingSquash * 0.44 - airStretch * 0.34 - breathScale * 0.3 + emoteOffsets.scaleXZ);

    this.visual.position.set(
      this._basePosition.x,
      this._basePosition.y + yOffset,
      this._basePosition.z,
    );
    this._offsetEuler.set(pitch, yaw, roll);
    this._offsetQuaternion.setFromEuler(this._offsetEuler);
    this.visual.quaternion.copy(this._baseQuaternion).multiply(this._offsetQuaternion);
    this.visual.scale.set(
      this._baseScale.x * scaleXZ,
      this._baseScale.y * scaleY,
      this._baseScale.z * scaleXZ,
    );
  }

  _updateLandingSpring(dt) {
    const acceleration = (
      -this.settings.landingSpring * this._landing
      -this.settings.landingDamping * this._landingVelocity
    );
    this._landingVelocity += acceleration * dt;
    this._landing += this._landingVelocity * dt;

    if (Math.abs(this._landing) < 0.0001 && Math.abs(this._landingVelocity) < 0.0001) {
      this._landing = 0;
      this._landingVelocity = 0;
    }
  }

  /** Force a landing response; normally detected automatically. */
  triggerLanding(intensity = 0.65) {
    const impact = MathUtils.clamp(Number(intensity) || 0, 0, 1.5);
    this._landing = Math.min(this._landing, -this.settings.landingSquash * impact);
    this._landingVelocity -= impact * 0.72;
    return this;
  }

  /**
   * Play a tiny whole-body reaction without requiring authored animation clips.
   * Supported presets: happy/kindness, bell, magic.
   */
  triggerEmote(kind = 'happy', intensity = 1) {
    const normalizedKind = kind === 'kindness' ? 'happy' : kind;
    this._emote = {
      kind: ['happy', 'bell', 'magic'].includes(normalizedKind) ? normalizedKind : 'happy',
      age: 0,
      duration: normalizedKind === 'bell' ? 0.9 : 1.15,
      intensity: MathUtils.clamp(Number(intensity) || 1, 0.1, 2),
    };
    return this;
  }

  _updateEmote(dt, motion) {
    const result = { y: 0, pitch: 0, yaw: 0, roll: 0, scaleY: 0, scaleXZ: 0 };
    const emote = this._emote;
    if (!emote) return result;

    emote.age += dt;
    const t = MathUtils.clamp(emote.age / emote.duration, 0, 1);
    const envelope = Math.sin(Math.PI * t) * emote.intensity * motion;

    if (emote.kind === 'bell') {
      result.y = Math.sin(t * Math.PI * 3) * 0.035 * envelope;
      result.roll = Math.sin(t * Math.PI * 4) * 0.12 * envelope;
      result.scaleY = Math.sin(t * Math.PI) * 0.045 * envelope;
      result.scaleXZ = -result.scaleY * 0.3;
    } else if (emote.kind === 'magic') {
      result.y = Math.sin(Math.PI * t) * 0.09 * envelope;
      result.yaw = Math.sin(t * Math.PI * 2) * 0.32 * envelope;
      result.roll = Math.sin(t * Math.PI * 4) * 0.055 * envelope;
      result.scaleY = Math.sin(Math.PI * t) * 0.035 * envelope;
      result.scaleXZ = result.scaleY * 0.25;
    } else {
      result.y = Math.abs(Math.sin(t * Math.PI * 3)) * 0.065 * envelope;
      result.roll = Math.sin(t * Math.PI * 5) * 0.09 * envelope;
      result.pitch = -Math.sin(Math.PI * t) * 0.04 * envelope;
      result.scaleY = Math.sin(t * Math.PI * 3) * 0.025 * envelope;
      result.scaleXZ = -result.scaleY * 0.35;
    }

    if (t >= 1) this._emote = null;
    return result;
  }

  setMotionScale(scale) {
    this.motionScale = Math.max(0, Number(scale) || 0);
    return this;
  }

  setReducedMotion(reduced) {
    this._reducedMotion = Boolean(reduced);
    return this;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this._restoreBasePose();
    return this;
  }

  _restoreBasePose() {
    if (!this.visual) return;
    this.visual.position.copy(this._basePosition);
    this.visual.quaternion.copy(this._baseQuaternion);
    this.visual.scale.copy(this._baseScale);
  }

  dispose() {
    this._restoreBasePose();
    this.visual = null;
    this.visualRig = null;
    this._emote = null;
  }
}
