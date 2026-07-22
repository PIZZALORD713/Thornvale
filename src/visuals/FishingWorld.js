import {
  Box3,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { STEWARDSHIP_V01 } from '../content/stewardship-v01.js';

export const FRIENDSIES_FISHING_POLE_URL = '/friendsies/tools/fishing-pole-v1.glb';

export function prepareFishingPoleAsset(root) {
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (object.isSkinnedMesh) object.skeleton.update();
  });

  // hand:Guess is rigidly weighted to Attachment.R, but retaining the whole
  // character skeleton makes an equipment-only transform behave differently
  // before and after the first render. Bake frame zero into ordinary meshes so
  // normalization is deterministic and the pole can be placed like a prop.
  const presentation = new Group();
  presentation.name = 'friendsies_fishing_pole_frame_zero';
  let meshCount = 0;
  root.traverse((object) => {
    if (!object.isMesh) return;
    meshCount += 1;
    const geometry = object.geometry.clone();
    if (object.isSkinnedMesh) {
      const positions = geometry.getAttribute('position');
      const vertex = new Vector3();
      for (let index = 0; index < positions.count; index += 1) {
        vertex.fromBufferAttribute(positions, index);
        object.applyBoneTransform(index, vertex);
        positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
      }
      positions.needsUpdate = true;
    }
    geometry.applyMatrix4(object.matrixWorld);
    if (geometry.getAttribute('normal')) geometry.computeVertexNormals();

    const mesh = new Mesh(geometry, object.material);
    mesh.name = object.name || `friendsies_fishing_pole_mesh_${meshCount}`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.userData.cameraCollision = false;
    mesh.userData.physicsCollision = false;
    presentation.add(mesh);
  });
  if (meshCount < 1) throw new Error('Canonical fishing pole contains no renderable mesh');

  presentation.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(presentation, true);
  const size = bounds.getSize(new Vector3());
  if (bounds.isEmpty() || ![size.x, size.y, size.z].every(Number.isFinite)) {
    throw new Error('Canonical fishing pole bounds are empty or non-finite');
  }
  const longest = Math.max(size.x, size.y, size.z);
  if (!(longest > 0)) throw new Error('Canonical fishing pole has zero extent');

  // Keep the source binary unchanged. Normalize its frame-zero hand-trait pose
  // under the same ThornVale-owned anchor as the procedural rod.
  presentation.scale.setScalar(2.25 / longest);
  presentation.updateWorldMatrix(true, true);
  const normalized = new Box3().setFromObject(presentation, true);
  const center = normalized.getCenter(new Vector3());
  presentation.position.sub(center);
  return presentation;
}

export async function loadCanonicalFishingPole(url = FRIENDSIES_FISHING_POLE_URL) {
  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  try {
    const gltf = await loader.loadAsync(url);
    return prepareFishingPoleAsset(gltf.scene);
  } finally {
    draco.dispose();
  }
}

function disposeObjectResources(root) {
  const textures = new Set();
  root?.traverse?.((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      for (const value of Object.values(material)) {
        if (value?.isTexture) textures.add(value);
      }
      material.dispose?.();
    });
  });
  textures.forEach((texture) => texture.dispose?.());
}

/** Visual-only projection for the simple rod, hook, bobber, and hooked fish. */
export class FishingWorld {
  constructor({
    content = STEWARDSHIP_V01,
    reducedMotion = false,
    poleLoader = loadCanonicalFishingPole,
    onAssetWarning = (...args) => console.warn(...args),
  } = {}) {
    this.content = content;
    this.reducedMotion = Boolean(reducedMotion);
    this.poleLoader = poleLoader;
    this.onAssetWarning = onAssetWarning;
    this.root = new Group();
    this.root.name = 'stewardship_fishing_world';
    this.root.position.set(...content.fishing.position);
    this.interactables = [{
      id: content.ids.fishingSpot,
      position: new Vector3(...content.fishing.position),
      radius: 2.25,
      prompt: 'Cast into the quiet pond',
    }];
    this.materials = [];
    this.geometries = [];
    this.time = 0;
    this.state = null;
    this.initialized = false;
    this.disposed = false;
    this.poleAssetStatus = 'fallback';
    this.poleAssetReady = Promise.resolve(false);
    this._build();
  }

  init() {
    if (this.initialized || this.disposed) return this;
    this.initialized = true;
    this.poleAssetReady = this._loadFishingPoleAsset();
    return this;
  }

  _material(color, options = {}) {
    const material = new MeshStandardMaterial({
      color,
      roughness: options.roughness ?? 0.78,
      metalness: options.metalness ?? 0,
      transparent: options.transparent ?? false,
      opacity: options.opacity ?? 1,
    });
    this.materials.push(material);
    return material;
  }

  _mesh(geometry, material) {
    this.geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.cameraCollision = false;
    mesh.userData.physicsCollision = false;
    return mesh;
  }

  _build() {
    const wood = this._material(0x8a5c43);
    const cork = this._material(0xe67d68);
    const hookMetal = this._material(0xaebbc0, { metalness: 0.55, roughness: 0.35 });
    const fishMaterial = this._material(0x5b9299, { transparent: true, opacity: 0.55 });
    this.rod = new Group();
    this.rod.name = 'stewardship_fishing_pole_anchor';
    this.rod.position.set(-0.52, 1.03, 0.32);
    this.rod.rotation.z = -0.48;
    this.rodFallback = this._mesh(new CylinderGeometry(0.018, 0.034, 2.25, 8), wood);
    this.rodFallback.name = 'stewardship_fishing_pole_procedural_fallback';
    this.rod.add(this.rodFallback);
    this.root.add(this.rod);

    this.bobber = this._mesh(new SphereGeometry(0.09, 10, 7), cork);
    this.bobber.position.set(1.24, -0.12, -0.34);
    this.root.add(this.bobber);

    this.hook = this._mesh(new TorusGeometry(0.075, 0.012, 6, 10, Math.PI * 1.45), hookMetal);
    this.hook.position.set(1.24, -0.48, -0.34);
    this.hook.rotation.z = -0.35;
    this.root.add(this.hook);

    const lineGeometry = new BufferGeometry().setFromPoints([
      new Vector3(0.02, 1.85, 0.32),
      this.bobber.position,
    ]);
    this.geometries.push(lineGeometry);
    this.lineMaterial = new LineBasicMaterial({ color: 0xe8e2cf, transparent: true, opacity: 0.72 });
    this.materials.push(this.lineMaterial);
    this.line = new Line(lineGeometry, this.lineMaterial);
    this.root.add(this.line);

    this.fishShadow = this._mesh(new SphereGeometry(0.25, 12, 7), fishMaterial);
    this.fishShadow.scale.set(1.55, 0.28, 0.62);
    this.fishShadow.position.set(1.18, -0.54, -0.34);
    this.fishShadow.visible = false;
    this.root.add(this.fishShadow);
  }

  async _loadFishingPoleAsset() {
    try {
      const canonical = await this.poleLoader(FRIENDSIES_FISHING_POLE_URL);
      if (this.disposed) {
        disposeObjectResources(canonical);
        return false;
      }
      canonical.name = 'friendsies_fishing_pole_canonical';
      this.rod.add(canonical);
      this.canonicalPole = canonical;
      this.rodFallback.visible = false;
      this.poleAssetStatus = 'canonical';
      return true;
    } catch (error) {
      if (!this.disposed) {
        this.poleAssetStatus = 'fallback';
        this.onAssetWarning(
          '[FishingWorld] Canonical fishing pole unavailable; using procedural fallback.',
          error,
        );
      }
      return false;
    }
  }

  setState(state) {
    this.state = state;
    const active = Boolean(state?.active);
    this.bobber.visible = active;
    this.hook.visible = active;
    this.line.visible = active;
    this.fishShadow.visible = active && ['bite', 'struggle', 'landing'].includes(state.phase);
    return state;
  }

  update(dt) {
    this.time += Math.min(0.1, Math.max(0, Number(dt) || 0));
    if (!this.state?.active) return;
    const bite = ['bite', 'struggle'].includes(this.state.phase);
    const motion = this.reducedMotion ? 0 : Math.sin(this.time * (bite ? 13 : 2.6));
    this.bobber.position.y = -0.12 + motion * (bite ? 0.065 : 0.018);
    this.hook.position.y = this.bobber.position.y - 0.36;
    if (this.fishShadow.visible) {
      this.fishShadow.position.x = 1.18 + Math.sin(this.time * 4.8) * 0.24;
      this.fishShadow.rotation.y = Math.sin(this.time * 3.2) * 0.45;
    }
    this.line.geometry.setFromPoints([new Vector3(0.02, 1.85, 0.32), this.bobber.position]);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.root.removeFromParent();
    if (this.canonicalPole) disposeObjectResources(this.canonicalPole);
    this.geometries.forEach((geometry) => geometry.dispose?.());
    this.materials.forEach((material) => material.dispose?.());
    this.interactables.length = 0;
  }
}
