import { Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const COTTAGE_URL = '/town/cottages/thornvale-cottages.glb';
const DRESSING_URL = '/village/thornvale-village-dressing.glb';

const COTTAGE_NODE_BY_ID = Object.freeze({
  'berry-bakery': 'Cottage_berry_bakery',
  'lavender-library': 'Cottage_lavender_library',
  'mint-tea-house': 'Cottage_mint_tea_house',
  'rose-post-office': 'Cottage_rose_post_office',
});

function remapMaterial(material, townMaterials) {
  if (!material || !townMaterials) return material;
  if (/window.?glow/i.test(material.name || '')) return townMaterials.windowGlow;
  return material;
}

function prepareAsset(root, townMaterials, { cameraCollision = true } = {}) {
  if (!cameraCollision) root.userData.cameraCollision = false;
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    if (!cameraCollision) object.userData.cameraCollision = false;
    if (Array.isArray(object.material)) {
      object.material = object.material.map((material) => remapMaterial(material, townMaterials));
    } else {
      object.material = remapMaterial(object.material, townMaterials);
    }
  });
  return root;
}

async function loadScene(url) {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}

export async function loadAuthoredCottages(buildings, townMaterials) {
  try {
    const source = await loadScene(COTTAGE_URL);
    const cottages = new Map();
    for (const building of buildings) {
      const nodeName = COTTAGE_NODE_BY_ID[building.id];
      const template = nodeName ? source.getObjectByName(nodeName) : null;
      if (!template) throw new Error(`Missing cottage node ${nodeName || building.id}`);

      const cottage = prepareAsset(template.clone(true), townMaterials, {
        cameraCollision: false,
      });
      cottage.name = `cozy_cottage_${building.id}_authored`;
      cottage.position.set(building.position.x, 0, building.position.z);
      cottage.rotation.set(0, building.frontSign < 0 ? Math.PI : 0, 0);
      cottage.scale.setScalar(1);
      cottage.updateMatrixWorld(true);
      cottages.set(building.id, cottage);
    }
    return cottages;
  } catch (error) {
    console.warn('[TownAssetLoader] Blender cottage kit unavailable; using procedural cottages.', error);
    return new Map();
  }
}

export async function loadAuthoredVillageProps(layout, townMaterials) {
  const root = new Group();
  root.name = 'authored_village_dressing';

  try {
    const source = await loadScene(DRESSING_URL);
    for (const [id, placement] of Object.entries(layout.authoredProps)) {
      const template = source.getObjectByName(placement.asset);
      if (!template) throw new Error(`Missing village prop node ${placement.asset}`);
      const prop = prepareAsset(template.clone(true), townMaterials, {
        cameraCollision: false,
      });
      prop.name = `authored_${id}`;
      prop.position.set(placement.x, placement.y, placement.z);
      prop.rotation.set(0, placement.rotationY || 0, 0);
      prop.scale.setScalar(1);
      prop.updateMatrixWorld(true);
      root.add(prop);
    }
  } catch (error) {
    console.warn('[TownAssetLoader] Blender village dressing unavailable.', error);
  }
  return root;
}
