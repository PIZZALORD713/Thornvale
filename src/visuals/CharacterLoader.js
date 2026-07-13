/**
 * CharacterLoader - Loads fRiENDSiES characters from metadata
 *
 * Responsibilities:
 * - Fetch one selected metadata entry from the pinned catalog
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
import {
  getFriendsiesHeadEmissionException,
  getCuratedFriendsiesEntry,
  hasCuratedFriendsiesCharacter,
} from '../content/friendsies-cast.js';
import {
  FRIENDSIES_METADATA_CATALOG_BYTE_LENGTH,
  FRIENDSIES_METADATA_CATALOG_URL,
  FRIENDSIES_TOKEN_MAX,
  FRIENDSIES_TOKEN_MIN,
  parseFriendsiesTokenSelector,
  resolveFriendsiesComponentAssetUrl,
} from '../config/player-character.js';

const METADATA_TOKEN_COUNT = FRIENDSIES_TOKEN_MAX - FRIENDSIES_TOKEN_MIN + 1;
const METADATA_RANGE_CHUNK_SIZE = 192 * 1024;
const METADATA_RANGE_ATTEMPTS = 10;
const METADATA_ENTRY_EXPANSION = 256 * 1024;
const UTF8_ENCODER = new TextEncoder();

/**
 * Fetch one exact token entry from the pinned, numerically ordered catalog.
 * GitHub's raw endpoint supports CORS byte ranges, so arbitrary player links
 * do not need to transfer or parse the complete 18.5 MB collection document.
 */
export async function fetchFriendsiesTokenMetadata(tokenId, options = {}) {
  const numericTokenId = parseFriendsiesTokenSelector(tokenId);
  if (numericTokenId === null) return null;

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable');

  const url = options.url || FRIENDSIES_METADATA_CATALOG_URL;
  const byteLength = positiveInteger(
    options.byteLength,
    FRIENDSIES_METADATA_CATALOG_BYTE_LENGTH,
  );
  const tokenCount = positiveInteger(options.tokenCount, METADATA_TOKEN_COUNT);
  const chunkSize = Math.min(
    byteLength,
    positiveInteger(options.chunkSize, METADATA_RANGE_CHUNK_SIZE),
  );
  const maxAttempts = positiveInteger(options.maxAttempts, METADATA_RANGE_ATTEMPTS);

  let low = 0;
  let high = byteLength - 1;
  const proportionalPosition = tokenCount > 1
    ? (numericTokenId - 1) / (tokenCount - 1)
    : 0;
  let cursor = Math.round(clamp(proportionalPosition, 0, 1) * high);
  const seenRanges = new Set();

  for (let attempt = 0; attempt < maxAttempts && low <= high; attempt += 1) {
    cursor = clamp(Math.round(cursor), low, high);
    let start = clamp(
      cursor - Math.floor(chunkSize / 2),
      0,
      Math.max(0, byteLength - chunkSize),
    );
    let end = Math.min(byteLength - 1, start + chunkSize - 1);

    const rangeKey = `${start}-${end}`;
    if (seenRanges.has(rangeKey)) {
      cursor = Math.floor((low + high) / 2);
      start = clamp(
        cursor - Math.floor(chunkSize / 2),
        0,
        Math.max(0, byteLength - chunkSize),
      );
      end = Math.min(byteLength - 1, start + chunkSize - 1);
      if (seenRanges.has(`${start}-${end}`)) break;
    }
    seenRanges.add(`${start}-${end}`);

    const range = await fetchMetadataRange(fetchImpl, url, start, end, options.signal);
    if (range.status === 200) {
      return entryFromCompleteCatalog(range.text, numericTokenId);
    }

    const markers = findMetadataEntryMarkers(range.text);
    const exact = markers.find((marker) => marker.tokenId === numericTokenId);
    if (exact) {
      const entry = extractMetadataEntry(range.text, exact);
      if (entry) return entryMatchesToken(entry, numericTokenId) ? entry : null;

      // The key landed at the end of the first range. Refetch a bounded window
      // beginning just before it so the complete object can be balanced.
      const exactByte = start + utf8ByteOffset(range.text, exact.index);
      const expandedStart = Math.max(0, exactByte - 32);
      const expandedEnd = Math.min(
        byteLength - 1,
        expandedStart + METADATA_ENTRY_EXPANSION - 1,
      );
      const expanded = await fetchMetadataRange(
        fetchImpl,
        url,
        expandedStart,
        expandedEnd,
        options.signal,
      );
      if (expanded.status === 200) {
        return entryFromCompleteCatalog(expanded.text, numericTokenId);
      }
      const expandedMarker = findMetadataEntryMarkers(expanded.text)
        .find((marker) => marker.tokenId === numericTokenId);
      const expandedEntry = expandedMarker
        ? extractMetadataEntry(expanded.text, expandedMarker)
        : null;
      return expandedEntry && entryMatchesToken(expandedEntry, numericTokenId)
        ? expandedEntry
        : null;
    }

    if (markers.length === 0) {
      cursor = Math.floor((low + high) / 2);
      continue;
    }

    const first = markers[0];
    const last = markers[markers.length - 1];
    const firstByte = start + utf8ByteOffset(range.text, first.index);
    const lastByte = start + utf8ByteOffset(range.text, last.index);

    if (numericTokenId < first.tokenId) {
      high = Math.min(high, firstByte - 1);
    } else if (numericTokenId > last.tokenId) {
      low = Math.max(low, lastByte + 1);
    } else {
      // Numeric catalog order says a missing key in this interval is absent.
      return null;
    }

    const bytesPerToken = last.tokenId > first.tokenId
      ? (lastByte - firstByte) / (last.tokenId - first.tokenId)
      : 0;
    if (bytesPerToken > 0) {
      cursor = numericTokenId < first.tokenId
        ? firstByte - (first.tokenId - numericTokenId) * bytesPerToken
        : lastByte + (numericTokenId - last.tokenId) * bytesPerToken;
    } else {
      cursor = Math.floor((low + high) / 2);
    }
    if (!Number.isFinite(cursor) || cursor < low || cursor > high) {
      cursor = Math.floor((low + high) / 2);
    }
  }

  return null;
}

export class CharacterLoader {
  constructor() {
    this.metadata = null;
    this.metadataLoaded = false;
    this.tokenMetadata = new Map();

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

  /** Load only one token entry from the pinned catalog using byte ranges. */
  async loadTokenMetadata(tokenId, { timeout = 10000 } = {}) {
    const numericTokenId = parseFriendsiesTokenSelector(tokenId);
    if (numericTokenId === null) return null;

    const existing = this.tokenMetadata.get(numericTokenId);
    if (existing) return existing;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const entry = await fetchFriendsiesTokenMetadata(numericTokenId, {
        signal: controller.signal,
      });
      if (!entry) return null;
      this.tokenMetadata.set(numericTokenId, entry);
      this.metadataLoaded = true;
      return entry;
    } catch (error) {
      const reason = error?.name === 'AbortError'
        ? `timed out after ${timeout}ms`
        : error;
      console.warn(`[CharacterLoader] Token #${numericTokenId} metadata unavailable:`, reason);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Get entry by token ID
   */
  getEntryById(tokenId) {
    const bundled = getCuratedFriendsiesEntry(tokenId);
    if (bundled?.bundledCharacter) return bundled;
    const ranged = this.tokenMetadata.get(Number(tokenId));
    if (ranged) return ranged;
    if (!this.metadata) return bundled || null;

    if (!Array.isArray(this.metadata)) {
      const direct = this.metadata[tokenId] || this.metadata[String(tokenId)];
      if (direct) return direct;
      return Object.values(this.metadata).find(
        (entry) => entryMatchesToken(entry, tokenId),
      ) || null;
    }

    const exact = this.metadata.find((entry) => entryMatchesToken(entry, tokenId));
    if (exact) return exact;

    // Retain compatibility with anonymous zero/one-based legacy arrays, but
    // never let an indexed neighbor override an entry carrying another ID.
    for (const candidate of [
      this.metadata[Number(tokenId) - 1],
      this.metadata[Number(tokenId)],
    ]) {
      if (candidate && entryTokenId(candidate) === null) return candidate;
    }
    return null;
  }

  hasBundledCharacter(tokenId) {
    return hasCuratedFriendsiesCharacter(tokenId);
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
    const bundled = this.hasBundledCharacter(tokenId);
    const componentUrl = (trait) => resolveFriendsiesComponentAssetUrl(
      trait?.asset_url,
      { bundled },
    );

    const bodyAttr = traits.find((trait) => trait.trait_type === 'body');
    const bodyUrl = componentUrl(bodyAttr);
    if (!bodyUrl) {
      console.error('[CharacterLoader] No loadable body trait found');
      return null;
    }

    const faceAttr = traits.find((trait) => trait.trait_type === 'face');
    const headAttr = traits.find((trait) => trait.trait_type === 'head');
    const faceUrl = componentUrl(faceAttr);
    const headUrl = componentUrl(headAttr);

    // Load body, head, and face texture in parallel
    const [bodyRes, headRes, faceTexture] = await Promise.all([
      loadGLB(this.gltfLoader, bodyUrl),
      headUrl ? loadGLB(this.gltfLoader, headUrl) : Promise.resolve(null),
      faceUrl ? loadTexture(this.textureLoader, faceUrl) : Promise.resolve(null),
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
      role: entry.role || null,
      storyUse: Array.isArray(entry.storyUse) ? [...entry.storyUse] : [],
      licenseStatus: entry.licenseStatus || null,
      redistributionStatus: entry.redistributionStatus || null,
      source: entry.source || null,
      traits,
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
      .map((trait) => ({
        url: componentUrl(trait),
        traitType: trait.trait_type,
        value: trait.value,
        presentation: trait.presentation,
      }))
      .filter((asset) => asset.url?.endsWith('.glb'));

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
        const handheldGlow = resolveHandheldGlowPresentation(asset);
        if (handheldGlow) {
          addSoftHandheldGlow(partScene, bodySkeleton, handheldGlow);
        }
        tuneMaterialsForEnv(partScene);
      }
    }

    if (!this._isCurrentLoad(instanceId, loadRevision)) {
      disposeGroupResources(group);
      return null;
    }

    this._storeCharacter(instanceId, tokenId, entry, group);

    return group;
  }

  _storeCharacter(instanceId, tokenId, entry, group) {
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

async function fetchMetadataRange(fetchImpl, url, start, end, signal) {
  const response = await fetchImpl(url, {
    mode: 'cors',
    cache: 'force-cache',
    signal,
    headers: {
      Range: `bytes=${start}-${end}`,
    },
  });
  if (!response.ok || ![200, 206].includes(response.status)) {
    throw new Error(`Metadata range request failed with HTTP ${response.status}`);
  }
  return {
    status: response.status,
    text: await response.text(),
  };
}

function findMetadataEntryMarkers(text) {
  const markers = [];
  const pattern = /"(\d+)":\s*\{"id":\s*"(\d+)"/g;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const tokenId = Number(match[1]);
    if (tokenId !== Number(match[2])) continue;
    markers.push({ tokenId, index: match.index });
  }
  return markers;
}

function extractMetadataEntry(text, marker) {
  const objectStart = text.indexOf('{', marker.index);
  if (objectStart < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = objectStart; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(objectStart, index + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function entryFromCompleteCatalog(text, tokenId) {
  try {
    const catalog = JSON.parse(text);
    const entry = catalog?.[tokenId] ?? catalog?.[String(tokenId)] ?? null;
    return entry && entryMatchesToken(entry, tokenId) ? entry : null;
  } catch {
    return null;
  }
}

function utf8ByteOffset(text, stringIndex) {
  return UTF8_ENCODER.encode(text.slice(0, stringIndex)).byteLength;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
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

function entryTokenId(entry) {
  const value = entry?.token_id ?? entry?.id;
  if (value === undefined || value === null || value === '') return null;
  const tokenId = Number(value);
  return Number.isFinite(tokenId) ? tokenId : null;
}

function entryMatchesToken(entry, tokenId) {
  const entryId = entryTokenId(entry);
  return entryId !== null && entryId === Number(tokenId);
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
 * Ordinary heads intentionally return null so their authored material stays
 * untouched. Curated traits opt in declaratively; streamed metadata can use
 * only the small exact-name exception list in friendsies-cast.js.
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

  const knownException = getFriendsiesHeadEmissionException(trait?.value);
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

const DEFAULT_HANDHELD_GLOW = Object.freeze({
  color: 0xffb35c,
  emissiveIntensity: 0.48,
  lightIntensity: 0.34,
  lightDistance: 2.6,
  lightDecay: 2,
  flameOffsetFromTop: 0.12,
});

/**
 * Resolve presentation data for a held light source.
 *
 * Curated traits opt in explicitly. The name fallback keeps streamed legacy
 * metadata working until the remote collection index carries presentation
 * metadata of its own.
 */
export function resolveHandheldGlowPresentation(trait) {
  const traitType = trait?.traitType ?? trait?.trait_type;
  if (String(traitType || '').toLowerCase() !== 'hand') return null;

  const declared = trait?.presentation?.handheldGlow;
  if (declared === false) return null;
  if (declared === true) return { ...DEFAULT_HANDHELD_GLOW };
  if (declared && typeof declared === 'object') {
    return { ...DEFAULT_HANDHELD_GLOW, ...declared };
  }

  if (/torch|lantern/i.test(trait?.value || '')) {
    return { ...DEFAULT_HANDHELD_GLOW };
  }
  return null;
}

function addSoftHandheldGlow(partScene, bodySkeleton, presentation = DEFAULT_HANDHELD_GLOW) {
  if (!partScene || !bodySkeleton) return null;

  const warmGlow = presentation.color;
  partScene.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (!material?.emissive?.isColor) continue;
      material.emissive.set(warmGlow);
      material.emissiveIntensity = presentation.emissiveIntensity;
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
  flameWorld.y = bounds.max.y
    - (bounds.max.y - bounds.min.y) * presentation.flameOffsetFromTop;

  const light = new PointLight(
    warmGlow,
    presentation.lightIntensity,
    presentation.lightDistance,
    presentation.lightDecay,
  );
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
