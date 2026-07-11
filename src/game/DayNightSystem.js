import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PointLight,
  SphereGeometry,
  Vector3,
} from 'three';

const DAY = {
  background: new Color(0xaedcff),
  fog: new Color(0xd8efff),
  ambient: new Color(0xfff6ed),
  hemiSky: new Color(0xbfe5ff),
  hemiGround: new Color(0x88a86f),
  sun: new Color(0xffddb0),
};

const NIGHT = {
  background: new Color(0x17152f),
  fog: new Color(0x2a2449),
  ambient: new Color(0x796cba),
  hemiSky: new Color(0x514c94),
  hemiGround: new Color(0x171629),
  sun: new Color(0x9eb6ff),
};

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

export class DayNightSystem {
  constructor(scene) {
    this.scene = scene;
    this.isNight = false;
    this.mix = 0;
    this.targetMix = 0;
    this.transitionSpeed = 0.42;

    this.ambient = null;
    this.hemi = null;
    this.sun = null;
    this.moon = null;
    this.celestials = null;
    this.sunOrb = null;
    this.moonOrb = null;
    this._background = new Color(DAY.background);
    this._sunDayPos = new Vector3(18, 24, 12);
    this._sunNightPos = new Vector3(-14, 19, -10);
  }

  init() {
    this.ambient = new AmbientLight(DAY.ambient, 0.58);
    this.hemi = new HemisphereLight(DAY.hemiSky, DAY.hemiGround, 0.96);

    this.sun = new DirectionalLight(DAY.sun, 1.72);
    this.sun.position.copy(this._sunDayPos);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 90;
    this.sun.shadow.camera.left = -32;
    this.sun.shadow.camera.right = 32;
    this.sun.shadow.camera.top = 32;
    this.sun.shadow.camera.bottom = -32;
    this.sun.shadow.bias = -0.00012;
    this.sun.shadow.normalBias = 0.025;

    this.moon = new DirectionalLight(0x9db8ff, 0);
    this.moon.position.copy(this._sunNightPos);
    this.moon.castShadow = false;

    const heartLight = new PointLight(0xffc9df, 0.42, 26, 2);
    heartLight.position.set(0, 8, 2);
    heartLight.name = 'cozyFillLight';

    this.celestials = new Group();
    this.celestials.name = 'celestialOrbs';
    this.sunOrb = new Mesh(
      new SphereGeometry(1.8, 24, 16),
      new MeshBasicMaterial({ color: 0xfff1b7, fog: false, transparent: true, opacity: 0.94 }),
    );
    this.sunOrb.position.copy(this._sunDayPos).multiplyScalar(2.15);
    this.sunOrb.name = 'sunOrb';

    this.moonOrb = new Mesh(
      new SphereGeometry(1.35, 24, 16),
      new MeshBasicMaterial({ color: 0xd9dcff, fog: false, transparent: true, opacity: 0 }),
    );
    this.moonOrb.position.copy(this._sunNightPos).multiplyScalar(2.1);
    this.moonOrb.name = 'moonOrb';
    this.celestials.add(this.sunOrb, this.moonOrb);

    this.scene.add(this.ambient, this.hemi, this.sun, this.moon, heartLight, this.celestials);
    this.scene.background = this._background;
    this.scene.fog = new Fog(DAY.fog, 34, 96);
    this.applyDay(true);
    return this;
  }

  toggle() {
    if (this.isNight) {
      this.applyDay();
      return 'DAY';
    }
    this.applyNight();
    return 'NIGHT';
  }

  applyDay(immediate = false) {
    this.isNight = false;
    this.targetMix = 0;
    if (immediate) this.mix = 0;
    this._apply(this.mix);
  }

  applyNight(immediate = false) {
    this.isNight = true;
    this.targetMix = 1;
    if (immediate) this.mix = 1;
    this._apply(this.mix);
  }

  update(dt) {
    if (Math.abs(this.targetMix - this.mix) < 0.0005) {
      this.mix = this.targetMix;
      return;
    }

    const direction = Math.sign(this.targetMix - this.mix);
    this.mix = Math.min(1, Math.max(0, this.mix + direction * this.transitionSpeed * dt));
    this._apply(smoothstep(this.mix));
  }

  _apply(t) {
    this._background.copy(DAY.background).lerp(NIGHT.background, t);
    if (this.scene.fog) {
      this.scene.fog.color.copy(DAY.fog).lerp(NIGHT.fog, t);
      this.scene.fog.near = 34 - t * 16;
      this.scene.fog.far = 96 - t * 34;
    }

    this.ambient.color.copy(DAY.ambient).lerp(NIGHT.ambient, t);
    this.ambient.intensity = 0.58 - t * 0.2;

    this.hemi.color.copy(DAY.hemiSky).lerp(NIGHT.hemiSky, t);
    this.hemi.groundColor.copy(DAY.hemiGround).lerp(NIGHT.hemiGround, t);
    this.hemi.intensity = 0.96 - t * 0.28;

    this.sun.color.copy(DAY.sun).lerp(NIGHT.sun, t);
    this.sun.intensity = 1.72 - t * 1.45;
    this.sun.position.copy(this._sunDayPos).lerp(this._sunNightPos, t);

    this.moon.intensity = t * 1.28;
    this.sunOrb.material.opacity = 0.94 * (1 - t);
    this.moonOrb.material.opacity = 0.88 * t;
    this.celestials.rotation.z = t * -0.18;
  }
}
