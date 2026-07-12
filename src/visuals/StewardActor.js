import { MathUtils, Vector3 } from 'three';
import { VisualRig } from './VisualRig.js';
import { FriendsiesAnimator } from './FriendsiesAnimator.js';

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/** A lightweight authored NPC actor for Steward fRiENDSiES #8914. */
export class StewardActor {
  constructor(scene, visual, options = {}) {
    this.scene = scene;
    this.tokenId = options.tokenId ?? 8914;
    this.position = new Vector3().fromArray(options.position || [1.4, 0.9, 9.2]);
    this.facingYaw = options.facingYaw ?? Math.PI;
    this.visualRig = new VisualRig();
    this.visualRig.group.name = `steward_${this.tokenId}_rig`;
    this.visualRig.group.userData.cameraCollision = false;
    this.visualRig.addToScene(scene);
    this.animator = null;
    this.clips = [];
    this.motion = null;
    this.visible = true;
    this._lookTarget = new Vector3();

    if (visual) this.setVisual(visual);
    this.visualRig.setFacing(this.facingYaw);
    this.visualRig.update(0, this.position, this.facingYaw);
  }

  setVisual(visual) {
    this.animator?.dispose();
    this.animator = null;
    this.visualRig.setVisual(visual, {
      autoAlign: true,
      capsuleHalfHeight: 0.55,
      capsuleRadius: 0.35,
      clearance: 0.018,
    });
    this.visualRig.group.visible = this.visible;

    if (visual?.userData?.friendsies) {
      this.animator = new FriendsiesAnimator(visual, {
        clips: this.clips,
        roles: {
          idle: 'Idle Float',
          walk: 'walk-low-arms',
          joy: 'Joy-Jumper',
          dance: 'Dance_Rumba',
        },
      });
      this.animator.setLocomotionSpeed(this.motion?.speed || 0);
      this.animator.setMoving(Boolean(this.motion), 0);
    }
    return this;
  }

  addClips(clips) {
    this.clips.push(...(Array.isArray(clips) ? clips : []));
    this.animator?.addClips(clips, {
      walk: 'walk-low-arms',
      joy: 'Joy-Jumper',
      dance: 'Dance_Rumba',
    });
    this.animator?.setLocomotionSpeed(this.motion?.speed || 0);
    this.animator?.setMoving(Boolean(this.motion), 0);
    return this;
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.visualRig.group.visible = this.visible;
    return this;
  }

  teleport(target, facingYaw = this.facingYaw) {
    this.position.fromArray(Array.isArray(target) ? target : target.toArray());
    this.facingYaw = facingYaw;
    this.motion = null;
    this.animator?.setMoving(false);
    this.visualRig.setFacing(this.facingYaw);
    this.visualRig.update(0, this.position, this.facingYaw);
    return this;
  }

  moveTo(target, options = {}) {
    const destination = Array.isArray(target) ? new Vector3().fromArray(target) : target.clone();
    const distance = destination.distanceTo(this.position);
    const duration = Math.max(0.25, options.duration ?? distance / 0.9);
    this.motion = {
      start: this.position.clone(),
      target: destination,
      age: 0,
      duration,
      speed: distance / duration,
      onComplete: options.onComplete || null,
    };
    const direction = destination.clone().sub(this.position);
    if (direction.lengthSq() > 0.0001) this.facingYaw = Math.atan2(direction.x, direction.z);
    this.animator?.setLocomotionSpeed(distance / duration);
    this.animator?.setMoving(true);
    return this;
  }

  lookAt(target) {
    if (this.motion) return this;
    this._lookTarget.copy(target).sub(this.position);
    this._lookTarget.y = 0;
    if (this._lookTarget.lengthSq() > 0.001) {
      this.facingYaw = Math.atan2(this._lookTarget.x, this._lookTarget.z);
    }
    return this;
  }

  play(role) {
    if (!this.animator) return false;
    if (role === 'joy') return this.animator.playJoy();
    if (role === 'dance') return this.animator.playDance();
    if (role === 'walk') return this.animator.setMoving(true);
    if (this.motion) return this.animator.setMoving(true);
    this.animator.setMoving(false);
    return this.animator.playIdle();
  }

  update(dt) {
    const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
    if (this.motion) {
      this.motion.age += safeDt;
      const t = MathUtils.clamp(this.motion.age / this.motion.duration, 0, 1);
      this.position.lerpVectors(this.motion.start, this.motion.target, smoothstep(t));
      if (t >= 1) {
        const complete = this.motion.onComplete;
        this.motion = null;
        this.animator?.setLocomotionSpeed(0);
        this.animator?.setMoving(false);
        complete?.();
      }
    }
    this.visualRig.update(safeDt, this.position, this.facingYaw);
    this.animator?.update(safeDt);
    if (this.animator && !this.animator.isPlayingOneShot) {
      const measuredBottomY = this.animator.getFootSoleY();
      this.visualRig.stabilizeGrounding(safeDt, this.position.y - 0.9, {
        clearance: 0.028,
        measuredBottomY,
      });
    }
    return this;
  }

  dispose() {
    this.animator?.dispose();
    this.animator = null;
    this.visualRig.removeFromScene(this.scene);
    this.visualRig.dispose();
    this.scene = null;
  }
}
