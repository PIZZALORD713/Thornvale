import {
  BackSide,
  Color,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import { advanceGrainSeed } from './grainSeed.js';

const vertexShader = /* glsl */`
  varying vec3 vDirection;

  void main() {
    vDirection = normalize(position);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = /* glsl */`
  precision highp float;

  varying vec3 vDirection;
  uniform float uTime;
  uniform float uGrainSeed;
  uniform float uNightMix;
  uniform float uWhiteout;
  uniform vec3 uDayTop;
  uniform vec3 uDayHorizon;
  uniform vec3 uNightTop;
  uniform vec3 uNightHorizon;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    vec3 dir = normalize(vDirection);
    float height = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    float skyCurve = smoothstep(0.12, 0.92, height);

    vec3 dayColor = mix(uDayHorizon, uDayTop, skyCurve);
    dayColor += vec3(1.0, 0.52, 0.72) * pow(1.0 - abs(dir.y - 0.02), 12.0) * 0.08;

    vec3 nightColor = mix(uNightHorizon, uNightTop, skyCurve);
    float auroraBand = sin(dir.x * 13.0 + uTime * 0.08 + sin(dir.z * 8.0)) * 0.5 + 0.5;
    auroraBand *= smoothstep(0.05, 0.5, dir.y) * smoothstep(0.95, 0.38, dir.y);
    nightColor += mix(vec3(0.12, 0.26, 0.34), vec3(0.42, 0.22, 0.52), auroraBand) * auroraBand * 0.17;

    vec2 starGrid = floor(vec2(atan(dir.z, dir.x), asin(dir.y)) * vec2(220.0, 160.0));
    float starSeed = hash21(starGrid);
    float twinkle = 0.65 + 0.35 * sin(uTime * (1.2 + starSeed * 2.2) + starSeed * 30.0);
    float stars = step(0.988, starSeed) * twinkle * smoothstep(-0.02, 0.28, dir.y);
    nightColor += vec3(0.95, 0.92, 1.0) * stars;

    vec3 color = mix(dayColor, nightColor, uNightMix);
    float horizonGlow = pow(1.0 - abs(dir.y), 10.0);
    color += mix(vec3(1.0, 0.72, 0.54), vec3(0.25, 0.22, 0.48), uNightMix) * horizonGlow * 0.12;

    float grain = hash21(gl_FragCoord.xy + floor(uGrainSeed)) - 0.5;
    color += grain * 0.006;
    gl_FragColor = vec4(mix(color, vec3(0.97, 0.99, 1.0), uWhiteout), 1.0);
  }
`;

export class KawaiiSky {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.material = null;
    this._grainSeed = 0;
  }

  init() {
    this.material = new ShaderMaterial({
      name: 'KawaiiSkyMaterial',
      side: BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uGrainSeed: { value: this._grainSeed },
        uNightMix: { value: 0 },
        uWhiteout: { value: 0 },
        uDayTop: { value: new Color(0x7fc8ff) },
        uDayHorizon: { value: new Color(0xffd5dc) },
        uNightTop: { value: new Color(0x100e2b) },
        uNightHorizon: { value: new Color(0x4d376a) },
      },
      vertexShader,
      fragmentShader,
    });

    this.mesh = new Mesh(new SphereGeometry(88, 40, 24), this.material);
    this.mesh.name = 'kawaiiSkyDome';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1000;
    this.mesh.userData.cameraCollision = false;
    this.scene.add(this.mesh);
    return this;
  }

  update(dt, nightMix = 0) {
    if (!this.material) return;
    this.material.uniforms.uTime.value += dt;
    this._grainSeed = advanceGrainSeed(this._grainSeed, dt, 5);
    this.material.uniforms.uGrainSeed.value = this._grainSeed;
    this.material.uniforms.uNightMix.value +=
      (nightMix - this.material.uniforms.uNightMix.value) * Math.min(1, dt * 2.5);
  }

  dispose() {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh = null;
    this.material = null;
  }
}
