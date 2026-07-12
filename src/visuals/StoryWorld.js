import {
  Color,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from 'three';
import { TOWN_LAYOUT } from '../config/town.js';

export const STORY_ROUTES = Object.fromEntries(
  Object.entries(TOWN_LAYOUT.storyRoutes).map(([id, points]) => [
    id,
    points.map(([x, y, z]) => new Vector3(x, y, z)),
  ]),
);

const ROUTE_STYLE = {
  comply: { color: 0xffd28c, emissive: 0xffa85f },
  alter: { color: 0xbec8ff, emissive: 0x796dff },
};

function samplePolyline(points, t, target) {
  const clamped = Math.max(0, Math.min(0.999999, t));
  let totalLength = 0;
  const lengths = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = points[index].distanceTo(points[index + 1]);
    lengths.push(length);
    totalLength += length;
  }

  let remaining = clamped * totalLength;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      return target.copy(points[index]).lerp(
        points[index + 1],
        lengths[index] > 0 ? remaining / lengths[index] : 0,
      );
    }
    remaining -= lengths[index];
  }
  return target.copy(points.at(-1));
}

/** Story-only world dressing: route consequence and ledger mood. */
export class StoryWorld {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.reducedMotion = Boolean(options.reducedMotion);
    this.group = new Group();
    this.group.name = 'story_world_consequences';
    this.group.userData.cameraCollision = false;
    this.routes = new Map();
    this.activeRoute = null;
    this.time = 0;
    this._dummy = new Object3D();
    this._position = new Vector3();
  }

  init() {
    const geometry = new SphereGeometry(0.075, 8, 6);
    for (const [id, style] of Object.entries(ROUTE_STYLE)) {
      const material = new MeshStandardMaterial({
        color: style.color,
        emissive: new Color(style.emissive),
        emissiveIntensity: 1.15,
        roughness: 0.42,
        metalness: 0.02,
        transparent: true,
        opacity: 0.94,
        depthWrite: false,
      });
      const mesh = new InstancedMesh(geometry, material, 30);
      mesh.name = `story_route_${id}`;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.userData.cameraCollision = false;
      this.routes.set(id, mesh);
      this.group.add(mesh);
    }
    this.scene.add(this.group);
    return this;
  }

  setRoute(route) {
    this.activeRoute = STORY_ROUTES[route] ? route : null;
    for (const [id, mesh] of this.routes) mesh.visible = id === this.activeRoute;
    this.update(0);
    return this.activeRoute;
  }

  getDestination(route = this.activeRoute) {
    const points = STORY_ROUTES[route];
    return points ? points[points.length - 1].clone() : null;
  }

  setLedgerMood(mood = 'normal') {
    const sparkle = this.scene.getObjectByName('cozy_ledger_sparkle');
    const board = this.scene.getObjectByName('cozy_ledger_board');
    const palette = {
      normal: { sparkle: 0xffc6df, board: 0x7f5148 },
      signed: { sparkle: 0xffef9d, board: 0x7f5148 },
      false: { sparkle: 0x9785ff, board: 0x68445f },
      comply: { sparkle: 0xffd28c, board: 0x86503f },
      alter: { sparkle: 0xb8c7ff, board: 0x58466f },
    }[mood] || null;
    if (!palette) return;
    sparkle?.material?.color?.setHex(palette.sparkle);
    if (sparkle?.material?.emissive) {
      sparkle.material.emissive.setHex(palette.sparkle);
      sparkle.material.emissiveIntensity = mood === 'false' ? 1.8 : 1.05;
    }
    board?.material?.color?.setHex(palette.board);
  }

  update(dt) {
    this.time += Math.min(Math.max(Number(dt) || 0, 0), 0.1);
    if (!this.activeRoute) return;
    const mesh = this.routes.get(this.activeRoute);
    const points = STORY_ROUTES[this.activeRoute];
    if (!mesh || !points) return;

    const motion = this.reducedMotion ? 0.15 : 1;
    for (let i = 0; i < mesh.count; i += 1) {
      samplePolyline(points, i / (mesh.count - 1), this._position);
      const wave = Math.sin(this.time * 2.7 + i * 0.78);
      this._dummy.position.copy(this._position);
      this._dummy.position.y += (0.08 + wave * 0.045) * motion;
      const scale = 0.72 + (0.5 + 0.5 * wave) * 0.5;
      this._dummy.scale.setScalar(scale);
      this._dummy.rotation.set(wave * 0.18, this.time * 0.5 + i, wave * 0.22);
      this._dummy.updateMatrix();
      mesh.setMatrixAt(i, this._dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  reset() {
    this.setRoute(null);
    this.setLedgerMood('normal');
  }

  dispose() {
    this.scene?.remove(this.group);
    for (const mesh of this.routes.values()) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.routes.clear();
    this.scene = null;
  }
}
