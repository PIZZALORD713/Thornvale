/**
 * CharacterLoader - Loads fRiENDSiES characters from metadata
 *
 * Responsibilities:
 * - Fetch metadata from Gist
 * - Load body/head/parts GLBs
 * - Bind parts to body skeleton
 * - Create face texture overlay
 * - Create VisualRig with loaded character
 */

import {
  Box3, TextureLoader, LinearFilter, SRGBColorSpace, Object3D, Matrix4,
  PointLight, SkinnedMesh, Mesh, MeshStandardMaterial, Group, Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Metadata URL (same as original)
const METADATA_URL = "https://gist.githubusercontent.com/IntergalacticPizzaLord/a7b0eeac98041a483d715c8320ccf660/raw/ce7d37a94c33c63e2b50d5922e0711e72494c8dd/fRiENDSiES";
const SOFT_WHITE_HEAD_EMISSION = Object.freeze({
  color: 0xffffff,
  emissiveIntensity: 0.22,
  softWhite: true,
});
const STREAMED_HEAD_EMISSION_EXCEPTIONS = Object.freeze({
  'Grey Cloud': SOFT_WHITE_HEAD_EMISSION,
});

// The first-run steward must not wait behind the full remote collection index.
// These six owner-supplied traits are bundled with the release and keep the
// same metadata shape as streamed fRiENDSiES entries.
const BUNDLED_CHARACTER_ENTRIES = Object.freeze({
  1: {
    token_id: 1,
    attributes: [
      { trait_type: 'body', value: 'Little Cloud Boy', asset_url: '/friendsies/0001/body.glb' },
      { trait_type: 'face', value: 'Open', asset_url: '/friendsies/0001/face-open.png' },
      { trait_type: 'hand', value: 'Flower White', asset_url: '/friendsies/0001/hand-flower-white.glb' },
      {
        trait_type: 'head',
        value: 'Grey Cloud',
        asset_url: '/friendsies/0001/head-grey-cloud.glb',
        presentation: { headEmission: SOFT_WHITE_HEAD_EMISSION },
      },
      { trait_type: 'shoe', value: 'Low Tops Yellow', asset_url: '/friendsies/0001/shoes-low-tops-yellow.glb' },
    ],
  },
  8914: {
    token_id: 8914,
    attributes: [
      { trait_type: 'backpiece', value: 'Pip', asset_url: '/friendsies/8914/backpiece-pip.glb' },
      { trait_type: 'body', value: 'Frosted Cloud Boy', asset_url: '/friendsies/8914/body.glb' },
      { trait_type: 'hand', value: 'Torch', asset_url: '/friendsies/8914/hand-torch.glb' },
      {
        trait_type: 'head',
        value: 'White Elephant',
        asset_url: '/friendsies/8914/head-white-elephant.glb',
        presentation: { headEmission: SOFT_WHITE_HEAD_EMISSION },
      },
      { trait_type: 'shoe', value: 'Wrappers Gold', asset_url: '/friendsies/8914/shoes-wrappers-gold.glb' },
      { trait_type: 'sprout', value: 'Crown Up', asset_url: '/friendsies/8914/sprout-crown-up.glb' },
    ],
  },
});

export class CharacterLoader {
  constructor() {
    this.metadata = null;
    this.metadataLoaded = false;

    // Loaders
    this.gltfLoader = null;
    this.textureLoader = null;

    // Loaded characters, keyed by instance ID. When no instance ID is supplied,
    // the token ID remains the key for backwards compatibility.
    this.characters = new Map();

    // A revision per instance allows a player and NPC to stream concurrently
    // while still ensuring that a newer request replaces an older request for
    // the same visual slot.
    this.loadRevisions = new Map();

    // Kept as a monotonically increasing diagnostic for callers that inspected
    // the original loader. It no longer controls cancellation globally.
    this.currentLoadId = 0;
  }

  /**
   * Initialize loaders
   */
  init() {
    // DRACO decoder
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');

    // GLTF loader
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);

    // Texture loader
    this.textureLoader = new TextureLoader();
    this.textureLoader.setCrossOrigin('anonymous');

    return this;
  }

  /**
   * Load metadata from Gist
   */
  async loadMetadata({ timeout = 6000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(METADATA_URL, {
        mode: 'cors',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      this.metadata = await response.json();
      this.metadataLoaded = true;

      const count = Array.isArray(this.metadata)
        ? this.metadata.length
        : Object.keys(this.metadata || {}).length;
      console.log(`[CharacterLoader] Loaded ${count} tokens`);
      return true;
    } catch (err) {
      const reason = err?.name === 'AbortError' ? `timed out after ${timeout}ms` : err;
      console.warn('[CharacterLoader] Remote avatar unavailable:', reason);
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Get entry by token ID
   */
  getEntryById(tokenId) {
    const bundled = BUNDLED_CHARACTER_ENTRIES[Number(tokenId)];
    if (bundled) return bundled;
    if (!this.metadata) return null;

    if (!Array.isArray(this.metadata)) {
      return this.metadata[tokenId] ||
             this.metadata[String(tokenId)] ||
             this.metadata[Number(tokenId) - 1] ||
             null;
    }

    return this.metadata[tokenId] ||
           this.metadata[tokenId - 1] ||
           this.metadata.find(x => Number(x?.token_id) === Number(tokenId)) ||
           this.metadata.find(x => Number(x?.id) === Number(tokenId)) ||
           null;
  }

  hasBundledCharacter(tokenId) {
    return Boolean(BUNDLED_CHARACTER_ENTRIES[Number(tokenId)]);
  }

  /**
   * Load a character by token ID
   * @param {number} tokenId
   * @param {{instanceId?: string|number}} options
   * @returns {Promise<Group|null>}
   */
  async loadCharacter(tokenId, options = {}) {
    const entry = this.getEntryById(tokenId);
    if (!entry && !this.metadataLoaded) {
      console.error('[CharacterLoader] Metadata not loaded');
      return null;
    }
    if (!entry) {
      console.error(`[CharacterLoader] Token #${tokenId} not found`);
      return null;
    }

    const instanceId = options?.instanceId ?? tokenId;
    const loadRevision = this._beginInstanceLoad(instanceId);
    this.currentLoadId += 1;

    const group = new Group();
    group.name = instanceId === tokenId
      ? `character_${tokenId}`
      : `character_${tokenId}_${safeObjectName(instanceId)}`;
    group.scale.setScalar(5);
    group.position.set(0, -2.5, 0);

    const traits = entry.attributes || [];

    const bodyAttr = traits.find((trait) => trait.trait_type === 'body');
    if (!bodyAttr?.asset_url) {
      console.error('[CharacterLoader] No body trait found');
      return null;
    }

    const faceAttr = traits.find((trait) => trait.trait_type === 'face');
    const headAttr = traits.find((trait) => trait.trait_type === 'head');

    // Load body, head, and face texture in parallel
    const [bodyRes, headRes, faceTexture] = await Promise.all([
      loadGLB(this.gltfLoader, bodyAttr.asset_url),
      headAttr?.asset_url ? loadGLB(this.gltfLoader, headAttr.asset_url) : Promise.resolve(null),
      faceAttr?.asset_url ? loadTexture(this.textureLoader, faceAttr.asset_url) : Promise.resolve(null),
    ]);

    if (!this._isCurrentLoad(instanceId, loadRevision)) {
      disposeLoadedResources([
        bodyRes?.gltf?.scene,
        headRes?.gltf?.scene,
      ], [faceTexture]);
      return null;
    }

    if (!bodyRes.ok) {
      console.error('[CharacterLoader] Body load failed:', bodyRes.error);
      disposeLoadedResources([headRes?.gltf?.scene], [faceTexture]);
      return null;
    }

    const bodyRoot = bodyRes.gltf.scene;
    group.add(bodyRoot);

    const bodySkinned = findFirstSkinnedMesh(bodyRoot);
    if (!bodySkinned?.skeleton) {
      console.error('[CharacterLoader] Body missing skeleton');
      disposeLoadedResources([
        bodyRoot,
        headRes?.gltf?.scene,
      ], [faceTexture]);
      return null;
    }

    const bodySkeleton = bodySkinned.skeleton;
    const animations = Array.isArray(bodyRes.gltf.animations)
      ? [...bodyRes.gltf.animations]
      : [];

    // Object3D.animations is the conventional Three.js discovery point, while
    // userData carries the richer character context needed by NPC systems.
    group.animations = animations;
    group.userData.friendsies = {
      tokenId,
      instanceId,
      bodyRoot,
      bodySkeleton,
      animations,
    };

    const faceAnchor = new Object3D();
    faceAnchor.name = 'FACE_ANCHOR';
    const headBone = getBodyBoneByKey(bodySkeleton, 'head') || getBodyBoneByKey(bodySkeleton, 'neck');
    if (headBone) headBone.add(faceAnchor);
    else group.add(faceAnchor);

    tuneMaterialsForEnv(bodyRoot);

    let faceOverlayCount = 0;
    if (headRes?.ok) {
      const headScene = headRes.gltf.scene;
      group.add(headScene);
      group.updateMatrixWorld(true);

      attachPartToBodySkeleton(headScene, bodySkeleton, bodySkinned);
      faceOverlayCount = createSkinnedFaceOverlayFromHead(
        headScene,
        faceTexture,
        bodySkeleton,
        faceAnchor,
      );
      retargetRigidAttachmentsToBodyBones(headScene, bodySkeleton);
      applyFriendsiesHeadPresentation(headScene, headAttr);
      tuneMaterialsForEnv(headScene);
    }
    if (faceTexture && faceOverlayCount === 0) faceTexture.dispose();

    const partTraits = traits.filter(
      (trait) => !['body', 'head', 'face'].includes(trait.trait_type)
    );

    // Load remaining parts in parallel
    const partAssets = partTraits
      .filter((trait) => trait.asset_url && trait.asset_url.endsWith('.glb'))
      .map((trait) => ({
        url: trait.asset_url,
        traitType: trait.trait_type,
        value: trait.value,
      }));

    if (partAssets.length > 0) {
      const partResults = await Promise.all(
        partAssets.map(async (asset) => ({
          asset,
          result: await loadGLB(this.gltfLoader, asset.url),
        }))
      );
      if (!this._isCurrentLoad(instanceId, loadRevision)) {
        disposeLoadedResources([
          group,
          ...partResults.map(({ result }) => result?.gltf?.scene),
        ]);
        return null;
      }

      for (const { asset, result: partRes } of partResults) {
        if (!partRes.ok) continue;

        const partScene = partRes.gltf.scene;
        group.add(partScene);
        group.updateMatrixWorld(true);

        attachPartToBodySkeleton(partScene, bodySkeleton, bodySkinned);
        retargetRigidAttachmentsToBodyBones(partScene, bodySkeleton);
        if (asset.traitType === 'hand' && /torch|lantern/i.test(asset.value || '')) {
          addSoftHandheldGlow(partScene, bodySkeleton);
        }
        tuneMaterialsForEnv(partScene);
      }
    }

    if (!this._isCurrentLoad(instanceId, loadRevision)) {
      disposeGroupResources(group);
      return null;
    }

    const previous = this.characters.get(instanceId);
    if (previous?.group && previous.group !== group) {
      previous.group.parent?.remove(previous.group);
      disposeGroupResources(previous.group);
    }

    this.characters.set(instanceId, {
      group,
      entry,
      tokenId,
      instanceId,
    });

    return group;
  }

  _beginInstanceLoad(instanceId) {
    const revision = (this.loadRevisions.get(instanceId) || 0) + 1;
    this.loadRevisions.set(instanceId, revision);
    return revision;
  }

  _isCurrentLoad(instanceId, revision) {
    return this.loadRevisions.get(instanceId) === revision;
  }

  /**
   * Get a loaded character by instance ID. A token ID still resolves the
   * default/legacy instance, or the first matching custom instance.
   */
  getCharacter(instanceId) {
    const direct = this.characters.get(instanceId);
    if (direct) return direct.group;

    for (const character of this.characters.values()) {
      if (Number(character.tokenId) === Number(instanceId)) return character.group;
    }
    return null;
  }

  /**
   * Remove a loaded character and dispose GPU resources. The argument is an
   * instance ID; passing a token ID retains the original API behavior.
   */
  removeCharacter(instanceId) {
    let resolvedId = instanceId;
    let char = this.characters.get(resolvedId);

    if (!char) {
      for (const [candidateId, candidate] of this.characters) {
        if (Number(candidate.tokenId) === Number(instanceId)) {
          resolvedId = candidateId;
          char = candidate;
          break;
        }
      }
    }

    // Invalidate a request even when it has not reached the registry yet.
    this._beginInstanceLoad(resolvedId);

    if (char) {
      char.group.parent?.remove(char.group);
      disposeGroupResources(char.group);
      this.characters.delete(resolvedId);
      return true;
    }
    return false;
  }

  /**
   * Clear all characters
   */
  clearAll() {
    // Include requests that are still streaming and therefore are not in the
    // character registry yet.
    for (const instanceId of this.loadRevisions.keys()) {
      this._beginInstanceLoad(instanceId);
    }
    for (const instanceId of [...this.characters.keys()]) {
      this.removeCharacter(instanceId);
    }
  }
}

// Helper: Load GLB with timeout
function loadGLB(loader, url, timeout = 30000) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      resolve({ ok: false, error: 'Timeout' });
    }, timeout);

    loader.load(
      url,
      (gltf) => {
        clearTimeout(timer);
        if (settled) {
          disposeLoadedResources([gltf?.scene]);
          return;
        }
        settled = true;
        resolve({ ok: true, gltf });
      },
      undefined,
      (err) => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        resolve({ ok: false, error: err.message || 'Unknown error' });
      }
    );
  });
}

// Helper: Load texture and configure for face overlay
function loadTexture(textureLoader, url, timeout = 12000) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      resolve(null);
    }, timeout);
    textureLoader.load(
      url,
      (texture) => {
        clearTimeout(timer);
        if (settled) {
          texture.dispose();
          return;
        }
        settled = true;
        texture.minFilter = LinearFilter;
        texture.repeat.y = -1;
        texture.offset.y = 1;
        texture.colorSpace = SRGBColorSpace;
        resolve(texture);
      },
      undefined,
      () => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        resolve(null);
      }
    );
  });
}

// Helper: Find first skinned mesh
function findFirstSkinnedMesh(root) {
  let result = null;
  root.traverse((o) => {
    if (!result && o.isSkinnedMesh) result = o;
  });
  return result;
}

function baseKey(name) {
  let cleaned = (name || '').toLowerCase();
  cleaned = cleaned.replace(/^armature[|:]/g, '');
  cleaned = cleaned.replace(/^mixamorig[:]?/g, '');
  cleaned = cleaned.replace(/\s+/g, '');
  cleaned = cleaned.replace(/[^a-z0-9]+/g, '');
  cleaned = cleaned.replace(/end$/g, '');
  return cleaned;
}

function aliasKey(key) {
  const updated = key.replace(/^spine0+(\d+)$/, 'spine$1');
  if (updated === 'pelvis' || updated === 'hip') return 'hips';
  return updated;
}

function keyForName(name) {
  return aliasKey(baseKey(name));
}

function getBodyBoneByKey(skeleton, key) {
  if (!skeleton) return null;
  const target = aliasKey(key.toLowerCase());
  return skeleton.bones.find((bone) => keyForName(bone.name) === target) || null;
}

function attachPartToBodySkeleton(partScene, bodySkeleton, bodySkinned) {
  if (!bodySkeleton || !bodySkinned || !partScene) return 0;
  bodySkinned.updateMatrixWorld(true);

  let skinnedCount = 0;
  partScene.traverse((child) => {
    if (!child.isSkinnedMesh) return;
    skinnedCount += 1;

    const bindMatrix = child.bindMatrix
      ? child.bindMatrix.clone()
      : new Matrix4();
    child.bind(bodySkeleton, bindMatrix);
    child.bindMode = bodySkinned.bindMode || child.bindMode;
    child.updateMatrixWorld(true);
  });

  return skinnedCount;
}

function buildBodyBoneMap(bodySkeleton) {
  const map = new Map();
  for (const bone of bodySkeleton?.bones || []) {
    map.set(keyForName(bone.name), bone);
  }
  return map;
}

function findBoneAncestor(obj) {
  let parent = obj.parent;
  while (parent) {
    if (parent.isBone) return parent;
    parent = parent.parent;
  }
  return null;
}

function reparentKeepWorld(obj, newParent) {
  obj.updateMatrixWorld(true);
  const world = obj.matrixWorld.clone();

  newParent.updateMatrixWorld(true);
  newParent.add(obj);

  const inv = new Matrix4().copy(newParent.matrixWorld).invert();
  obj.matrix.copy(inv.multiply(world));
  obj.matrix.decompose(obj.position, obj.quaternion, obj.scale);
  obj.matrixAutoUpdate = true;
}

function retargetRigidAttachmentsToBodyBones(partScene, bodySkeleton) {
  if (!partScene || !bodySkeleton) return 0;

  const boneMap = buildBodyBoneMap(bodySkeleton);
  const ops = [];

  partScene.traverse((child) => {
    if (!child.isMesh || child.isSkinnedMesh) return;

    const geometry = child.geometry;
    const hasSkinAttrs =
      !!geometry?.attributes?.skinIndex && !!geometry?.attributes?.skinWeight;

    if (hasSkinAttrs) {
      ops.push({ type: 'convertToSkinned', obj: child });
      return;
    }

    const bone = findBoneAncestor(child);
    if (!bone) return;

    const targetBone = boneMap.get(keyForName(bone.name));
    if (!targetBone) return;

    ops.push({ type: 'reparent', obj: child, target: targetBone });
  });

  for (const op of ops) {
    if (op.type === 'convertToSkinned') {
      const src = op.obj;
      const parent = src.parent;
      if (!parent) continue;

      const skinned = new SkinnedMesh(src.geometry, src.material);
      skinned.name = `${src.name || 'mesh'}_SKINNED_FROM_MESH`;
      skinned.position.copy(src.position);
      skinned.quaternion.copy(src.quaternion);
      skinned.scale.copy(src.scale);

      const bindMatrix = new Matrix4();
      skinned.bind(bodySkeleton, bindMatrix);

      parent.add(skinned);
      parent.remove(src);
    }

    if (op.type === 'reparent') {
      reparentKeepWorld(op.obj, op.target);
    }
  }

  return ops.length;
}

function createSkinnedFaceOverlayFromHead(headScene, faceTexture, bodySkeleton, faceAnchor) {
  if (!headScene || !faceTexture || !bodySkeleton || !faceAnchor) return 0;

  const faceMaterial = new MeshStandardMaterial({
    map: faceTexture,
    transparent: true,
    alphaTest: 0.5,
    depthWrite: false,
  });

  faceMaterial.polygonOffset = true;
  faceMaterial.polygonOffsetFactor = -1;
  faceMaterial.polygonOffsetUnits = -4;

  const candidates = [];
  const allMeshes = [];

  headScene.traverse((child) => {
    if (!(child.isMesh || child.isSkinnedMesh)) return;
    allMeshes.push(child);

    const name = (child.name || '').toLowerCase();
    const materialName = child.material?.name
      ? String(child.material.name).toLowerCase()
      : '';
    if (/(face|vibe|eyes|mask|decal)/.test(name) ||
        /(face|vibe|eyes|mask|decal)/.test(materialName)) {
      candidates.push(child);
    }
  });

  const targets = candidates.length ? candidates : allMeshes;
  let created = 0;

  for (const src of targets) {
    src.updateMatrixWorld(true);
    faceAnchor.updateMatrixWorld(true);

    let overlay;
    if (src.isSkinnedMesh) {
      overlay = new SkinnedMesh(src.geometry, faceMaterial);
      const bindMatrix = src.bindMatrix
        ? src.bindMatrix.clone()
        : new Matrix4();
      overlay.bind(bodySkeleton, bindMatrix);
      overlay.bindMode = src.bindMode || 'attached';
    } else {
      overlay = new Mesh(src.geometry, faceMaterial);
    }

    overlay.name = `${src.name || 'headMesh'}_FACE_OVERLAY`;
    overlay.renderOrder = 999;

    const local = new Matrix4()
      .copy(faceAnchor.matrixWorld)
      .invert()
      .multiply(src.matrixWorld);

    local.decompose(overlay.position, overlay.quaternion, overlay.scale);

    faceAnchor.add(overlay);
    created += 1;
  }

  return created;
}

const DEFAULT_HEAD_EMISSION = Object.freeze({
  color: 0xffffff,
  emissiveIntensity: 0.22,
  softWhite: false,
});

/**
 * Resolve a head-only material override.
 *
 * Ordinary heads return null so authored color and PBR values remain intact.
 * Bundled heads opt in declaratively; streamed metadata can use only the small
 * exact-name exception list above until each additional asset is reviewed.
 */
export function resolveHeadEmissionPresentation(trait) {
  const traitType = trait?.traitType ?? trait?.trait_type;
  if (String(traitType || '').toLowerCase() !== 'head') return null;

  const declared = trait?.presentation?.headEmission;
  if (declared === false) return null;
  if (declared === true) return { ...DEFAULT_HEAD_EMISSION };
  if (declared && typeof declared === 'object') {
    return { ...DEFAULT_HEAD_EMISSION, ...declared };
  }
  if (declared !== undefined) return null;

  const knownException = STREAMED_HEAD_EMISSION_EXCEPTIONS[String(trait?.value ?? '')];
  return knownException ? { ...DEFAULT_HEAD_EMISSION, ...knownException } : null;
}

export function applyFriendsiesHeadPresentation(headScene, trait) {
  const presentation = resolveHeadEmissionPresentation(trait);
  if (!headScene || !presentation) return false;

  let applied = false;
  headScene.traverse((child) => {
    if (!child.isMesh) return;

    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const mat of mats) {
      if (!mat?.emissive?.isColor) continue;
      if (presentation.softWhite) {
        mat.color?.set?.(0xffffff);
        if ('metalness' in mat) mat.metalness = 0.02;
        if ('roughness' in mat) mat.roughness = 0.92;
      }
      mat.emissive.set(presentation.color);
      mat.emissiveIntensity = presentation.emissiveIntensity;
      mat.needsUpdate = true;
      applied = true;
    }
  });
  return applied;
}

function addSoftHandheldGlow(partScene, bodySkeleton) {
  if (!partScene || !bodySkeleton) return null;

  const warmGlow = 0xffb35c;
  partScene.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material?.emissive?.isColor) continue;
      material.emissive.setHex(warmGlow);
      material.emissiveIntensity = 0.48;
      material.needsUpdate = true;
    }
  });

  const anchor = getBodyBoneByKey(bodySkeleton, 'attachmentr')
    || getBodyBoneByKey(bodySkeleton, 'handr');
  if (!anchor || anchor.getObjectByName('friendsies_hand_lantern_light')) return null;

  partScene.updateWorldMatrix(true, true);
  anchor.updateWorldMatrix(true, false);
  const bounds = new Box3().setFromObject(partScene, true);
  if (!Number.isFinite(bounds.min.y) || !Number.isFinite(bounds.max.y)) return null;

  const flameWorld = bounds.getCenter(new Vector3());
  flameWorld.y = bounds.max.y - (bounds.max.y - bounds.min.y) * 0.12;

  const light = new PointLight(warmGlow, 0.34, 2.6, 2);
  light.name = 'friendsies_hand_lantern_light';
  light.castShadow = false;
  light.userData.cameraCollision = false;
  light.position.copy(anchor.worldToLocal(flameWorld));
  anchor.add(light);
  return light;
}

function tuneMaterialsForEnv(root) {
  if (!root) return;
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (!mat) continue;
      if ('metalness' in mat) {
        if ((mat.metalness ?? 0) > 0.35) {
          mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 1, 1.35);
        } else {
          mat.envMapIntensity = Math.max(mat.envMapIntensity ?? 1, 1.05);
        }
        mat.needsUpdate = true;
      }
    }
  });
}

/**
 * Recursively dispose all GPU resources in a group
 */
function disposeGroupResources(group) {
  disposeLoadedResources([group]);
}

function disposeLoadedResources(roots = [], extraTextures = []) {
  const geometries = new Set();
  const materials = new Set();
  const skeletons = new Set();
  const textures = new Set(extraTextures.filter(Boolean));

  for (const root of roots.filter(Boolean)) {
    root.parent?.remove(root);
    root.traverse?.((child) => {
      if (!(child.isMesh || child.isSkinnedMesh)) return;
      if (child.geometry) geometries.add(child.geometry);
      if (child.isSkinnedMesh && child.skeleton) skeletons.add(child.skeleton);

      const childMaterials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const material of childMaterials) {
        if (!material) continue;
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value?.isTexture) textures.add(value);
        }
      }
    });
  }

  for (const texture of textures) texture.dispose?.();
  for (const skeleton of skeletons) skeleton.dispose?.();
  for (const material of materials) material.dispose?.();
  for (const geometry of geometries) geometry.dispose?.();
}

function safeObjectName(value) {
  return String(value ?? 'instance').replace(/[^a-zA-Z0-9_-]+/g, '_');
}
