import { PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const DAY_ENVIRONMENT_INTENSITY = 0.16;
const NIGHT_ENVIRONMENT_INTENSITY = 0.08;
const ENVIRONMENT_BLUR_SIGMA = 0.04;

export function environmentIntensityForNightMix(nightMix = 0) {
  const finiteMix = Number.isFinite(nightMix) ? nightMix : 0;
  const clamped = Math.min(1, Math.max(0, finiteMix));
  const eased = clamped * clamped * (3 - 2 * clamped);
  return DAY_ENVIRONMENT_INTENSITY
    + (NIGHT_ENVIRONMENT_INTENSITY - DAY_ENVIRONMENT_INTENSITY) * eased;
}

/**
 * Bakes a small neutral reflection environment once for physically based
 * materials. It intentionally does not replace the authored ThornVale sky.
 */
export class EnvironmentLighting {
  constructor(scene, renderer, options = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.createEnvironment = options.createEnvironment || (() => new RoomEnvironment());
    this.createPMREMGenerator = options.createPMREMGenerator
      || ((activeRenderer) => new PMREMGenerator(activeRenderer));
    this.warn = options.warn || ((...args) => console.warn(...args));

    this.renderTarget = null;
    this.texture = null;
    this.previousEnvironment = null;
    this.previousIntensity = 1;
  }

  init() {
    if (this.renderTarget) return this;

    let source = null;
    let generator = null;
    let target = null;
    try {
      source = this.createEnvironment();
      generator = this.createPMREMGenerator(this.renderer);
      target = generator.fromScene(source, ENVIRONMENT_BLUR_SIGMA);
      if (!target?.texture) throw new Error('PMREM bake returned no environment texture');

      this.previousEnvironment = this.scene.environment;
      this.previousIntensity = this.scene.environmentIntensity;
      this.renderTarget = target;
      this.texture = target.texture;
      this.scene.environment = this.texture;
      this.update(0);
    } catch (error) {
      target?.dispose?.();
      this.warn('[EnvironmentLighting] Reflection environment unavailable; using direct lights.', error);
    } finally {
      try {
        source?.dispose?.();
      } finally {
        generator?.dispose?.();
      }
    }

    return this;
  }

  update(nightMix = 0) {
    if (!this.texture || this.scene.environment !== this.texture) return;
    this.scene.environmentIntensity = environmentIntensityForNightMix(nightMix);
  }

  dispose() {
    if (!this.renderTarget) return;

    if (this.scene.environment === this.texture) {
      this.scene.environment = this.previousEnvironment;
      this.scene.environmentIntensity = this.previousIntensity;
    }

    this.renderTarget.dispose?.();
    this.renderTarget = null;
    this.texture = null;
    this.previousEnvironment = null;
    this.previousIntensity = 1;
  }
}
