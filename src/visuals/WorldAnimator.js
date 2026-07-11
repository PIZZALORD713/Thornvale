import { MathUtils } from 'three';

/**
 * Tiny animation registry for procedural world props.
 *
 * The world deliberately owns its ambient motion instead of coupling dozens of
 * props to the main game loop. Call `update(dt, isNight)` once per frame.
 */
export class WorldAnimator {
  constructor() {
    this.elapsed = 0;
    this.nightMix = 0;
    this.animations = [];
  }

  add(animation) {
    if (typeof animation === 'function') {
      this.animations.push(animation);
    }
    return animation;
  }

  registerSway(object, {
    speed = 1,
    amount = 0.025,
    phase = Math.random() * Math.PI * 2,
    axis = 'z',
  } = {}) {
    const baseRotation = object.rotation[axis];
    return this.add((time) => {
      object.rotation[axis] = baseRotation + Math.sin(time * speed + phase) * amount;
    });
  }

  registerBob(object, {
    speed = 1,
    amount = 0.08,
    phase = Math.random() * Math.PI * 2,
  } = {}) {
    const baseY = object.position.y;
    return this.add((time) => {
      object.position.y = baseY + Math.sin(time * speed + phase) * amount;
    });
  }

  registerSpin(object, { speed = 0.1 } = {}) {
    return this.add((_time, dt) => {
      object.rotation.y += dt * speed;
    });
  }

  registerCloud(object, {
    speed = 0.25,
    minX = -38,
    maxX = 38,
  } = {}) {
    return this.add((_time, dt) => {
      object.position.x += speed * dt;
      if (object.position.x > maxX) object.position.x = minX;
      if (object.position.x < minX) object.position.x = maxX;
    });
  }

  registerGlow(material, lights = [], {
    dayIntensity = 0.18,
    nightIntensity = 2.6,
    lightIntensity = 1.4,
    pulse = 0.08,
    speed = 1.6,
  } = {}) {
    return this.add((time, _dt, state) => {
      const shimmer = 1 + Math.sin(time * speed) * pulse;
      material.emissiveIntensity = MathUtils.lerp(
        dayIntensity,
        nightIntensity * shimmer,
        state.nightMix,
      );
      for (const light of lights) {
        light.intensity = lightIntensity * state.nightMix * shimmer;
      }
    });
  }

  /**
   * @param {number} dt Delta time in seconds.
   * @param {boolean|{isNight?: boolean}} nightState Current lighting state.
   */
  update(dt, nightState = false) {
    const safeDt = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), 0.1);
    const isNight = typeof nightState === 'boolean'
      ? nightState
      : Boolean(nightState?.isNight);

    this.elapsed += safeDt;
    const targetNight = isNight ? 1 : 0;
    this.nightMix = MathUtils.damp(this.nightMix, targetNight, 2.4, safeDt);

    const state = { isNight, nightMix: this.nightMix };
    for (const animation of this.animations) {
      animation(this.elapsed, safeDt, state);
    }
  }

  clear() {
    this.animations.length = 0;
  }
}
