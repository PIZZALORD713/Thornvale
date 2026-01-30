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
    this.textureLoader.crossOrigin = 'anonymous';
    
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
    
    // TODO: Implement full loading logic from original file
    // For now, return a placeholder
    console.log(`[CharacterLoader] Would load #${tokenId}:`, entry);
    
    // Placeholder group
    const group = new THREE.Group();
    group.name = `character_${tokenId}`;
    group.scale.setScalar(10); // Same scale as original
    
    // Placeholder mesh
    const geo = new THREE.CapsuleGeometry(0.035, 0.11, 8, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff6b35 });
    const mesh = new THREE.Mesh(geo, mat);
    group.add(mesh);
    
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
