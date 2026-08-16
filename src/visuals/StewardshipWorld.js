import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { STEWARDSHIP_V01 } from '../content/stewardship-v01.js';
import { prepareRigidEquipmentAsset } from './RigidEquipmentAsset.js';

export const FRIENDSIES_AXE_URL = '/friendsies/tools/axe-v1.glb';

const COLORS = Object.freeze({
  bark: 0x68473d,
  barkLight: 0x8c6550,
  cut: 0xe0b878,
  leaf: 0x5d9869,
  leafLight: 0x83bc7b,
  metal: 0x9cabb2,
  soil: 0x765044,
  seedling: 0x76ad70,
});

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createMaterial(name, color, options = {}) {
  const material = new MeshStandardMaterial({
    name,
    color,
    roughness: options.roughness ?? 0.9,
    metalness: options.metalness ?? 0,
    flatShading: options.flatShading ?? true,
  });
  return material;
}

export function prepareAxeAsset(root) {
  // hand:Axe is a rigid trait carried by the collection skeleton. Bake the
  // frame-zero skin into ordinary meshes before normalizing it as equipment;
  // otherwise its armature offset is applied again after cloning/rendering and
  // the visible mesh can land metres away from the pickup anchor.
  return prepareRigidEquipmentAsset(root, {
    name: 'friendsies_axe_frame_zero',
    label: 'Canonical Axe',
    longest: 1.08,
    rotateY: Math.PI,
    rotateZ: -0.18,
  });
}

export async function loadCanonicalAxe(url = FRIENDSIES_AXE_URL) {
  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  try {
    const gltf = await loader.loadAsync(url);
    return prepareAxeAsset(gltf.scene);
  } finally {
    draco.dispose();
  }
}

function makeProceduralAxe(materials) {
  const group = new Group();
  group.name = 'stewardship_axe_procedural_fallback';
  const handle = new Mesh(
    new CylinderGeometry(0.035, 0.047, 0.92, 8),
    materials.cut,
  );
  const head = new Mesh(new BoxGeometry(0.34, 0.18, 0.12), materials.metal);
  head.position.y = 0.43;
  group.add(handle, head);
  return group;
}

function createTreeVisual(definition, materials) {
  const root = new Group();
  root.name = `stewardship_${definition.id}`;
  root.position.set(...definition.position);
  root.userData.treeId = definition.id;

  const standing = new Group();
  standing.name = `${definition.id}_standing`;
  const trunk = new Mesh(
    new CylinderGeometry(0.42, 0.58, 3.85, 11),
    materials.bark,
  );
  trunk.position.y = 1.92;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  standing.add(trunk);

  const crown = new Group();
  crown.name = `${definition.id}_crown`;
  crown.position.y = 4.2;
  const crownPlacements = [
    [0, 0, 0, 1.35],
    [-0.78, -0.18, 0.2, 0.92],
    [0.75, -0.08, 0.14, 0.98],
    [0.12, 0.52, -0.25, 0.9],
  ];
  crownPlacements.forEach(([x, y, z, scale], index) => {
    const leaf = new Mesh(
      new IcosahedronGeometry(1, 1),
      index % 2 ? materials.leafLight : materials.leaf,
    );
    leaf.position.set(x, y, z);
    leaf.scale.set(scale, scale * 0.82, scale);
    leaf.castShadow = true;
    crown.add(leaf);
  });
  standing.add(crown);

  const notches = new Group();
  notches.name = `${definition.id}_notches`;
  for (let index = 0; index < definition.requiredHits; index += 1) {
    const notch = new Mesh(new BoxGeometry(0.26, 0.12, 0.08), materials.cut);
    notch.name = `${definition.id}_notch_${index + 1}`;
    notch.position.set(0.39, 0.72 + index * 0.18, 0.03);
    notch.rotation.z = 0.42 - index * 0.25;
    notch.visible = false;
    notches.add(notch);
  }
  standing.add(notches);

  const stump = new Group();
  stump.name = `${definition.id}_stump`;
  const stumpBark = new Mesh(
    new CylinderGeometry(0.44, 0.57, 0.58, 11),
    materials.bark,
  );
  stumpBark.position.y = 0.29;
  const stumpCut = new Mesh(
    new CylinderGeometry(0.42, 0.42, 0.035, 14),
    materials.cut,
  );
  stumpCut.position.y = 0.595;
  stump.add(stumpBark, stumpCut);
  for (let index = 0; index < 3; index += 1) {
    const log = new Mesh(
      new CylinderGeometry(0.18, 0.21, 1.15, 9),
      index === 2 ? materials.barkLight : materials.bark,
    );
    log.name = `${definition.id}_usable_log_${index + 1}`;
    log.rotation.z = Math.PI / 2;
    log.rotation.y = index * 0.55 - 0.4;
    log.position.set(-0.95 + index * 0.72, 0.22, 0.72 + (index % 2) * 0.35);
    stump.add(log);
  }
  stump.visible = false;
  root.add(standing, stump);
  return {
    root,
    standing,
    stump,
    notches: [...notches.children],
    currentStage: 'mature',
    fall: null,
  };
}

/**
 * Persistent grove and fRiENDSiES Axe presentation.
 *
 * GameSession and WoodcuttingDirector own all durable facts. This module only
 * projects snapshots, exposes stable interaction anchors, and reconciles the
 * corresponding static collider silhouettes.
 */
export class StewardshipWorld {
  constructor({
    physicsWorld = null,
    content = STEWARDSHIP_V01,
    reducedMotion = false,
    axeLoader = loadCanonicalAxe,
    onAssetWarning = console.warn,
  } = {}) {
    this.physicsWorld = physicsWorld;
    this.content = content;
    this.reducedMotion = Boolean(reducedMotion);
    this.axeLoader = axeLoader;
    this.onAssetWarning = typeof onAssetWarning === 'function' ? onAssetWarning : null;
    this.root = new Group();
    this.root.name = 'stewardship_grove_world';
    this.root.userData.cameraCollision = false;
    this.interactables = [];
    this.treeVisuals = new Map();
    this.treeBodies = new Map();
    this.materials = {};
    this.disposed = false;
    this.time = 0;
    this._state = null;
    this._strike = null;
    this.axeAssetStatus = 'fallback';
    this.axeAssetReady = null;
  }

  init() {
    this.materials = {
      bark: createMaterial('stewardship_bark', COLORS.bark),
      barkLight: createMaterial('stewardship_bark_light', COLORS.barkLight),
      cut: createMaterial('stewardship_cut_wood', COLORS.cut),
      leaf: createMaterial('stewardship_leaf', COLORS.leaf),
      leafLight: createMaterial('stewardship_leaf_light', COLORS.leafLight),
      metal: createMaterial('stewardship_axe_metal', COLORS.metal, {
        metalness: 0.42,
        roughness: 0.45,
      }),
      soil: createMaterial('stewardship_planting_soil', COLORS.soil),
      seedling: createMaterial('stewardship_seedling', COLORS.seedling),
    };

    for (const definition of this.content.trees) {
      const visual = createTreeVisual(definition, this.materials);
      this.treeVisuals.set(definition.id, visual);
      this.root.add(visual.root);
      this.interactables.push({
        id: definition.id,
        position: new Vector3(...definition.position),
        radius: 2.15,
        prompt: 'Chop the mature tree',
      });
    }

    this._createAxePickup();
    this._createPlantingSite();
    this.axeAssetReady = this._loadAxeAsset();
    return this;
  }

  _createAxePickup() {
    const [x, , z] = this.content.axePickup.position;
    const station = new Group();
    station.name = 'stewardship_axe_station';
    station.position.set(x, 0, z);
    const block = new Mesh(
      new CylinderGeometry(0.38, 0.46, 0.62, 10),
      this.materials.bark,
    );
    block.name = 'stewardship_axe_station_block';
    block.position.set(-0.72, 0.31, 0);
    block.castShadow = true;
    block.receiveShadow = true;
    const blockTop = new Mesh(
      new CylinderGeometry(0.36, 0.36, 0.035, 12),
      this.materials.cut,
    );
    blockTop.name = 'stewardship_axe_station_cut';
    blockTop.position.set(-0.72, 0.638, 0);
    blockTop.castShadow = true;
    station.add(block, blockTop);
    this.axeStation = station;
    this.root.add(station);

    const pickup = new Group();
    pickup.name = 'stewardship_axe_pickup';
    pickup.position.set(...this.content.axePickup.position);
    this.axePickupDisplay = new Group();
    this.axePickupDisplay.name = 'stewardship_axe_pickup_display';
    this.axePickupDisplay.position.set(-0.72, 0.08, 0);
    this.axePickupFallback = makeProceduralAxe(this.materials);
    this.axePickupFallback.rotation.z = -0.62;
    this.axePickupDisplay.add(this.axePickupFallback);
    pickup.add(this.axePickupDisplay);
    this.axePickup = pickup;
    this.root.add(pickup);

    this.actionAxe = new Group();
    this.actionAxe.name = 'stewardship_action_axe';
    this.actionAxeFallback = makeProceduralAxe(this.materials);
    this.actionAxeFallback.rotation.z = -0.35;
    this.actionAxe.add(this.actionAxeFallback);
    this.actionAxe.visible = false;
    this.root.add(this.actionAxe);

    this.interactables.push({
      id: this.content.ids.axePickup,
      position: new Vector3(...this.content.axePickup.position),
      radius: 1.8,
      prompt: 'Take the fRiENDSiES axe',
    });
  }

  _createPlantingSite() {
    const site = this.content.plantingSites[0];
    const group = new Group();
    group.name = 'stewardship_planting_site';
    group.position.set(...site.position);
    const soil = new Mesh(new CylinderGeometry(0.68, 0.76, 0.08, 18), this.materials.soil);
    soil.position.y = 0.04;
    soil.scale.z = 0.72;
    group.add(soil);

    this.seedling = new Group();
    this.seedling.name = 'stewardship_planted_seedling';
    const stem = new Mesh(
      new CylinderGeometry(0.035, 0.055, 0.62, 7),
      this.materials.barkLight,
    );
    stem.position.y = 0.31;
    const left = new Mesh(new SphereGeometry(0.18, 9, 6), this.materials.seedling);
    left.scale.set(1.4, 0.46, 0.72);
    left.position.set(-0.13, 0.53, 0);
    left.rotation.z = 0.32;
    const right = left.clone();
    right.position.x = 0.13;
    right.rotation.z = -0.32;
    this.seedling.add(stem, left, right);
    this.seedling.visible = false;
    group.add(this.seedling);
    this.plantingSite = group;
    this.root.add(group);
    this.interactables.push({
      id: site.id,
      position: new Vector3(...site.position),
      radius: 1.85,
      prompt: 'Plant a replacement tree',
    });
  }

  async _loadAxeAsset() {
    try {
      const template = await this.axeLoader(FRIENDSIES_AXE_URL);
      if (this.disposed) return false;
      const pickup = cloneSkeleton(template);
      pickup.name = 'friendsies_axe_pickup_canonical';
      pickup.rotation.set(0, Math.PI / 2, -0.5);
      this.axePickupDisplay.add(pickup);
      const action = cloneSkeleton(template);
      action.name = 'friendsies_axe_action_canonical';
      action.rotation.set(0, Math.PI / 2, -0.25);
      this.actionAxe.add(action);
      this.axePickupFallback.visible = false;
      this.actionAxeFallback.visible = false;
      this.axeAssetStatus = 'canonical';
      return true;
    } catch (error) {
      this.axeAssetStatus = 'fallback';
      this.onAssetWarning?.(
        '[StewardshipWorld] Canonical Axe unavailable; using procedural fallback.',
        error,
      );
      return false;
    }
  }

  setState(snapshot, { animate } = {}) {
    if (!snapshot) return null;
    const shouldAnimate = Boolean(animate ?? (this._state !== null)) && !this.reducedMotion;
    this._state = snapshot;
    const axeOwned = snapshot.player?.tools?.owned?.includes?.(this.content.tools.axe) === true;
    if (this.axePickup) this.axePickup.visible = !axeOwned;

    const trees = snapshot.world?.trees?.byId || {};
    for (const definition of this.content.trees) {
      const state = trees[definition.id] || definition;
      const visual = this.treeVisuals.get(definition.id);
      const stage = state.stage || 'mature';
      const hitCount = Math.max(0, Math.min(
        definition.requiredHits,
        Math.floor(numeric(state.hitCount)),
      ));
      visual.notches.forEach((notch, index) => {
        notch.visible = stage === 'mature' && index < hitCount;
      });

      if (stage === 'stump' && visual.currentStage !== 'stump' && shouldAnimate) {
        visual.fall = { elapsed: 0, duration: 1.15 };
        visual.standing.visible = true;
        visual.stump.visible = false;
      } else if (!shouldAnimate) {
        visual.fall = null;
        visual.standing.visible = stage !== 'stump';
        visual.stump.visible = stage === 'stump';
        visual.standing.rotation.z = 0;
      } else if (!visual.fall) {
        visual.standing.visible = stage !== 'stump';
        visual.stump.visible = stage === 'stump';
        visual.standing.rotation.z = 0;
      }
      visual.currentStage = stage;
      this._syncTreeCollider(definition, stage);
    }

    const planted = Object.values(trees).some((tree) => (
      tree?.plantingSiteId === this.content.ids.plantingSite
      && tree?.stage !== 'stump'
    ));
    if (this.seedling) this.seedling.visible = planted;
    return snapshot;
  }

  _syncTreeCollider(definition, stage) {
    if (!this.physicsWorld) return;
    const current = this.treeBodies.get(definition.id);
    const desired = stage === 'stump' ? 'stump' : 'standing';
    if (current?.kind === desired) return;
    if (current?.handle?.body) this.physicsWorld.removeRigidBody(current.handle.body);
    const [x, y, z] = definition.position;
    const handle = desired === 'standing'
      ? this.physicsWorld.createStaticBox(
        { x, y: y + 1.9, z },
        { x: 0.9, y: 3.8, z: 0.9 },
        null,
        { friction: 0.95 },
      )
      : this.physicsWorld.createStaticBox(
        { x, y: y + 0.29, z },
        { x: 0.9, y: 0.58, z: 0.9 },
        null,
        { friction: 0.95 },
      );
    this.treeBodies.set(definition.id, { kind: desired, handle });
  }

  playStrike(treeId, {
    final = false,
    onContact = null,
    onComplete = null,
  } = {}) {
    const visual = this.treeVisuals.get(treeId);
    if (!visual || visual.currentStage === 'stump') return false;
    const definition = this.content.trees.find((tree) => tree.id === treeId);
    this._strike = {
      treeId,
      elapsed: 0,
      duration: 0.72,
      final: Boolean(final),
      contacted: false,
      onContact: typeof onContact === 'function' ? onContact : null,
      onComplete: typeof onComplete === 'function' ? onComplete : null,
    };
    this.actionAxe.position.set(
      definition.position[0] + 0.78,
      definition.position[1] + 1.05,
      definition.position[2] + 0.08,
    );
    this.actionAxe.rotation.set(0, 0, -0.72);
    this.actionAxe.visible = true;
    return true;
  }

  update(dt) {
    if (this.disposed) return;
    const step = Math.min(0.1, Math.max(0, numeric(dt)));
    this.time += step;
    if (this.seedling?.visible && !this.reducedMotion) {
      this.seedling.rotation.z = Math.sin(this.time * 1.8) * 0.035;
    }

    if (this._strike) {
      this._strike.elapsed += step;
      const progress = Math.min(1, this._strike.elapsed / this._strike.duration);
      const windup = progress < 0.42
        ? progress / 0.42
        : 1 - (progress - 0.42) / 0.58;
      this.actionAxe.rotation.z = -0.72 + Math.sin(windup * Math.PI * 0.5) * 1.15;
      const visual = this.treeVisuals.get(this._strike.treeId);
      if (!this.reducedMotion && visual?.standing) {
        visual.standing.rotation.z = Math.sin(progress * Math.PI * 4) * 0.012;
      }
      if (!this._strike.contacted && progress >= 0.52) {
        this._strike.contacted = true;
        this._strike.onContact?.();
      }
      if (progress >= 1) {
        if (visual?.standing && !visual.fall) visual.standing.rotation.z = 0;
        this.actionAxe.visible = false;
        const onComplete = this._strike.onComplete;
        this._strike = null;
        onComplete?.();
      }
    }

    for (const visual of this.treeVisuals.values()) {
      if (!visual.fall) continue;
      visual.fall.elapsed += step;
      const progress = Math.min(1, visual.fall.elapsed / visual.fall.duration);
      const eased = 1 - ((1 - progress) ** 3);
      visual.standing.rotation.z = -eased * Math.PI * 0.47;
      if (progress >= 1) {
        visual.standing.visible = false;
        visual.standing.rotation.z = 0;
        visual.stump.visible = true;
        visual.fall = null;
      }
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._strike?.onComplete?.();
    this._strike = null;
    for (const current of this.treeBodies.values()) {
      if (current?.handle?.body) this.physicsWorld?.removeRigidBody?.(current.handle.body);
    }
    this.treeBodies.clear();
    this.root.removeFromParent();
    this.root.traverse((object) => {
      object.geometry?.dispose?.();
    });
    for (const material of Object.values(this.materials)) material.dispose?.();
    this.interactables.length = 0;
  }
}

export function createStewardshipWorld(options) {
  return new StewardshipWorld(options).init();
}
