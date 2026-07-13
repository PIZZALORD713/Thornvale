import {
  AnimationMixer,
  Box3,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  MathUtils,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import {
  DEFAULT_TRAIT_ECHO_VARIANT,
  normalizeTraitEchoVariant,
  TRAIT_ECHO_VARIANTS,
} from '../config/assets.js';
import {
  countTraitEchoPlacements,
  countTraitEchoTriangles,
  TRAIT_ECHO_V1,
} from '../config/trait-echoes.js';
import { CORE_HOOK_V03 } from '../content/core-hook-v03.js';
import { getCuratedFriendsiesTrait } from '../content/friendsies-cast.js';

const scratchObject = new Object3D();
const scratchSize = new Vector3();

function readAttributeComponents(attribute, index) {
  return [
    attribute.getX(index),
    attribute.getY(index),
    attribute.getZ(index),
    attribute.getW(index),
  ];
}

function normalizeLoadedGltf(value) {
  if (value?.scene?.isObject3D) {
    return { scene: value.scene, animations: value.animations || [] };
  }
  if (value?.isObject3D) return { scene: value, animations: [] };
  throw new TypeError('Trait loader did not return a glTF scene');
}

function assertFiniteGeometry(geometry, label) {
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  const values = [
    bounds?.min.x,
    bounds?.min.y,
    bounds?.min.z,
    bounds?.max.x,
    bounds?.max.y,
    bounds?.max.z,
  ];
  const size = bounds?.getSize(scratchSize);
  if (
    !bounds
    || bounds.isEmpty()
    || !values.every(Number.isFinite)
    || !size
    || !Number.isFinite(size.lengthSq())
    || size.lengthSq() <= 0
  ) {
    throw new Error(`${label} has empty or non-finite geometry`);
  }
  return size.clone();
}

/**
 * Freeze one fRiENDSiES attachment at its authored frame-zero pose.
 *
 * The three curated v1 traits are rigid props wrapped in full character rigs.
 * Baking their single weighted joint removes the armature and animation while
 * preserving the exact textured model for efficient environment instancing.
 */
export function bakeRigidTrait(gltfValue, label = 'Trait') {
  const gltf = normalizeLoadedGltf(gltfValue);
  const scene = gltf.scene;
  const clip = gltf.animations.find((entry) => entry.name === 'Idle Float')
    || gltf.animations[0];

  let mixer = null;
  if (clip) {
    mixer = new AnimationMixer(scene);
    mixer.clipAction(clip).reset().play();
    mixer.setTime(0);
  }
  scene.updateMatrixWorld(true);

  const meshes = [];
  scene.traverse((object) => {
    if (object.isMesh) meshes.push(object);
  });
  if (meshes.length !== 1) {
    throw new Error(`${label} must contain exactly one mesh; received ${meshes.length}`);
  }

  const source = meshes[0];
  let bakeMatrix;
  if (source.isSkinnedMesh) {
    source.skeleton.update();
    const skinIndex = source.geometry.getAttribute('skinIndex');
    const skinWeight = source.geometry.getAttribute('skinWeight');
    if (!skinIndex || !skinWeight || skinIndex.count !== skinWeight.count) {
      throw new Error(`${label} has an incomplete skin`);
    }

    let rigidJoint = null;
    for (let vertex = 0; vertex < skinWeight.count; vertex += 1) {
      const indices = readAttributeComponents(skinIndex, vertex);
      const weights = readAttributeComponents(skinWeight, vertex);
      const active = weights
        .map((weight, component) => ({ weight, joint: indices[component] }))
        .filter(({ weight }) => weight > 1e-6);
      if (active.length !== 1 || Math.abs(active[0].weight - 1) > 1e-4) {
        throw new Error(`${label} is not rigidly weighted`);
      }
      if (rigidJoint === null) rigidJoint = active[0].joint;
      if (rigidJoint !== active[0].joint) {
        throw new Error(`${label} uses more than one rigid joint`);
      }
    }

    const bone = source.skeleton.bones[rigidJoint];
    const boneInverse = source.skeleton.boneInverses[rigidJoint];
    if (!bone || !boneInverse) throw new Error(`${label} references a missing rigid joint`);

    const boneMatrix = new Matrix4().multiplyMatrices(bone.matrixWorld, boneInverse);
    const deformation = new Matrix4()
      .copy(source.bindMatrixInverse)
      .multiply(boneMatrix)
      .multiply(source.bindMatrix);
    bakeMatrix = new Matrix4()
      .copy(scene.matrixWorld)
      .invert()
      .multiply(source.matrixWorld)
      .multiply(deformation);
  } else {
    bakeMatrix = new Matrix4()
      .copy(scene.matrixWorld)
      .invert()
      .multiply(source.matrixWorld);
  }

  const geometry = source.geometry.clone();
  geometry.applyMatrix4(bakeMatrix);
  geometry.deleteAttribute('skinIndex');
  geometry.deleteAttribute('skinWeight');

  const sourceSize = assertFiniteGeometry(geometry, label);
  if (!Number.isFinite(sourceSize.y) || sourceSize.y <= 1e-6) {
    throw new Error(`${label} has no usable vertical extent`);
  }
  const center = geometry.boundingBox.getCenter(new Vector3());
  geometry.translate(-center.x, -geometry.boundingBox.min.y, -center.z);
  const unitScale = 1 / sourceSize.y;
  geometry.scale(unitScale, unitScale, unitScale);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = Array.isArray(source.material)
    ? source.material.map((entry) => entry.clone())
    : source.material.clone();

  mixer?.stopAllAction();
  mixer?.uncacheRoot(scene);
  return {
    geometry,
    material,
    sourceHeight: sourceSize.y,
    sourceSize,
  };
}

function hasEvent(snapshot, eventId) {
  return Boolean(snapshot?.eventsSeen?.includes?.(eventId));
}

/**
 * Convert durable story data into a small, render-only trait language.
 */
export function projectTraitEchoStoryState(snapshot = null) {
  const events = CORE_HOOK_V03.events;
  const choice = snapshot?.choices?.[CORE_HOOK_V03.ids.choice] || null;
  const stewardMet = hasEvent(snapshot, events.stewardMet);
  const ledgerSigned = hasEvent(snapshot, events.ledgerSigned);
  const firstBellRung = hasEvent(snapshot, events.firstBellRung);
  const anomalyBellRang = hasEvent(snapshot, events.anomalyBellRang);
  const falseRecordSeen = hasEvent(snapshot, events.falseRecordSeen);
  const choiceMade = hasEvent(snapshot, events.choiceMade);

  const result = {
    id: 'arrival',
    ledgerFlowerScale: stewardMet ? 1 : 0.75,
    ledgerFlowerScaleY: 1,
    ledgerFlowerLean: 0,
    crownTilt: 0,
    torchEmissive: 0.08,
    bellLight: 0,
    torchFlicker: true,
  };

  if (ledgerSigned && !firstBellRung) {
    Object.assign(result, {
      id: 'dusk-guidance',
      bellLight: 0.30,
      torchEmissive: 0.48,
    });
  } else if (firstBellRung && !anomalyBellRang) {
    Object.assign(result, {
      id: 'post-bell',
      bellLight: 0.04,
      torchEmissive: 0.20,
    });
  }

  if (anomalyBellRang && !falseRecordSeen) {
    Object.assign(result, {
      id: 'anomaly',
      ledgerFlowerScale: 1.08,
      ledgerFlowerLean: -0.22,
      crownTilt: 0.16,
      torchEmissive: 0.16,
      bellLight: 0,
      torchFlicker: false,
    });
  }

  if (falseRecordSeen && !choiceMade) {
    Object.assign(result, {
      id: 'intervention',
      ledgerFlowerScale: 1,
      ledgerFlowerScaleY: 0.80,
      ledgerFlowerLean: 0.25,
      crownTilt: 0.28,
      torchEmissive: 0.04,
      bellLight: 0,
      torchFlicker: false,
    });
  }

  if (choice === 'comply') {
    Object.assign(result, {
      id: 'comply',
      ledgerFlowerScale: 1,
      ledgerFlowerScaleY: 1,
      ledgerFlowerLean: 0,
      crownTilt: 0,
      torchEmissive: 0.24,
      bellLight: 0.06,
      torchFlicker: true,
    });
  } else if (choice === 'alter') {
    Object.assign(result, {
      id: 'alter',
      ledgerFlowerScale: 1,
      ledgerFlowerScaleY: 0.80,
      ledgerFlowerLean: 0.25,
      crownTilt: 0.34,
      torchEmissive: 0.03,
      bellLight: 0,
      torchFlicker: false,
    });
  }

  return Object.freeze(result);
}

function forEachMaterial(material, callback) {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) {
    if (entry) callback(entry);
  }
}

function collectMaterialTextures(material, textures) {
  forEachMaterial(material, (entry) => {
    for (const value of Object.values(entry)) {
      if (value?.isTexture) textures.add(value);
    }
  });
}

function tuneEnvironmentMaterial(material, color) {
  forEachMaterial(material, (entry) => {
    if (entry.emissive?.isColor) entry.emissive.setHex(color);
    if ('envMapIntensity' in entry) {
      entry.envMapIntensity = Math.max(entry.envMapIntensity ?? 1, 1.05);
    }
    entry.needsUpdate = true;
  });
}

function setEmissiveIntensity(material, intensity) {
  forEachMaterial(material, (entry) => {
    if ('emissiveIntensity' in entry) entry.emissiveIntensity = intensity;
  });
}

function createDefaultLoader() {
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath('/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader);
  return {
    load: (url) => loader.loadAsync(url),
    dispose: () => dracoLoader.dispose(),
  };
}

export class FriendsiesTraitEchoes {
  constructor({
    config = TRAIT_ECHO_V1,
    variant = TRAIT_ECHO_VARIANTS.V1,
    worldAnimator = null,
    reducedMotion = false,
  } = {}) {
    this.config = config;
    this.variant = normalizeTraitEchoVariant(variant);
    this.worldAnimator = worldAnimator;
    this.reducedMotion = Boolean(reducedMotion);
    this.root = new Group();
    this.root.name = 'friendsies_trait_echo_v1';
    this.root.userData.cameraCollision = false;
    this.root.userData.traitEcho = {
      id: config.id,
      version: config.version,
      variant: this.variant,
      placementCount: countTraitEchoPlacements(config),
      displayedTriangles: countTraitEchoTriangles(config),
    };
    this.families = new Map();
    this.failedFamilies = new Map();
    this.positionOverrides = new Map();
    this.storyState = projectTraitEchoStoryState();
    this.current = { ...this.storyState };
    this.mounts = null;
    this.disposed = false;
    this._animation = this.worldAnimator?.add?.((time, dt, nightState) => {
      this.update(time, dt, nightState);
    });
  }

  async init({ sceneLoader = null } = {}) {
    const ownedLoader = sceneLoader ? null : createDefaultLoader();
    const load = sceneLoader || ownedLoader.load;
    const cache = new Map();
    const loadOnce = (url) => {
      if (!cache.has(url)) cache.set(url, Promise.resolve().then(() => load(url)));
      return cache.get(url);
    };

    try {
      await Promise.all(this.config.families.map(async (family) => {
        try {
          const trait = getCuratedFriendsiesTrait(
            family.trait.sourceTokenId,
            family.trait.traitType,
            family.trait.value,
          );
          if (!trait?.asset_url?.startsWith('/friendsies/')) {
            throw new Error('Trait is not in the curated local cast');
          }
          const baked = bakeRigidTrait(
            await loadOnce(trait.asset_url),
            `${trait.value} (#${trait.sourceTokenId})`,
          );
          this._addFamily(family, trait, baked);
        } catch (error) {
          this.failedFamilies.set(family.id, error);
          console.warn(
            `[FriendsiesTraitEchoes] ${family.id} unavailable; continuing without it.`,
            error,
          );
        }
      }));
      this._addCivicMounts();
    } finally {
      ownedLoader?.dispose();
    }

    this.root.userData.traitEcho.loadedFamilies = [...this.families.keys()];
    this.root.userData.traitEcho.failedFamilies = [...this.failedFamilies.keys()];
    this.update(0, 0, { isNight: false, nightMix: 0 });
    return this;
  }

  anchorToLandmarks({ ledger = null } = {}) {
    const crownFamily = this.config.families.find((family) => family.id === 'civic-crown');
    const crownPlacement = crownFamily?.placements?.[0];
    if (!ledger || !crownPlacement) return false;

    ledger.updateWorldMatrix(true, true);
    const bounds = new Box3().setFromObject(ledger, true);
    const size = bounds.getSize(new Vector3());
    if (
      bounds.isEmpty()
      || ![bounds.min.x, bounds.min.y, bounds.min.z,
        bounds.max.x, bounds.max.y, bounds.max.z].every(Number.isFinite)
      || !Number.isFinite(size.lengthSq())
      || size.lengthSq() <= 0
    ) {
      return false;
    }

    const center = bounds.getCenter(new Vector3());
    this.positionOverrides.set(crownPlacement.id, [
      center.x,
      bounds.max.y + 0.012,
      center.z,
    ]);
    this.root.userData.traitEcho.ledgerCrownAnchored = true;
    this.update(0, 0, { isNight: false, nightMix: 0 });
    return true;
  }

  _addFamily(family, trait, baked) {
    const mesh = new InstancedMesh(
      baked.geometry,
      baked.material,
      family.placements.length,
    );
    mesh.name = `trait_echo_${family.id}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.userData.cameraCollision = false;
    mesh.userData.traitEcho = {
      familyId: family.id,
      role: family.role,
      sourceTokenId: trait.sourceTokenId,
      traitType: trait.trait_type,
      value: trait.value,
      assetUrl: trait.asset_url,
      placementIds: family.placements.map((placement) => placement.id),
    };
    tuneEnvironmentMaterial(baked.material, family.presentation.emissiveColor);

    const runtime = {
      config: family,
      trait,
      mesh,
      sourceHeight: baked.sourceHeight,
      light: null,
    };
    if (family.id === 'civic-torch') {
      const bellPlacement = family.placements.find((placement) => placement.cluster === 'bell');
      if (bellPlacement) {
        runtime.light = new PointLight(
          family.presentation.emissiveColor,
          0,
          family.presentation.lightDistance,
          family.presentation.lightDecay,
        );
        runtime.light.name = 'trait_echo_bell_guidance_light';
        runtime.light.castShadow = false;
        runtime.light.userData.cameraCollision = false;
        runtime.light.position.set(
          bellPlacement.position[0],
          bellPlacement.position[1] + bellPlacement.height * 0.84,
          bellPlacement.position[2],
        );
        this.root.add(runtime.light);
      }
    }

    this.families.set(family.id, runtime);
    this.root.add(mesh);
  }

  _addCivicMounts() {
    const placements = [];
    for (const [familyId, runtime] of this.families) {
      for (const placement of runtime.config.placements) {
        if (placement.socket) placements.push({ familyId, placement });
      }
    }
    if (placements.length === 0) return;

    const geometry = new CylinderGeometry(0.5, 0.56, 0.12, 10, 1, false);
    const mountPresentation = this.config.civicMount || TRAIT_ECHO_V1.civicMount;
    const material = new MeshStandardMaterial({
      color: mountPresentation.baseColor,
      roughness: 0.74,
      metalness: 0.12,
      vertexColors: false,
    });
    const mesh = new InstancedMesh(geometry, material, placements.length);
    const instanceColor = new Color();
    placements.forEach(({ placement }, index) => {
      mesh.setColorAt(
        index,
        instanceColor.setHex(
          mountPresentation.socketColors[placement.socket]
            ?? mountPresentation.baseColor,
        ),
      );
    });
    mesh.instanceColor.needsUpdate = true;
    mesh.name = 'trait_echo_civic_mounts';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.userData.cameraCollision = false;
    mesh.userData.traitEchoMounts = placements.map(({ placement }) => ({
      placementId: placement.id,
      socket: placement.socket,
      pairId: placement.pairId || null,
    }));
    this.mounts = { geometry, material, mesh, placements };
    this.root.userData.traitEcho.mountDrawCalls = 1;
    this.root.add(mesh);
  }

  _updateCivicMounts() {
    if (!this.mounts) return;
    const { mesh, placements } = this.mounts;
    placements.forEach(({ placement }, index) => {
      const position = this.positionOverrides.get(placement.id) || placement.position;
      scratchObject.position.fromArray(position);
      scratchObject.rotation.set(0, placement.yaw || 0, 0);

      if (placement.socket === 'sconce') {
        scratchObject.position.y += placement.height * 0.18;
        scratchObject.position.z += Math.cos(placement.yaw || 0) * 0.045;
        scratchObject.rotation.x = Math.PI / 2;
        scratchObject.scale.set(0.32, 0.48, 0.32);
      } else if (placement.socket === 'crest') {
        scratchObject.position.y -= 0.024;
        scratchObject.scale.set(0.46, 0.55, 0.46);
      } else {
        scratchObject.position.y += 0.026;
        scratchObject.scale.set(0.44, 0.50, 0.44);
      }

      scratchObject.updateMatrix();
      mesh.setMatrixAt(index, scratchObject.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
  }

  setStoryState(snapshot) {
    this.storyState = projectTraitEchoStoryState(snapshot);
    if (this.reducedMotion) {
      this.current = { ...this.storyState };
      this.update(0, 0, { isNight: false, nightMix: 0 });
    }
    this.root.userData.traitEcho.storyState = this.storyState.id;
    return this.storyState;
  }

  update(time = 0, dt = 0, nightState = {}) {
    if (this.disposed) return;
    const safeDt = this.reducedMotion ? 1 : Math.min(Math.max(Number(dt) || 0, 0), 0.1);
    const damping = this.reducedMotion ? 1000 : 6.5;
    for (const key of [
      'ledgerFlowerScale',
      'ledgerFlowerScaleY',
      'ledgerFlowerLean',
      'crownTilt',
      'torchEmissive',
      'bellLight',
    ]) {
      this.current[key] = MathUtils.damp(
        Number(this.current[key]) || 0,
        Number(this.storyState[key]) || 0,
        damping,
        safeDt,
      );
    }

    for (const [familyId, runtime] of this.families) {
      const { config, mesh } = runtime;
      config.placements.forEach((placement, index) => {
        const ledgerSensitive = familyId === 'welcome-flower' && placement.cluster === 'ledger';
        const baseScale = placement.height;
        const scale = ledgerSensitive ? this.current.ledgerFlowerScale : 1;
        const scaleY = ledgerSensitive ? this.current.ledgerFlowerScaleY : 1;
        const stateId = this.storyState.id;
        const synchronized = ['dusk-guidance', 'comply'].includes(stateId);
        const heldStill = ['anomaly', 'intervention'].includes(stateId);
        const phase = synchronized ? 0 : index * 1.73;
        const ambientSway = familyId === 'welcome-flower' && !this.reducedMotion && !heldStill
          ? Math.sin(time * 0.92 + phase) * 0.025
          : 0;
        let lean = ledgerSensitive ? this.current.ledgerFlowerLean : 0;
        if (ledgerSensitive && placement.pairRole) {
          if (stateId === 'anomaly' && placement.pairRole === 'second') lean = 0;
          if (stateId === 'intervention') {
            lean = Math.abs(this.current.ledgerFlowerLean)
              * (placement.pairRole === 'first' ? 1 : -1);
          }
          if (stateId === 'alter') {
            lean = placement.pairRole === 'first'
              ? Math.abs(this.current.ledgerFlowerLean)
              : -Math.abs(this.current.ledgerFlowerLean) * 0.42;
          }
        }

        let ritualPulse = 1;
        if (familyId === 'civic-torch' && !this.reducedMotion && !heldStill) {
          const torchPhase = synchronized ? 0 : index * 1.31;
          ritualPulse += Math.sin(time * 1.15 + torchPhase) * 0.012;
        }
        if (familyId === 'civic-torch' && stateId === 'alter' && placement.pairId) {
          ritualPulse *= placement.pairRole === 'first' ? 0.94 : 1.01;
        }

        scratchObject.position.fromArray(
          this.positionOverrides.get(placement.id) || placement.position,
        );
        scratchObject.rotation.set(0, placement.yaw || 0, ambientSway + lean);
        if (familyId === 'civic-crown') scratchObject.rotation.z = this.current.crownTilt;
        scratchObject.scale.set(
          baseScale * scale * ritualPulse,
          baseScale * scale * scaleY * ritualPulse,
          baseScale * scale * ritualPulse,
        );
        scratchObject.updateMatrix();
        mesh.setMatrixAt(index, scratchObject.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();

      if (familyId === 'civic-torch') {
        const nightMix = Number.isFinite(nightState?.nightMix)
          ? MathUtils.clamp(nightState.nightMix, 0, 1)
          : (nightState?.isNight ? 1 : 0);
        const flicker = this.storyState.torchFlicker && !this.reducedMotion
          ? 1 + Math.sin(time * 7.4) * 0.06 + Math.sin(time * 11.7) * 0.035
          : 1;
        setEmissiveIntensity(
          mesh.material,
          0.04 + this.current.torchEmissive * (0.35 + nightMix * 0.65) * flicker,
        );
        if (runtime.light) {
          runtime.light.intensity = this.current.bellLight * nightMix * flicker;
        }
      } else if (familyId === 'civic-crown') {
        setEmissiveIntensity(mesh.material, 0.08 + Math.abs(this.current.crownTilt) * 0.12);
      } else {
        setEmissiveIntensity(mesh.material, this.storyState.id === 'anomaly' ? 0.10 : 0.04);
      }
    }
    this._updateCivicMounts();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.worldAnimator?.remove?.(this._animation);
    this.root.parent?.remove(this.root);
    const textures = new Set();
    for (const runtime of this.families.values()) {
      collectMaterialTextures(runtime.mesh.material, textures);
      runtime.mesh.geometry.dispose();
      forEachMaterial(runtime.mesh.material, (material) => material.dispose());
      runtime.light?.parent?.remove(runtime.light);
    }
    for (const texture of textures) texture.dispose();
    if (this.mounts) {
      this.mounts.mesh.parent?.remove(this.mounts.mesh);
      this.mounts.geometry.dispose();
      this.mounts.material.dispose();
      this.mounts = null;
    }
    this.families.clear();
    this.failedFamilies.clear();
    this.positionOverrides.clear();
  }
}

export async function loadTraitEchoV1({
  variant = DEFAULT_TRAIT_ECHO_VARIANT,
  config = TRAIT_ECHO_V1,
  worldAnimator = null,
  reducedMotion = false,
  sceneLoader = null,
} = {}) {
  if (normalizeTraitEchoVariant(variant) !== TRAIT_ECHO_VARIANTS.V1) return null;
  return new FriendsiesTraitEchoes({
    config,
    variant,
    worldAnimator,
    reducedMotion,
  }).init({ sceneLoader });
}
