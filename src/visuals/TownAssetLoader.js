import { Box3, Group, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import {
  ASSET_VARIANTS,
  DEFAULT_ASSET_VARIANT,
  normalizeAssetVariant,
  TOWN_ASSET_PATHS,
} from '../config/assets.js';

const COTTAGE_URL = TOWN_ASSET_PATHS.cottages;
const DRESSING_URL = TOWN_ASSET_PATHS.villageDressing;

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

async function loadScene(url, { draco = false } = {}) {
  const loader = new GLTFLoader();
  let dracoLoader = null;
  if (draco) {
    dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');
    loader.setDRACOLoader(dracoLoader);
  }
  try {
    const gltf = await loader.loadAsync(url);
    return gltf.scene;
  } finally {
    dracoLoader?.dispose();
  }
}

function getPilotPlacements(layout) {
  const roots = TOWN_ASSET_PATHS.arrivalPlazaPilot.roots;
  return {
    welcomeGate: {
      asset: roots.welcomeGate,
      position: layout.gate,
    },
    ledger: {
      asset: roots.ledger,
      position: { ...layout.landmarks.ledger, y: 0 },
    },
    bell: {
      asset: roots.bell,
      position: {
        ...layout.landmarks.bell,
        y: layout.landmarks.bell.baseY || 0,
      },
      requiredChild: 'TownBellSwing',
    },
  };
}

function validatePilotGeometry(root, assetName) {
  let hasGeometry = false;
  root.traverse((object) => {
    if (object === root || !object.isMesh) return;
    const position = object.geometry?.getAttribute?.('position');
    if (position?.itemSize >= 3 && position.count >= 3) hasGeometry = true;
  });
  if (!hasGeometry) {
    throw new Error(`Pilot root ${assetName} has no descendant mesh geometry`);
  }

  root.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(root, true);
  const boundsValues = [
    bounds.min.x,
    bounds.min.y,
    bounds.min.z,
    bounds.max.x,
    bounds.max.y,
    bounds.max.z,
  ];
  const size = bounds.getSize(new Vector3());
  if (
    bounds.isEmpty()
    || !boundsValues.every(Number.isFinite)
    || !Number.isFinite(size.lengthSq())
    || size.lengthSq() <= 0
  ) {
    throw new Error(`Pilot root ${assetName} has empty or non-finite bounds`);
  }
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

export async function loadAuthoredVillageProps(layout, townMaterials, {
  assetVariant = DEFAULT_ASSET_VARIANT,
  sceneLoader = loadScene,
  baselineUrl = DRESSING_URL,
  candidateUrl = TOWN_ASSET_PATHS.wayfinderPilot.url,
} = {}) {
  const root = new Group();
  root.name = 'authored_village_dressing';

  let source = null;
  try {
    source = await sceneLoader(baselineUrl);
  } catch (error) {
    console.warn('[TownAssetLoader] Blender village dressing unavailable.', error);
  }

  let wayfinderCandidate = null;
  if (normalizeAssetVariant(assetVariant) === ASSET_VARIANTS.PILOT) {
    try {
      const candidate = await sceneLoader(candidateUrl, { draco: true });
      const template = candidate.getObjectByName(TOWN_ASSET_PATHS.wayfinderPilot.root);
      if (!template) throw new Error(`Missing Wayfinder pilot root ${TOWN_ASSET_PATHS.wayfinderPilot.root}`);
      validatePilotGeometry(template, TOWN_ASSET_PATHS.wayfinderPilot.root);
      wayfinderCandidate = template;
    } catch (error) {
      console.warn('[TownAssetLoader] Pizza Lab Wayfinder unavailable; using its baseline root.', error);
    }
  }

  for (const [id, placement] of Object.entries(layout.authoredProps)) {
    try {
      const template = id === 'wayfinder' && wayfinderCandidate
        ? wayfinderCandidate
        : source?.getObjectByName(placement.asset);
      if (!template) throw new Error(`Missing village prop node ${placement.asset}`);
      const prop = prepareAsset(template.clone(true), townMaterials, {
        cameraCollision: false,
      });
      prop.name = `authored_${id}`;
      prop.position.set(placement.x, placement.y, placement.z);
      prop.rotation.set(0, placement.rotationY || 0, 0);
      prop.scale.setScalar(1);
      if (id === 'wayfinder' && wayfinderCandidate) {
        prop.userData.assetVariant = ASSET_VARIANTS.PILOT;
        prop.userData.assetVersion = TOWN_ASSET_PATHS.wayfinderPilot.version;
        prop.userData.assetHash = TOWN_ASSET_PATHS.wayfinderPilot.sha256;
      }
      prop.updateMatrixWorld(true);
      root.add(prop);
    } catch (error) {
      console.warn(`[TownAssetLoader] Authored village prop ${id} unavailable.`, error);
    }
  }
  return root;
}

/**
 * Load the three reversible arrival/plaza pilot roots.
 *
 * Each root is validated and admitted independently. A missing or malformed
 * root is omitted from the returned map so TownBuilder can use that root's
 * procedural factory without discarding the other authored roots.
 */
export async function loadAuthoredPilotLandmarks(layout, townMaterials, {
  assetVariant = DEFAULT_ASSET_VARIANT,
  sceneLoader = loadScene,
  url = TOWN_ASSET_PATHS.arrivalPlazaPilot.url,
} = {}) {
  const landmarks = new Map();
  if (normalizeAssetVariant(assetVariant) !== ASSET_VARIANTS.PILOT) return landmarks;

  try {
    const source = await sceneLoader(url);
    for (const [id, placement] of Object.entries(getPilotPlacements(layout))) {
      try {
        const template = source.getObjectByName(placement.asset);
        if (!template) throw new Error(`Missing pilot root ${placement.asset}`);
        if (placement.requiredChild) {
          const requiredChild = template.getObjectByName(placement.requiredChild);
          if (!requiredChild) {
            throw new Error(
              `Pilot root ${placement.asset} is missing ${placement.requiredChild}`,
            );
          }
          validatePilotGeometry(
            requiredChild,
            `${placement.asset}/${placement.requiredChild}`,
          );
        }
        validatePilotGeometry(template, placement.asset);

        const prop = prepareAsset(template.clone(true), townMaterials, {
          cameraCollision: false,
        });
        prop.name = `authored_pilot_${id}`;
        prop.position.set(
          placement.position.x,
          placement.position.y,
          placement.position.z,
        );
        prop.rotation.set(0, 0, 0);
        prop.scale.setScalar(1);
        prop.userData.assetVariant = ASSET_VARIANTS.PILOT;
        prop.userData.assetVersion = TOWN_ASSET_PATHS.arrivalPlazaPilot.version;
        prop.updateMatrixWorld(true);
        landmarks.set(id, prop);
      } catch (error) {
        console.warn(
          `[TownAssetLoader] Pilot ${id} unavailable; using its procedural fallback.`,
          error,
        );
      }
    }
  } catch (error) {
    console.warn(
      '[TownAssetLoader] Arrival/plaza pilot unavailable; using procedural landmarks.',
      error,
    );
  }
  return landmarks;
}
