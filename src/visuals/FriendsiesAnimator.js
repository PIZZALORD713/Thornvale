import { AnimationMixer, LoopOnce, LoopRepeat, Vector3 } from 'three';

const ROLES = ['idle', 'walk', 'jump', 'fall', 'land', 'joy', 'dance'];

const DEFAULT_WALK_REFERENCE_SPEED = 4.2;
const DEFAULT_SPRINT_SPEED = 5.6;
const DEFAULT_FOOTSTEP_PHASES = Object.freeze([0.25, 0.75]);

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function asClipList(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source.filter(Boolean);
  if (Array.isArray(source.animations)) return source.animations.filter(Boolean);
  return source.tracks ? [source] : [];
}

function validClip(clip) {
  return Boolean(clip && Array.isArray(clip.tracks));
}

function safeDuration(value, fallback) {
  const duration = Number(value);
  return Number.isFinite(duration) ? Math.max(0, duration) : fallback;
}

function footstepPhases(value) {
  if (!Array.isArray(value) || value.length !== 2) return [...DEFAULT_FOOTSTEP_PHASES];
  const phases = value
    .map(Number)
    .filter((phase) => Number.isFinite(phase) && phase >= 0 && phase < 1)
    .sort((a, b) => a - b);
  if (phases.length !== 2 || phases[0] === phases[1]) return [...DEFAULT_FOOTSTEP_PHASES];
  return phases;
}

function roleScore(role, clipName) {
  const name = normalizeName(clipName);
  if (!name) return 0;
  // Authored story actions are semantic one-shots, not fallback locomotion or
  // emote roles. They remain addressable explicitly through playOneShot(name).
  if (name.startsWith('storyactionsv1')) return 0;

  if (role === 'idle') {
    if (name === 'idlefloat') return 120;
    if (name.includes('idlefloat')) return 110;
    if (name.includes('idle')) return 80;
  }
  if (role === 'walk') {
    if (name === 'walklowarms' || name === 'walkarmslow') return 130;
    if (name.includes('walklowarms') || name.includes('walkarmslow')) return 120;
    if (name === 'walk') return 100;
    if (name.includes('walk') && !name.includes('start')) return 80;
    if (name.includes('walk')) return 60;
  }
  if (role === 'jump') {
    if (name === 'friendsiesjumpascent') return 160;
    if (name.includes('jumpascent') || name.includes('takeoff')) return 140;
    if (name.includes('jump') && !name.includes('joy')) return 100;
    if (name.includes('jump')) return 60;
  }
  if (role === 'fall') {
    if (name === 'friendsiesfall') return 160;
    if (name.includes('fall') || name.includes('airborne')) return 120;
  }
  if (role === 'land') {
    if (name === 'friendsiesland') return 160;
    if (name.includes('landing') || name.includes('land')) return 120;
  }
  if (role === 'joy') {
    if (name === 'joyjumper') return 120;
    if (name.includes('joy')) return 100;
    if (name.includes('happy') || name.includes('jump')) return 70;
  }
  if (role === 'dance') {
    if (name === 'dancerumba') return 120;
    if (name.includes('rumba')) return 110;
    if (name.includes('dance')) return 90;
  }
  return 0;
}

/**
 * Skeletal animation controller for a CharacterLoader fRiENDSiES group.
 *
 * The mixer is rooted at the body's GLTF scene, leaving VisualRig and
 * PlayerAnimator free to own the assembled character's outer transform.
 */
export class FriendsiesAnimator {
  constructor(characterGroup, options = {}) {
    this.character = characterGroup || null;
    this.friendsies = characterGroup?.userData?.friendsies || null;
    this.bodyRoot = options.bodyRoot || this.friendsies?.bodyRoot || characterGroup || null;

    this.fadeDuration = safeDuration(options.fadeDuration, 0.22);
    this.oneShotFadeDuration = safeDuration(options.oneShotFadeDuration, 0.16);
    this.airFadeDuration = safeDuration(options.airFadeDuration, 0.1);
    this.landingFadeDuration = safeDuration(options.landingFadeDuration, 0.08);
    this.walkReferenceSpeed = Math.max(
      0.1,
      Number(options.walkReferenceSpeed) || DEFAULT_WALK_REFERENCE_SPEED,
    );
    this.sprintReferenceSpeed = Math.max(
      this.walkReferenceSpeed,
      Number(options.sprintReferenceSpeed) || DEFAULT_SPRINT_SPEED,
    );
    this.walkMinTimeScale = Math.max(0.1, Number(options.walkMinTimeScale) || 0.72);
    this.walkMaxTimeScale = Math.max(
      this.walkMinTimeScale,
      Number(options.walkMaxTimeScale) || (this.sprintReferenceSpeed / this.walkReferenceSpeed),
    );
    this.cadenceSharpness = Math.max(0, Number(options.cadenceSharpness) || 8);
    this.walkTimeScale = 1;
    this.walkTargetTimeScale = 1;
    this.footstepPhases = footstepPhases(options.footstepPhases);
    this.pendingFootsteps = 0;
    this.footstepTrackingActive = false;
    this.footstepCyclePosition = 0;
    this.horizontalSpeed = 0;
    this.movementStartSpeed = Math.max(0, Number(options.movementStartSpeed) || 0.32);
    this.movementStopSpeed = Math.min(
      this.movementStartSpeed,
      Math.max(0, Number(options.movementStopSpeed) || 0.16),
    );
    this.takeoffVelocityThreshold = Math.max(
      0.1,
      Number(options.takeoffVelocityThreshold) || 0.9,
    );
    this.fallVelocityThreshold = Number.isFinite(Number(options.fallVelocityThreshold))
      ? Number(options.fallVelocityThreshold)
      : -0.35;
    this.airJumpVelocityDelta = Math.max(0.1, Number(options.airJumpVelocityDelta) || 2);
    this.airborneGraceDuration = Math.max(
      0,
      Number(options.airborneGraceDuration) || 0.055,
    );
    this.gravity = Math.max(1, Math.abs(Number(options.gravity) || 20));
    this.defaultTakeoffVelocity = Math.max(
      0.1,
      Number(options.defaultTakeoffVelocity) || 8,
    );
    this.fallTimeScale = Math.max(0.1, Number(options.fallTimeScale) || 0.9);
    this.landingTimeScale = Math.max(0.1, Number(options.landingTimeScale) || 1.8);
    this.onMissingClip = typeof options.onMissingClip === 'function'
      ? options.onMissingClip
      : null;

    this.mixer = this.bodyRoot ? new AnimationMixer(this.bodyRoot) : null;
    this.clips = new Map();
    this.actions = new Map();
    this.roleClips = Object.fromEntries(ROLES.map((role) => [role, null]));
    this.roleScores = Object.fromEntries(ROLES.map((role) => [role, 0]));

    this.loopAction = null;
    this.loopRole = null;
    this.oneShotAction = null;
    this.oneShotRole = null;
    this.airAction = null;
    this.airRole = null;
    this.resumeRole = 'idle';
    this.desiredGroundRole = 'idle';
    this.locomotionState = 'idle';
    this.isAirborne = false;
    this.reportedGrounded = true;
    this.groundMoving = false;
    this.ungroundedTime = 0;
    this.verticalVelocity = 0;
    this.hasLocomotionSample = false;
    this.disposed = false;
    this.missingNotifications = new Set();
    this.footSamples = [];
    this._footPosition = new Vector3();

    this._handleMixerFinished = this._handleMixerFinished.bind(this);
    this.mixer?.addEventListener('finished', this._handleMixerFinished);

    const embedded = this.friendsies?.animations || characterGroup?.animations || [];
    this.addClips(embedded, options.roles || {});
    this.addClips(options.clips, options.roles || {});

    if (options.autoPlay !== false) this.playIdle(0);
    this._buildFootSamples(options.footSampleCount ?? 32);
  }

  get isPlayingOneShot() {
    return Boolean(this.oneShotAction);
  }

  /** Consume one authored walk-contact event. Call until it returns false. */
  consumeFootstep() {
    if (this.pendingFootsteps <= 0) return false;
    this.pendingFootsteps -= 1;
    return true;
  }

  /**
   * Register an AnimationClip, an array of clips, or a GLTF result. Optional
   * roleMap values may be clip names or AnimationClip objects.
   */
  addClips(source, roleMap = {}) {
    if (this.disposed) return this;

    for (const clip of asClipList(source)) this._registerClip(clip);

    const explicitRoles = roleMap?.roles || roleMap || {};
    for (const role of ROLES) {
      if (explicitRoles[role] !== undefined) {
        this.assignClip(role, explicitRoles[role]);
      }
    }

    return this;
  }

  /** Explicitly assign a registered clip (or new AnimationClip) to a role. */
  assignClip(role, clipOrName) {
    if (this.disposed || !ROLES.includes(role)) return false;

    let clip = null;
    if (validClip(clipOrName)) {
      clip = this._registerClip(clipOrName);
    } else {
      clip = this.clips.get(normalizeName(clipOrName)) || null;
    }
    if (!clip) return false;

    this.roleClips[role] = clip;
    this.roleScores[role] = Number.POSITIVE_INFINITY;
    this.missingNotifications.delete(role);
    return true;
  }

  getClip(roleOrName) {
    if (!roleOrName) return null;
    if (validClip(roleOrName)) return roleOrName;
    if (ROLES.includes(roleOrName)) return this.roleClips[roleOrName] || null;
    return this.clips.get(normalizeName(roleOrName)) || null;
  }

  getAction(roleOrName) {
    const clip = this.getClip(roleOrName);
    if (!clip || !this.mixer) return null;

    let action = this.actions.get(clip);
    if (!action) {
      action = this.mixer.clipAction(clip);
      this.actions.set(clip, action);
    }
    return action;
  }

  playIdle(fadeDuration = this.fadeDuration) {
    return this._playLoop('idle', fadeDuration);
  }

  playWalk(fadeDuration = this.fadeDuration) {
    if (!this.roleClips.walk) {
      this._notifyMissing('walk');
      if (!this.loopAction && this.roleClips.idle) this.playIdle(fadeDuration);
      return false;
    }
    return this._playLoop('walk', fadeDuration);
  }

  /**
   * Crossfade between idle and walk. While a one-shot is active, this queues
   * the locomotion state that should resume when the one-shot completes.
   */
  setMoving(moving, fadeDuration = this.fadeDuration) {
    const requestedRole = moving ? 'walk' : 'idle';
    const availableRole = this.roleClips[requestedRole]
      ? requestedRole
      : (this.roleClips.idle ? 'idle' : null);

    if (!availableRole) {
      this._notifyMissing(requestedRole);
      return false;
    }
    if (availableRole !== requestedRole) this._notifyMissing(requestedRole);

    this.groundMoving = Boolean(moving);
    this.desiredGroundRole = availableRole;
    if (this.oneShotAction || this.airAction || this.isAirborne) {
      this.resumeRole = availableRole;
      return availableRole === requestedRole;
    }

    const played = this._playLoop(availableRole, fadeDuration);
    return played && availableRole === requestedRole;
  }

  /** Match walk playback to world velocity to reduce visible foot sliding. */
  setLocomotionSpeed(speed, options = {}) {
    const referenceSpeed = Math.max(
      0.1,
      Number(options.referenceSpeed) || this.walkReferenceSpeed,
    );
    const minScale = Math.max(0.1, Number(options.minScale) || this.walkMinTimeScale);
    const maxScale = Math.max(minScale, Number(options.maxScale) || this.walkMaxTimeScale);
    this.horizontalSpeed = Math.max(0, Number(speed) || 0);
    const requested = this.horizontalSpeed / referenceSpeed;
    this.walkTargetTimeScale = Math.min(maxScale, Math.max(minScale, requested));
    return this;
  }

  /**
   * Drive the authored animation state machine from the same physical state as
   * the character motor. `dt` is used only for contact-loss grace; mixer time
   * continues to advance through update().
   *
   * @param {{phase?: 'grounded'|'rising'|'falling'|'landing', speed?: number,
   *   horizontalSpeed?: number, grounded?: boolean, isGrounded?: boolean,
   *   velocityY?: number, verticalVelocity?: number, justJumped?: boolean,
   *   justLanded?: boolean, justLeftGround?: boolean, landingSpeed?: number,
   *   gravity?: number, dt?: number, delta?: number}} state
   * @param {number} [deltaTime]
   */
  updateLocomotion(state = {}, deltaTime) {
    if (this.disposed) return this;

    const speed = state.horizontalSpeed ?? state.speed ?? this.horizontalSpeed;
    const grounded = Boolean(state.grounded ?? state.isGrounded ?? this.reportedGrounded);
    const velocityY = Number(state.velocityY ?? state.verticalVelocity ?? this.verticalVelocity) || 0;
    const dt = Math.min(
      0.1,
      Math.max(0, Number(deltaTime ?? state.dt ?? state.delta) || (1 / 60)),
    );
    const gravity = Math.max(1, Math.abs(Number(state.gravity) || this.gravity));
    const previousVelocityY = this.verticalVelocity;
    const phase = String(state.phase || '');
    const phaseIsRising = phase === 'rising';
    const phaseIsFalling = phase === 'falling';
    const phaseIsLanding = phase === 'landing';
    const hasExplicitPhase = phaseIsRising || phaseIsFalling || phaseIsLanding || phase === 'grounded';
    const justJumped = Boolean(state.justJumped);
    const justLanded = Boolean(state.justLanded);

    this.setLocomotionSpeed(speed);
    this.groundMoving = this.groundMoving
      ? this.horizontalSpeed > this.movementStopSpeed
      : this.horizontalSpeed > this.movementStartSpeed;
    this.desiredGroundRole = this.groundMoving && this.roleClips.walk
      ? 'walk'
      : (this.roleClips.idle ? 'idle' : 'walk');
    this.resumeRole = this.desiredGroundRole;

    this.reportedGrounded = grounded;
    this.verticalVelocity = velocityY;
    this.ungroundedTime = grounded ? 0 : this.ungroundedTime + dt;

    const tookOff = justJumped || phaseIsRising || velocityY > this.takeoffVelocityThreshold;
    const airJumped = this.isAirborne
      && (
        justJumped
        || (
          velocityY > this.takeoffVelocityThreshold
          && velocityY - previousVelocityY > this.airJumpVelocityDelta
        )
      );
    const takeoffVelocity = Math.max(
      this.defaultTakeoffVelocity,
      velocityY > 0 ? velocityY : 0,
    );

    if (justLanded || (this.isAirborne && (grounded || phaseIsLanding))) {
      this.isAirborne = false;
      this._playLanding(Number(state.landingSpeed) || 0);
    } else if (!this.isAirborne && (!grounded || phaseIsRising || phaseIsFalling)) {
      const contactLossConfirmed = hasExplicitPhase
        ? (phaseIsRising || phaseIsFalling)
        : this.ungroundedTime >= this.airborneGraceDuration;
      if (tookOff || contactLossConfirmed) {
        this.isAirborne = true;
        if (tookOff) this._playAirRole('jump', this._ascentTimeScale(takeoffVelocity, gravity));
        else this._playAirRole('fall', this.fallTimeScale);
      }
    } else if (this.isAirborne) {
      if (airJumped) {
        this._playAirRole('jump', this._ascentTimeScale(takeoffVelocity, gravity));
      } else if (
        (phaseIsFalling || velocityY <= this.fallVelocityThreshold)
        && this.airRole !== 'fall'
      ) {
        this._playAirRole('fall', this.fallTimeScale);
      }
    } else if (this.oneShotAction) {
      this.resumeRole = this.desiredGroundRole;
    } else {
      this._playLoop(this.desiredGroundRole, this.fadeDuration);
    }

    this.hasLocomotionSample = true;
    return this;
  }

  /** World-space lowest sampled sole vertex after the current skeletal pose. */
  getFootSoleY() {
    if (this.disposed || this.footSamples.length === 0 || !this.character) return null;
    this.character.updateWorldMatrix(true, true);
    let minimum = Number.POSITIVE_INFINITY;
    for (const sample of this.footSamples) {
      sample.mesh
        .getVertexPosition(sample.index, this._footPosition)
        .applyMatrix4(sample.mesh.matrixWorld);
      minimum = Math.min(minimum, this._footPosition.y);
    }
    return Number.isFinite(minimum) ? minimum : null;
  }

  playJoy(options = {}) {
    return this.playOneShot('joy', options);
  }

  playDance(options = {}) {
    return this.playOneShot('dance', options);
  }

  playLanding(options = {}) {
    return this.playOneShot('land', {
      returnTo: this.desiredGroundRole,
      timeScale: this.landingTimeScale,
      fadeDuration: this.landingFadeDuration,
      ...options,
    });
  }

  playOneShot(roleOrName, options = {}) {
    if (this.disposed || !this.mixer) return false;

    const action = this.getAction(roleOrName);
    if (!action) {
      this._notifyMissing(roleOrName);
      return false;
    }

    const fadeDuration = safeDuration(options?.fadeDuration, this.oneShotFadeDuration);
    const requestedResume = options?.returnTo || this.loopRole || 'idle';
    this.resumeRole = this.getClip(requestedResume)
      ? requestedResume
      : (this.roleClips.idle ? 'idle' : requestedResume);

    this._resetFootsteps();
    const previous = options?.sourceAction
      || this.oneShotAction
      || this.airAction
      || this.loopAction;
    const timeScale = Math.max(0.1, Number(options?.timeScale) || 1);
    action.reset();
    action.enabled = true;
    action.clampWhenFinished = true;
    action.setLoop(LoopOnce, 1);
    action.setEffectiveTimeScale(timeScale);
    action.setEffectiveWeight(1);
    action.play();

    if (previous && previous !== action) {
      if (fadeDuration > 0) previous.crossFadeTo(action, fadeDuration, false);
      else previous.stop();
    } else if (!previous && fadeDuration > 0) {
      action.fadeIn(fadeDuration);
    }

    this.oneShotAction = action;
    this.oneShotRole = ROLES.includes(roleOrName) ? roleOrName : action.getClip().name;
    this.airAction = null;
    this.airRole = null;
    this.locomotionState = this.oneShotRole;
    return true;
  }

  cancelOneShot(roleOrName = null, options = {}) {
    if (this.disposed || !this.oneShotAction) return false;

    const action = this.oneShotAction;
    if (roleOrName) {
      const expected = this.getClip(roleOrName);
      if (!expected || action.getClip() !== expected) return false;
    }

    const requestedResume = options?.returnTo || this.resumeRole || this.desiredGroundRole;
    const resume = this.getClip(requestedResume)
      ? requestedResume
      : (this.roleClips.idle ? 'idle' : null);
    const fadeDuration = safeDuration(options?.fadeDuration, this.oneShotFadeDuration);
    if (resume && this._playLoop(resume, fadeDuration, action)) return true;

    action.stop();
    this.oneShotAction = null;
    this.oneShotRole = null;
    this.locomotionState = this.loopRole || this.desiredGroundRole || 'idle';
    return true;
  }

  update(dt) {
    if (this.disposed || !this.mixer) return this;
    const delta = Number(dt);
    if (Number.isFinite(delta) && delta > 0) {
      const safeDelta = Math.min(delta, 0.1);
      const cadenceAlpha = 1 - Math.exp(-this.cadenceSharpness * safeDelta);
      this.walkTimeScale += (this.walkTargetTimeScale - this.walkTimeScale) * cadenceAlpha;
      this.getAction('walk')?.setEffectiveTimeScale(this.walkTimeScale);
      this.mixer.update(safeDelta);
      this._updateFootsteps(safeDelta);
    }
    return this;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;

    if (this.mixer) {
      this.mixer.removeEventListener('finished', this._handleMixerFinished);
      this.mixer.stopAllAction();
      if (this.bodyRoot) this.mixer.uncacheRoot(this.bodyRoot);
    }

    this.clips.clear();
    this.actions.clear();
    this.missingNotifications.clear();
    this.footSamples.length = 0;
    for (const role of ROLES) this.roleClips[role] = null;

    this.loopAction = null;
    this.oneShotAction = null;
    this.oneShotRole = null;
    this.airAction = null;
    this.airRole = null;
    this._resetFootsteps();
    this.mixer = null;
    this.bodyRoot = null;
    this.character = null;
    this.friendsies = null;
  }

  _registerClip(clip) {
    if (!validClip(clip)) return null;

    const key = normalizeName(clip.name) || normalizeName(clip.uuid);
    if (!key) return null;
    this.clips.set(key, clip);

    for (const role of ROLES) {
      const score = roleScore(role, clip.name);
      if (score > this.roleScores[role]) {
        this.roleScores[role] = score;
        this.roleClips[role] = clip;
        this.missingNotifications.delete(role);
      }
    }

    return clip;
  }

  _buildFootSamples(sampleCount) {
    if (!this.character) return;
    const perSide = Math.max(8, Math.min(64, Math.round(Number(sampleCount) || 32)));
    this.character.updateWorldMatrix(true, true);

    this.character.traverse((mesh) => {
      const geometry = mesh.geometry;
      const skinIndex = geometry?.attributes?.skinIndex;
      const skinWeight = geometry?.attributes?.skinWeight;
      if (!mesh.isSkinnedMesh || !skinIndex || !skinWeight || !mesh.getVertexPosition) return;

      const candidates = { left: [], right: [] };
      const bones = mesh.skeleton?.bones || [];
      const count = geometry.attributes.position?.count || 0;
      for (let index = 0; index < count; index += 1) {
        const indices = [
          skinIndex.getX(index),
          skinIndex.getY(index),
          skinIndex.getZ(index),
          skinIndex.getW(index),
        ];
        const weights = [
          skinWeight.getX(index),
          skinWeight.getY(index),
          skinWeight.getZ(index),
          skinWeight.getW(index),
        ];
        let leftWeight = 0;
        let rightWeight = 0;
        for (let component = 0; component < 4; component += 1) {
          const boneName = normalizeName(bones[indices[component]]?.name);
          const weight = Number(weights[component]) || 0;
          if (boneName === 'thighl' || boneName === 'shinl' || boneName === 'toel') {
            leftWeight += weight;
          }
          if (boneName === 'thighr' || boneName === 'shinr' || boneName === 'toer') {
            rightWeight += weight;
          }
        }

        const side = leftWeight >= rightWeight ? 'left' : 'right';
        if (Math.max(leftWeight, rightWeight) < 0.2) continue;
        mesh.getVertexPosition(index, this._footPosition).applyMatrix4(mesh.matrixWorld);
        candidates[side].push({ mesh, index, y: this._footPosition.y });
      }

      for (const side of ['left', 'right']) {
        candidates[side].sort((a, b) => a.y - b.y);
        this.footSamples.push(
          ...candidates[side].slice(0, perSide).map(({ index }) => ({ mesh, index })),
        );
      }
    });
  }

  _updateFootsteps(dt) {
    const walkAction = this.getAction('walk');
    const clipDuration = walkAction?.getClip()?.duration;
    const active = (
      this.locomotionState === 'walk'
      && this.loopRole === 'walk'
      && this.loopAction === walkAction
      && !this.oneShotAction
      && !this.airAction
      && this.reportedGrounded
      && walkAction?.isRunning()
      && Number.isFinite(clipDuration)
      && clipDuration > 0
    );

    if (!active) {
      this._resetFootsteps();
      return;
    }

    if (!this.footstepTrackingActive) {
      this.footstepTrackingActive = true;
      this.footstepCyclePosition = walkAction.time / clipDuration;
      this.pendingFootsteps = 0;
      return;
    }

    const previous = this.footstepCyclePosition;
    const next = previous + (Math.max(0, Number(dt) || 0) * this.walkTimeScale / clipDuration);
    let crossings = 0;
    for (const phase of this.footstepPhases) {
      const firstCycle = Math.floor(previous - phase) + 1;
      const lastCycle = Math.floor(next - phase);
      if (lastCycle >= firstCycle) crossings += lastCycle - firstCycle + 1;
    }
    this.pendingFootsteps += crossings;
    this.footstepCyclePosition = next;
  }

  _resetFootsteps() {
    this.pendingFootsteps = 0;
    this.footstepTrackingActive = false;
    this.footstepCyclePosition = 0;
  }

  _ascentTimeScale(velocityY, gravity) {
    const clipDuration = this.roleClips.jump?.duration || 0.6;
    const ascentDuration = Math.min(
      0.8,
      Math.max(0.2, Math.max(0, Number(velocityY) || 0) / Math.max(1, gravity)),
    );
    return Math.min(3, Math.max(0.5, clipDuration / ascentDuration));
  }

  _playAirRole(role, timeScale) {
    if (this.disposed || !this.mixer) return false;
    this._resetFootsteps();

    const action = this.getAction(role);
    if (!action) {
      this._notifyMissing(role);
      this.airRole = role;
      this.locomotionState = role;
      return false;
    }

    if (action === this.airAction && this.airRole === role) {
      action.setEffectiveTimeScale(Math.max(0.1, Number(timeScale) || 1));
      return true;
    }

    const previous = this.oneShotAction || this.airAction || this.loopAction;
    action.reset();
    action.enabled = true;
    action.clampWhenFinished = true;
    action.setLoop(LoopOnce, 1);
    action.setEffectiveTimeScale(Math.max(0.1, Number(timeScale) || 1));
    action.setEffectiveWeight(1);
    action.play();

    if (previous && previous !== action) {
      if (this.airFadeDuration > 0) previous.crossFadeTo(action, this.airFadeDuration, false);
      else previous.stop();
    } else if (!previous && this.airFadeDuration > 0) {
      action.fadeIn(this.airFadeDuration);
    }

    this.airAction = action;
    this.airRole = role;
    this.oneShotAction = null;
    this.oneShotRole = null;
    this.locomotionState = role;
    return true;
  }

  _playLanding(landingSpeed = 0) {
    const sourceAction = this.airAction;
    this.airAction = null;
    this.airRole = null;

    if (this.roleClips.land) {
      const impactScale = Math.min(
        1.2,
        Math.max(0.85, (Number(landingSpeed) || 0) / this.defaultTakeoffVelocity),
      );
      return this.playLanding({
        sourceAction,
        timeScale: this.landingTimeScale * impactScale,
      });
    }

    this._notifyMissing('land');
    return this._playLoop(this.desiredGroundRole, this.landingFadeDuration, sourceAction);
  }

  _playLoop(roleOrName, fadeDuration, sourceAction = null) {
    if (this.disposed || !this.mixer) return false;

    const action = this.getAction(roleOrName);
    if (!action) {
      this._notifyMissing(roleOrName);
      return false;
    }

    if (
      action === this.loopAction
      && !this.oneShotAction
      && !this.airAction
      && !sourceAction
    ) {
      action.enabled = true;
      action.setEffectiveTimeScale(
        action.getClip() === this.roleClips.walk ? this.walkTimeScale : 1,
      );
      action.play();
      this.locomotionState = ROLES.includes(roleOrName) ? roleOrName : action.getClip().name;
      return true;
    }

    const duration = safeDuration(fadeDuration, this.fadeDuration);
    const previous = sourceAction || this.oneShotAction || this.airAction || this.loopAction;
    this._resetFootsteps();

    action.reset();
    action.enabled = true;
    action.clampWhenFinished = false;
    action.setLoop(LoopRepeat, Number.POSITIVE_INFINITY);
    action.setEffectiveTimeScale(
      action.getClip() === this.roleClips.walk ? this.walkTimeScale : 1,
    );
    action.setEffectiveWeight(1);
    action.play();

    if (previous && previous !== action) {
      if (duration > 0) previous.crossFadeTo(action, duration, false);
      else previous.stop();
    } else if (!previous && duration > 0) {
      action.fadeIn(duration);
    }

    this.loopAction = action;
    this.loopRole = ROLES.includes(roleOrName) ? roleOrName : action.getClip().name;
    this.oneShotAction = null;
    this.oneShotRole = null;
    this.airAction = null;
    this.airRole = null;
    this.locomotionState = this.loopRole;
    return true;
  }

  _handleMixerFinished(event) {
    if (!this.oneShotAction || event?.action !== this.oneShotAction) return;

    const finishedAction = this.oneShotAction;
    const resume = this.getClip(this.resumeRole)
      ? this.resumeRole
      : (this.roleClips.idle ? 'idle' : null);

    if (!resume || !this._playLoop(resume, this.oneShotFadeDuration, finishedAction)) {
      finishedAction.stop();
      this.oneShotAction = null;
      this.oneShotRole = null;
    }
  }

  _notifyMissing(roleOrName) {
    const key = String(roleOrName || 'unknown');
    if (this.missingNotifications.has(key)) return;
    this.missingNotifications.add(key);

    try {
      this.onMissingClip?.(key, this);
    } catch {
      // Missing animation hooks are diagnostic only and must not break play.
    }
  }
}
