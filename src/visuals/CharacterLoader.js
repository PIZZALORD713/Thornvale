/**
 * CharacterLoader - Loads fRiENDSiES characters from metadata
 * 
 * This is a placeholder that will be filled in during PR10-12
 * to port the character loading logic from the original HTML file.
 * 
 * Responsibilities:
 * - Fetch metadata from Gist
 * - Load body/head/parts GLBs
 * - Bind parts to body skeleton
 * - Create face texture overlay
 * - Create VisualRig with loaded character
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Metadata URL (same as original)
const METADATA_URL = "https://gist.githubusercontent.com/IntergalacticPizzaLord/a7b0eeac98041a483d715c8320ccf660/raw/ce7d37a94c33c63e2b50d5922e0711e72494c8dd/fRiENDSiES";

export class CharacterLoader {
  constructor() {
    this.metadata = null;
    this.metadataLoaded = false;
    
    // Loaders
    this.gltfLoader = null;
    this.textureLoader = null;
    
    // Loaded characters
    this.characters = new Map();

    this.currentLoadId = 0;
  }

  /**
   * Initialize loaders
   */
  init() {
    // DRACO decoder
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
    
    // GLTF loader
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.setDRACOLoader(dracoLoader);
    
    // Texture loader
    this.textureLoader = new THREE.TextureLoader();
    this.textureLoader.setCrossOrigin('anonymous');
    
    return this;
  }

  /**
   * Load metadata from Gist
   */
  async loadMetadata() {
    try {
      const response = await fetch(METADATA_URL, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      this.metadata = await response.json();
      this.metadataLoaded = true;
      
      console.log(`[CharacterLoader] Loaded ${this.metadata.length} tokens`);
      return true;
    } catch (err) {
      console.error('[CharacterLoader] Failed to load metadata:', err);
      return false;
    }
  }

  /**
   * Get entry by token ID
   */
  getEntryById(tokenId) {
    if (!this.metadata) return null;
    
    return this.metadata[tokenId] ||
           this.metadata[tokenId - 1] ||
           this.metadata.find(x => Number(x?.token_id) === tokenId) ||
           this.metadata.find(x => Number(x?.id) === tokenId) ||
           null;
  }

  /**
   * Load a character by token ID
   * @param {number} tokenId
   * @returns {Promise<THREE.Group|null>}
   */
  async loadCharacter(tokenId) {
    if (!this.metadataLoaded) {
      console.error('[CharacterLoader] Metadata not loaded');
      return null;
    }
    
    const entry = this.getEntryById(tokenId);
    if (!entry) {
      console.error(`[CharacterLoader] Token #${tokenId} not found`);
      return null;
    }

    const loadId = ++this.currentLoadId;

    const group = new THREE.Group();
    group.name = `character_${tokenId}`;
    group.scale.setScalar(5);
    group.position.set(0, -2.5, 0);

    const traits = entry.attributes || [];

    const faceAttr = traits.find((trait) => trait.trait_type === 'face');
    let faceTexture = null;
    if (faceAttr?.asset_url) {
      faceTexture = this.textureLoader.load(faceAttr.asset_url);
      faceTexture.minFilter = THREE.LinearFilter;
      faceTexture.repeat.y = -1;
      faceTexture.offset.y = 1;
      faceTexture.colorSpace = THREE.SRGBColorSpace;
    }

    const bodyAttr = traits.find((trait) => trait.trait_type === 'body');
    if (!bodyAttr?.asset_url) {
      console.error('[CharacterLoader] No body trait found');
      return null;
    }

    const bodyRes = await loadGLB(this.gltfLoader, bodyAttr.asset_url);
    if (loadId !== this.currentLoadId) return null;
    if (!bodyRes.ok) {
      console.error('[CharacterLoader] Body load failed:', bodyRes.error);
      return null;
    }

    const bodyRoot = bodyRes.gltf.scene;
    group.add(bodyRoot);

    const bodySkinned = findFirstSkinnedMesh(bodyRoot);
    if (!bodySkinned?.skeleton) {
      console.error('[CharacterLoader] Body missing skeleton');
      return null;
    }

    const bodySkeleton = bodySkinned.skeleton;

    const faceAnchor = new THREE.Object3D();
    faceAnchor.name = 'FACE_ANCHOR';
    const headBone = getBodyBoneByKey(bodySkeleton, 'head') || getBodyBoneByKey(bodySkeleton, 'neck');
    if (headBone) headBone.add(faceAnchor);
    else group.add(faceAnchor);

    tuneMaterialsForEnv(bodyRoot);

    const headAttr = traits.find((trait) => trait.trait_type === 'head');
    if (headAttr?.asset_url) {
      const headRes = await loadGLB(this.gltfLoader, headAttr.asset_url);
      if (loadId !== this.currentLoadId) return null;
      if (headRes.ok) {
        const headScene = headRes.gltf.scene;
        group.add(headScene);
        group.updateMatrixWorld(true);

        attachPartToBodySkeleton(headScene, bodySkeleton, bodySkinned);
        createSkinnedFaceOverlayFromHead(headScene, faceTexture, bodySkeleton, faceAnchor);
        retargetRigidAttachmentsToBodyBones(headScene, bodySkeleton);
        boostHeadEmissive(headScene, 2.3);
        tuneMaterialsForEnv(headScene);
      }
    }

    const partTraits = traits.filter(
      (trait) => !['body', 'head', 'face'].includes(trait.trait_type)
    );

    for (const trait of partTraits) {
      if (!trait.asset_url || !trait.asset_url.endsWith('.glb')) continue;

      const partRes = await loadGLB(this.gltfLoader, trait.asset_url);
      if (loadId !== this.currentLoadId) return null;
      if (!partRes.ok) continue;

      const partScene = partRes.gltf.scene;
      group.add(partScene);
      group.updateMatrixWorld(true);

      attachPartToBodySkeleton(partScene, bodySkeleton, bodySkinned);
      retargetRigidAttachmentsToBodyBones(partScene, bodySkeleton);
      tuneMaterialsForEnv(partScene);
    }

    this.characters.set(tokenId, { group, entry });

    return group;
  }

  /**
   * Remove a loaded character
   */
  removeCharacter(tokenId) {
    const char = this.characters.get(tokenId);
    if (char) {
      char.group.parent?.remove(char.group);
      this.characters.delete(tokenId);
    }
  }

  /**
   * Clear all characters
   */
  clearAll() {
    for (const [tokenId] of this.characters) {
      this.removeCharacter(tokenId);
    }
  }
}

// Helper: Load GLB with timeout
function loadGLB(loader, url, timeout = 30000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ ok: false, error: 'Timeout' });
    }, timeout);
    
    loader.load(
      url,
      (gltf) => {
        clearTimeout(timer);
        resolve({ ok: true, gltf });
      },
      undefined,
      (err) => {
        clearTimeout(timer);
        resolve({ ok: false, error: err.message || 'Unknown error' });
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
      : new THREE.Matrix4();
    child.bind(bodySkeleton, bindMatrix);
    child.bindMode = bodySkinned.bindMode || child.bindMode;
    child.frustumCulled = false;
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

  const inv = new THREE.Matrix4().copy(newParent.matrixWorld).invert();
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

      const skinned = new THREE.SkinnedMesh(src.geometry, src.material);
      skinned.name = `${src.name || 'mesh'}_SKINNED_FROM_MESH`;
      skinned.position.copy(src.position);
      skinned.quaternion.copy(src.quaternion);
      skinned.scale.copy(src.scale);

      const bindMatrix = new THREE.Matrix4();
      skinned.bind(bodySkeleton, bindMatrix);
      skinned.frustumCulled = false;

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
  if (!headScene || !faceTexture || !bodySkeleton || !faceAnchor) return;

  const faceMaterial = new THREE.MeshStandardMaterial({
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

  for (const src of targets) {
    src.updateMatrixWorld(true);
    faceAnchor.updateMatrixWorld(true);

    let overlay;
    if (src.isSkinnedMesh) {
      overlay = new THREE.SkinnedMesh(src.geometry, faceMaterial);
      const bindMatrix = src.bindMatrix
        ? src.bindMatrix.clone()
        : new THREE.Matrix4();
      overlay.bind(bodySkeleton, bindMatrix);
      overlay.bindMode = src.bindMode || 'attached';
    } else {
      overlay = new THREE.Mesh(src.geometry, faceMaterial);
    }

    overlay.name = `${src.name || 'headMesh'}_FACE_OVERLAY`;
    overlay.renderOrder = 999;
    overlay.frustumCulled = false;

    const local = new THREE.Matrix4()
      .copy(faceAnchor.matrixWorld)
      .invert()
      .multiply(src.matrixWorld);

    local.decompose(overlay.position, overlay.quaternion, overlay.scale);

    faceAnchor.add(overlay);
  }
}

function boostHeadEmissive(headScene, intensity = 2.3) {
  if (!headScene) return;
  headScene.traverse((child) => {
    if (!child.isMesh) return;

    const mats = Array.isArray(child.material)
      ? child.material
      : [child.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (mat.emissiveMap) {
        mat.emissive = new THREE.Color(0xffffff);
        mat.emissiveIntensity = intensity;
        mat.needsUpdate = true;
      }
    }
  });
}

function tuneMaterialsForEnv(root) {
  if (!root) return;
  root.traverse((child) => {
    if (!child.isMesh) return;
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
