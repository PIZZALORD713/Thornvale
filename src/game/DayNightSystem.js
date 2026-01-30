import * as THREE from 'three';

export class DayNightSystem {
  constructor(scene) {
    this.scene = scene;
    this.isNight = false;

    this.ambient = null;
    this.hemi = null;
    this.sun = null;
    this.fog = null;
  }

  init() {
    this.ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.hemi = new THREE.HemisphereLight(0xbcd6ff, 0x6b5f55, 0.6);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.0);
    this.sun.position.set(12, 18, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 2048;
    this.sun.shadow.mapSize.height = 2048;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 60;
    this.sun.shadow.camera.left = -25;
    this.sun.shadow.camera.right = 25;
    this.sun.shadow.camera.top = 25;
    this.sun.shadow.camera.bottom = -25;

    this.scene.add(this.ambient, this.hemi, this.sun);
    this.applyDay();
  }

  toggle() {
    this.isNight = !this.isNight;
    if (this.isNight) {
      this.applyNight();
      return 'NIGHT';
    }

    this.applyDay();
    return 'DAY';
  }

  applyDay() {
    this.isNight = false;
    this.scene.background = new THREE.Color(0xa7d2ff);
    this.ambient.color.set(0xffffff);
    this.ambient.intensity = 0.6;
    this.hemi.color.set(0xbcd6ff);
    this.hemi.groundColor.set(0x7a6a5b);
    this.hemi.intensity = 0.6;
    this.sun.color.set(0xfff1d6);
    this.sun.intensity = 1.0;
    this.sun.position.set(12, 18, 8);
    this.scene.fog = null;
  }

  applyNight() {
    this.isNight = true;
    this.scene.background = new THREE.Color(0x0b1224);
    this.ambient.color.set(0x223355);
    this.ambient.intensity = 0.18;
    this.hemi.color.set(0x1c2b4a);
    this.hemi.groundColor.set(0x0b0f1b);
    this.hemi.intensity = 0.35;
    this.sun.color.set(0x9bb7ff);
    this.sun.intensity = 0.35;
    this.sun.position.set(-8, 14, -6);
    this.scene.fog = new THREE.Fog(0x0b1020, 12, 60);
  }
}
