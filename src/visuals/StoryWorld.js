import {
  BoxGeometry,
  Color,
  ConeGeometry,
  Group,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { TOWN_LAYOUT } from '../config/town.js';
import { projectStoryPresentation } from './AestheticPresentation.js';

export const STORY_ROUTES = Object.fromEntries(
  Object.entries(TOWN_LAYOUT.storyRoutes).map(([id, points]) => [
    id,
    points.map(([x, y, z]) => new Vector3(x, y, z)),
  ]),
);

export const STORY_ROUTE_GRAMMAR = Object.freeze({
  comply: Object.freeze({
    count: 30,
    markerGrammar: 'paired-witness-stitches',
    color: 0xffd28c,
    emissive: 0xffa85f,
    markerSize: Object.freeze({ width: 0.32, height: 0.04, depth: 0.075 }),
    pairOffset: 0.12,
  }),
  alter: Object.freeze({
    count: 30,
    markerGrammar: 'single-ink-thorns',
    color: 0xb6b7ff,
    emissive: 0x6957d8,
    markerSize: Object.freeze({ radius: 0.065, height: 0.42 }),
    scalePattern: Object.freeze([1, 0.72, 0.52]),
    lateralJitter: 0.07,
  }),
});

const LEDGER_MOOD_PALETTES = Object.freeze({
  normal: Object.freeze({ sparkle: 0xffc6df, board: 0x7f5148 }),
  signed: Object.freeze({ sparkle: 0xffef9d, board: 0x7f5148 }),
  false: Object.freeze({ sparkle: 0x9785ff, board: 0x68445f }),
  comply: Object.freeze({ sparkle: 0xffd28c, board: 0x86503f }),
  alter: Object.freeze({ sparkle: 0xb8c7ff, board: 0x58466f }),
});

// The pilot GLB is joined by material at export, so these are the semantic
// runtime children that contain its cream board and window-glow seal geometry.
const LEDGER_MOOD_TARGETS = Object.freeze({
  board: Object.freeze(['cozy_ledger_board', 'CommunityLedger_Cream']),
  sparkle: Object.freeze(['cozy_ledger_sparkle', 'CommunityLedger_Window_Glow']),
});

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
    this.routeCompanions = new Map();
    this.activeRoute = null;
    this.ledgerMood = 'normal';
    this.presentationState = null;
    this.time = 0;
    this._dummy = new Object3D();
    this._position = new Vector3();
    this._beforePosition = new Vector3();
    this._afterPosition = new Vector3();
    this._tangent = new Vector3();
    this._normal = new Vector3();
    this._resources = new Set();
    this._ledgerMaterialBindings = new Map();
  }

  init() {
    for (const [id, style] of Object.entries(STORY_ROUTE_GRAMMAR)) {
      const geometry = id === 'comply'
        ? new BoxGeometry(
          style.markerSize.width,
          style.markerSize.height,
          style.markerSize.depth,
          1,
          1,
          1,
        )
        : new ConeGeometry(
          style.markerSize.radius,
          style.markerSize.height,
          3,
          1,
          false,
        );
      if (id === 'alter') {
        // Lay each triangular thorn-stroke almost flat on the path. Instance
        // yaw then turns it with the route without requiring extra meshes.
        geometry.rotateZ(Math.PI / 2);
      }
      const material = new MeshStandardMaterial({
        color: style.color,
        emissive: new Color(style.emissive),
        emissiveIntensity: id === 'comply' ? 1.35 : 1.05,
        roughness: id === 'comply' ? 0.44 : 0.62,
        metalness: 0,
        transparent: true,
        opacity: id === 'comply' ? 0.96 : 0.90,
        depthWrite: false,
      });
      const mesh = new InstancedMesh(geometry, material, style.count);
      mesh.name = `story_route_${id}`;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.userData.cameraCollision = false;
      mesh.userData.routeId = id;
      mesh.userData.markerGrammar = style.markerGrammar;
      mesh.userData.markerRole = 'primary';
      this.routes.set(id, mesh);
      this.group.add(mesh);
      this._resources.add(geometry);
      this._resources.add(material);

      if (id === 'comply') {
        const witnessMaterial = new MeshStandardMaterial({
          color: 0xffe4ad,
          emissive: new Color(0xffb968),
          emissiveIntensity: 1.08,
          roughness: 0.50,
          metalness: 0,
          transparent: true,
          opacity: 0.84,
          depthWrite: false,
        });
        const companion = new InstancedMesh(geometry, witnessMaterial, style.count);
        companion.name = 'story_route_comply_witness_pair';
        companion.visible = false;
        companion.frustumCulled = false;
        companion.userData.cameraCollision = false;
        companion.userData.routeId = id;
        companion.userData.markerGrammar = style.markerGrammar;
        companion.userData.markerRole = 'witness-pair';
        this.routeCompanions.set(id, companion);
        this.group.add(companion);
        this._resources.add(witnessMaterial);
      }
    }
    this.scene.add(this.group);
    return this;
  }

  setRoute(route) {
    this.activeRoute = STORY_ROUTES[route] ? route : null;
    for (const [id, mesh] of this.routes) mesh.visible = id === this.activeRoute;
    for (const [id, mesh] of this.routeCompanions) mesh.visible = id === this.activeRoute;
    this.update(0);
    return this.activeRoute;
  }

  getDestination(route = this.activeRoute) {
    const points = STORY_ROUTES[route];
    return points ? points[points.length - 1].clone() : null;
  }

  _ownLedgerMaterials(object) {
    if (!object?.material) return [];
    const existing = this._ledgerMaterialBindings.get(object);
    if (existing) return existing.materials;

    const original = object.material;
    const sourceMaterials = Array.isArray(original) ? original : [original];
    if (!sourceMaterials.every((material) => typeof material?.clone === 'function')) return [];

    // Both the procedural kit and pilot loader intentionally share their town
    // materials. Clone at the semantic Ledger nodes before applying story mood
    // so a false record cannot recolor cottage windows or other cream props.
    const materials = sourceMaterials.map((material) => material.clone());
    const owned = Array.isArray(original) ? materials : materials[0];
    object.material = owned;
    this._ledgerMaterialBindings.set(object, { original, owned, materials });
    for (const material of materials) this._resources.add(material);
    return materials;
  }

  setLedgerMood(mood = 'normal') {
    const palette = LEDGER_MOOD_PALETTES[mood] || null;
    if (!palette) return;
    this.ledgerMood = mood;

    for (const name of LEDGER_MOOD_TARGETS.sparkle) {
      const sparkle = this.scene?.getObjectByName(name);
      for (const material of this._ownLedgerMaterials(sparkle)) {
        material.color?.setHex(palette.sparkle);
        if (material.emissive) {
          material.emissive.setHex(palette.sparkle);
          material.emissiveIntensity = mood === 'false' ? 1.8 : 1.05;
        }
      }
    }
    for (const name of LEDGER_MOOD_TARGETS.board) {
      const board = this.scene?.getObjectByName(name);
      for (const material of this._ownLedgerMaterials(board)) {
        material.color?.setHex(palette.board);
      }
    }
  }

  /**
   * Restore every story-world consequence from one authoritative snapshot.
   * Accepting an already projected object keeps main.js a thin composition
   * root, while accepting a raw snapshot makes reload behavior testable here.
   */
  setStoryState(value) {
    const presentation = value?.datasets && value?.ledgerMood
      ? value
      : projectStoryPresentation(value);
    this.presentationState = presentation;
    this.setRoute(presentation.route);
    this.setLedgerMood(presentation.ledgerMood);
    return presentation;
  }

  update(dt) {
    if (!this.reducedMotion) {
      this.time += Math.min(Math.max(Number(dt) || 0, 0), 0.1);
    }
    if (!this.activeRoute) return;
    const mesh = this.routes.get(this.activeRoute);
    const companion = this.routeCompanions.get(this.activeRoute) || null;
    const points = STORY_ROUTES[this.activeRoute];
    if (!mesh || !points) return;

    for (let i = 0; i < mesh.count; i += 1) {
      const t = i / (mesh.count - 1);
      samplePolyline(points, t, this._position);
      samplePolyline(points, Math.max(0, t - 0.0025), this._beforePosition);
      samplePolyline(points, Math.min(0.999999, t + 0.0025), this._afterPosition);
      this._tangent.subVectors(this._afterPosition, this._beforePosition);
      this._tangent.y = 0;
      if (this._tangent.lengthSq() < 1e-8) this._tangent.set(0, 0, 1);
      else this._tangent.normalize();
      this._normal.set(this._tangent.z, 0, -this._tangent.x);
      const yaw = Math.atan2(this._tangent.x, this._tangent.z);
      const wave = this.reducedMotion ? 0 : Math.sin(this.time * 2.1 + i * 0.71);

      if (this.activeRoute === 'comply') {
        // Put one longitudinal ledger stitch on either side of the route
        // centerline. The pair now survives distance and foreshortening instead
        // of collapsing into two serial beads along the same path.
        const scale = 0.94 + wave * 0.045;
        this._dummy.position.copy(this._position)
          .addScaledVector(this._normal, -STORY_ROUTE_GRAMMAR.comply.pairOffset);
        this._dummy.position.y += 0.075 + wave * 0.016;
        this._dummy.scale.set(scale, scale, scale);
        this._dummy.rotation.set(0, yaw + Math.PI / 2, wave * 0.045);
        this._dummy.updateMatrix();
        mesh.setMatrixAt(i, this._dummy.matrix);

        if (companion) {
          this._dummy.position.copy(this._position)
            .addScaledVector(this._normal, STORY_ROUTE_GRAMMAR.comply.pairOffset);
          this._dummy.position.y += 0.08 - wave * 0.012;
          this._dummy.scale.set(scale * 0.92, scale * 0.92, scale * 0.92);
          this._dummy.rotation.set(0, yaw + Math.PI / 2, -wave * 0.04);
          this._dummy.updateMatrix();
          companion.setMatrixAt(i, this._dummy.matrix);
        }
      } else {
        // The resistant route is deliberately less helpful: isolated, skewed
        // ink-thorns with alternating weight instead of a friendly bead trail.
        const sparseScale = STORY_ROUTE_GRAMMAR.alter.scalePattern[i % 3];
        const lateral = (i % 2 === 0 ? -1 : 1)
          * STORY_ROUTE_GRAMMAR.alter.lateralJitter;
        this._dummy.position.copy(this._position)
          .addScaledVector(this._normal, lateral);
        this._dummy.position.y += 0.065 + wave * 0.012;
        this._dummy.scale.setScalar(sparseScale * (1 + wave * 0.045));
        this._dummy.rotation.set(0, yaw + Math.PI * 0.29, wave * 0.035);
        this._dummy.updateMatrix();
        mesh.setMatrixAt(i, this._dummy.matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (companion) companion.instanceMatrix.needsUpdate = true;
  }

  reset() {
    this.setStoryState(null);
  }

  dispose() {
    this.scene?.remove(this.group);
    for (const [object, binding] of this._ledgerMaterialBindings) {
      if (object.material === binding.owned) object.material = binding.original;
    }
    this._ledgerMaterialBindings.clear();
    for (const resource of this._resources) resource.dispose?.();
    this._resources.clear();
    this.routes.clear();
    this.routeCompanions.clear();
    this.scene = null;
  }
}
