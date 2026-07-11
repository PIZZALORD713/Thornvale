import { MathUtils, Vector2 } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * A compact finishing shader: candy-color grading, a feathered vignette,
 * minuscule lens separation, and animated film grain. These effects share one
 * fullscreen pass so the presentation remains inexpensive.
 */
const KAWAII_FINISH_SHADER = {
  name: 'KawaiiFinishShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSaturation: { value: 1.12 },
    uContrast: { value: 1.04 },
    uBrightness: { value: 0.015 },
    uWarmth: { value: 0.06 },
    uNightMix: { value: 0 },
    uVignette: { value: 0.2 },
    uGrain: { value: 0.016 },
    uChromaticAberration: { value: 0.00045 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uBrightness;
    uniform float uWarmth;
    uniform float uNightMix;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uChromaticAberration;
    varying vec2 vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    void main() {
      vec2 fromCenter = vUv - 0.5;
      float radial = dot(fromCenter, fromCenter);
      vec2 fringe = fromCenter * uChromaticAberration * (0.3 + radial * 2.0);

      vec4 source = texture2D(tDiffuse, vUv);
      vec3 color = source.rgb;
      color.r = texture2D(tDiffuse, vUv + fringe).r;
      color.b = texture2D(tDiffuse, vUv - fringe).b;

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, uSaturation);
      color = (color - 0.5) * uContrast + 0.5 + uBrightness;

      vec3 dayTint = vec3(1.0 + uWarmth, 1.0, 1.0 - uWarmth * 0.55);
      vec3 nightTint = vec3(0.92, 0.97, 1.11);
      color *= mix(dayTint, nightTint, uNightMix);

      float vignette = smoothstep(0.24, 0.76, radial);
      color *= 1.0 - vignette * uVignette;

      float grain = hash21(vUv * vec2(1733.0, 997.0) + uTime * 31.7) - 0.5;
      color += grain * uGrain * (0.55 + 0.45 * (1.0 - luma));

      gl_FragColor = vec4(max(color, 0.0), source.a);
    }
  `,
};

const QUALITY = {
  low: {
    pixelRatioCap: 1,
    bloomStrength: 0.28,
    bloomRadius: 0.42,
    bloomThreshold: 0.82,
    grain: 0,
    aberration: 0,
  },
  medium: {
    pixelRatioCap: 1.5,
    bloomStrength: 0.38,
    bloomRadius: 0.52,
    bloomThreshold: 0.76,
    grain: 0.012,
    aberration: 0.0003,
  },
  high: {
    pixelRatioCap: 2,
    bloomStrength: 0.48,
    bloomRadius: 0.58,
    bloomThreshold: 0.7,
    grain: 0.016,
    aberration: 0.00045,
  },
};

/**
 * Lightweight post-processing facade with a direct-render fallback.
 *
 * Usage:
 *   const post = new PostProcessing(renderer, scene, camera).init();
 *   post.render(dt); // replaces renderer.render(scene, camera)
 */
export class PostProcessing {
  constructor(renderer, scene, camera, options = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.enabled = options.enabled !== false;
    this.quality = QUALITY[options.quality] ? options.quality : 'high';
    this.maxPixelRatio = options.maxPixelRatio ?? QUALITY[this.quality].pixelRatioCap;

    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.finishPass = null;
    this.outputPass = null;

    this.available = false;
    this._time = 0;
    this._nightMix = options.isNight ? 1 : 0;
    this._nightTarget = this._nightMix;
    this._bloomImpulse = 0;
    this._renderFailureReported = false;
    this._size = new Vector2(1, 1);

    this.settings = {
      saturation: options.saturation ?? 1.12,
      contrast: options.contrast ?? 1.04,
      brightness: options.brightness ?? 0.015,
      warmth: options.warmth ?? 0.06,
      vignette: options.vignette ?? 0.2,
      bloomStrength: options.bloomStrength ?? null,
      bloomRadius: options.bloomRadius ?? null,
      bloomThreshold: options.bloomThreshold ?? null,
    };
  }

  /** Build the pass chain. Returns this even if post-processing is unavailable. */
  init() {
    if (!this.renderer?.isWebGLRenderer || !this.scene || !this.camera) {
      this.available = false;
      return this;
    }

    try {
      const preset = QUALITY[this.quality];
      const rendererSize = this.renderer.getSize(this._size);
      const width = Math.max(1, rendererSize.x || 1);
      const height = Math.max(1, rendererSize.y || 1);

      this.composer = new EffectComposer(this.renderer);
      this.composer.setPixelRatio(this._getPixelRatio());
      this.composer.setSize(width, height);

      this.renderPass = new RenderPass(this.scene, this.camera);
      this.bloomPass = new UnrealBloomPass(
        new Vector2(width, height),
        this.settings.bloomStrength ?? preset.bloomStrength,
        this.settings.bloomRadius ?? preset.bloomRadius,
        this.settings.bloomThreshold ?? preset.bloomThreshold,
      );
      this.finishPass = new ShaderPass(KAWAII_FINISH_SHADER);
      this.outputPass = new OutputPass();

      const uniforms = this.finishPass.uniforms;
      uniforms.uSaturation.value = this.settings.saturation;
      uniforms.uContrast.value = this.settings.contrast;
      uniforms.uBrightness.value = this.settings.brightness;
      uniforms.uWarmth.value = this.settings.warmth;
      uniforms.uVignette.value = this.settings.vignette;
      uniforms.uGrain.value = preset.grain;
      uniforms.uChromaticAberration.value = preset.aberration;
      uniforms.uNightMix.value = this._nightMix;

      this.composer.addPass(this.renderPass);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(this.finishPass);
      this.composer.addPass(this.outputPass);

      this.available = true;
    } catch (error) {
      this.available = false;
      this._disposePasses();
      console.warn('[PostProcessing] Falling back to direct rendering.', error);
    }

    return this;
  }

  /** Render through the composer, or directly when unsupported/disabled. */
  render(dt = 0) {
    this.update(dt);

    if (!this.enabled || !this.available || !this.composer) {
      this.renderer?.setRenderTarget?.(null);
      this.renderer?.render?.(this.scene, this.camera);
      return false;
    }

    try {
      this.composer.render(Math.max(0, dt));
      return true;
    } catch (error) {
      this.available = false;
      if (!this._renderFailureReported) {
        this._renderFailureReported = true;
        console.warn('[PostProcessing] Composer failed; using direct rendering.', error);
      }
      this.renderer?.setRenderTarget?.(null);
      this.renderer?.render?.(this.scene, this.camera);
      return false;
    }
  }

  /** Advance transitions when rendering is handled elsewhere. */
  update(dt = 0) {
    const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
    this._time += safeDt;
    this._nightMix = MathUtils.damp(this._nightMix, this._nightTarget, 3.2, safeDt);
    this._bloomImpulse = MathUtils.damp(this._bloomImpulse, 0, 5.5, safeDt);

    if (!this.finishPass || !this.bloomPass) return;

    this.finishPass.uniforms.uTime.value = this._time;
    this.finishPass.uniforms.uNightMix.value = this._nightMix;

    const preset = QUALITY[this.quality];
    const baseStrength = this.settings.bloomStrength ?? preset.bloomStrength;
    const nightLift = 0.16 * this._nightMix;
    this.bloomPass.strength = baseStrength + nightLift + this._bloomImpulse;
  }

  /** Smoothly retune the finish for the lighting mode. */
  setDayNight(isNight, immediate = false) {
    this._nightTarget = isNight ? 1 : 0;
    if (immediate) {
      this._nightMix = this._nightTarget;
      if (this.finishPass) this.finishPass.uniforms.uNightMix.value = this._nightMix;
    }
    return this;
  }

  /** Add a short bloom accent for bells, kindness, pickups, etc. */
  pulse(amount = 0.3) {
    this._bloomImpulse = Math.min(1.2, this._bloomImpulse + Math.max(0, amount));
    return this;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    return this;
  }

  setQuality(quality) {
    if (!QUALITY[quality]) return this;
    this.quality = quality;
    const preset = QUALITY[quality];

    if (this.finishPass) {
      this.finishPass.uniforms.uGrain.value = preset.grain;
      this.finishPass.uniforms.uChromaticAberration.value = preset.aberration;
    }
    if (this.bloomPass) {
      this.bloomPass.radius = this.settings.bloomRadius ?? preset.bloomRadius;
      this.bloomPass.threshold = this.settings.bloomThreshold ?? preset.bloomThreshold;
    }

    this.resize(undefined, undefined, Math.min(this.maxPixelRatio, preset.pixelRatioCap));
    return this;
  }

  setSceneCamera(scene, camera) {
    this.scene = scene || this.scene;
    this.camera = camera || this.camera;
    if (this.renderPass) {
      this.renderPass.scene = this.scene;
      this.renderPass.camera = this.camera;
    }
    return this;
  }

  resize(width, height, pixelRatio) {
    if (!this.composer || !this.renderer) return this;

    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      this.renderer.getSize(this._size);
      width = this._size.x;
      height = this._size.y;
    }

    const ratio = Number.isFinite(pixelRatio)
      ? Math.min(Math.max(pixelRatio, 0.5), this.maxPixelRatio)
      : this._getPixelRatio();
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(Math.max(1, width), Math.max(1, height));
    return this;
  }

  _getPixelRatio() {
    const rendererRatio = this.renderer?.getPixelRatio?.() || 1;
    const qualityCap = QUALITY[this.quality].pixelRatioCap;
    return Math.min(rendererRatio, this.maxPixelRatio, qualityCap);
  }

  _disposePasses() {
    this.bloomPass?.dispose?.();
    this.finishPass?.dispose?.();
    this.outputPass?.dispose?.();
    this.composer?.dispose?.();
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.finishPass = null;
    this.outputPass = null;
  }

  dispose() {
    this.available = false;
    this._disposePasses();
  }
}

export { KAWAII_FINISH_SHADER };
