import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import { TOWN_LAYOUT } from '../config/town.js';
import {
  createAmbientLife,
  createBellLandmark,
  createCottage,
  createCottageAmbientDetails,
  createCottagePlot,
  createGroundDressing,
  createLedgerLandmark,
  createNature,
  createPathsAndPlaza,
  createPlazaFurniture,
  createPond,
  createWelcomeGate,
  getTownMaterials,
} from '../visuals/CozyTownKit.js';
import {
  loadAuthoredCottages,
  loadAuthoredVillageProps,
} from '../visuals/TownAssetLoader.js';
import { WorldAnimator } from '../visuals/WorldAnimator.js';

const cameraProxyMaterial = new MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false,
  toneMapped: false,
});
cameraProxyMaterial.name = 'camera_proxy_invisible';

function createCameraProxy(name, position, size, occlusionTarget = null) {
  const proxy = new Mesh(
    new BoxGeometry(size.x, size.y, size.z),
    cameraProxyMaterial,
  );
  proxy.name = `camera_proxy_${name}`;
  proxy.position.set(position.x, position.y, position.z);
  proxy.castShadow = false;
  proxy.receiveShadow = false;
  proxy.userData.cameraCollision = true;
  proxy.cameraOcclusionTarget = occlusionTarget;
  return proxy;
}

export function addCottagePhysics(physicsWorld, building) {
  const porch = building.porchCollider;
  if (porch) {
    physicsWorld.createStaticBox(
      {
        x: building.position.x,
        y: porch.size.y,
        z: building.position.z + porch.offsetZ,
      },
      porch.size,
      null,
    );
  }
  for (const detail of building.detailColliders || []) {
    physicsWorld.createStaticBox(
      {
        x: building.position.x + detail.offsetX,
        y: detail.y,
        z: building.position.z + detail.offsetZ,
      },
      detail.size,
      null,
    );
  }

  const sideX = building.size.x * 0.5 + 1.05;
  const frontEdge = building.frontSign * (building.size.z * 0.5 + 1.35) * 0.45;
  const backZ = -building.frontSign * (building.size.z * 0.5 + 1);
  const sideLength = Math.abs(frontEdge - backZ);
  const sideCenterZ = (frontEdge + backZ) * 0.5;
  physicsWorld.createStaticBox(
    {
      x: building.position.x,
      y: 0.45,
      z: building.position.z + backZ,
    },
    { x: sideX * 2 + 0.12, y: 0.9, z: 0.16 },
    null,
  );
  for (const xSign of [-1, 1]) {
    physicsWorld.createStaticBox(
      {
        x: building.position.x + xSign * sideX,
        y: 0.45,
        z: building.position.z + sideCenterZ,
      },
      { x: 0.16, y: 0.9, z: sideLength + 0.12 },
      null,
    );
  }
}

function rotatedLocalX(placement, localX) {
  return {
    x: placement.x + Math.cos(placement.rotationY || 0) * localX,
    z: placement.z - Math.sin(placement.rotationY || 0) * localX,
  };
}

/**
 * Builds Thornvale's cozy town slice.
 *
 * Existing callers can continue to consume interactables and spawnPoint. The
 * extended worldAnimator/updateWorld API owns all ambient environmental motion.
 */
export async function buildTown(physicsWorld, scene) {
  const interactables = [];
  const spawnPoint = new Vector3(
    TOWN_LAYOUT.spawn.x,
    TOWN_LAYOUT.spawn.y,
    TOWN_LAYOUT.spawn.z,
  );
  const worldAnimator = new WorldAnimator();
  const townRoot = new Group();
  townRoot.name = 'thornvale_kawaii_town';
  scene.add(townRoot);

  const mat = getTownMaterials();
  const buildingData = TOWN_LAYOUT.buildings.map((building) => ({
    ...building,
    position: new Vector3(building.position.x, building.position.y, building.position.z),
    size: new Vector3(building.size.x, building.size.y, building.size.z),
    wallMaterial: mat[building.wallMaterial],
    roofMaterial: mat[building.roofMaterial],
    doorMaterial: mat[building.doorMaterial],
  }));
  const [authoredCottages, authoredVillageProps] = await Promise.all([
    loadAuthoredCottages(buildingData, mat),
    loadAuthoredVillageProps(TOWN_LAYOUT, mat),
  ]);

  // Preserve the proven simple building colliders while upgrading their art.
  for (const building of buildingData) {
    physicsWorld.createStaticBox(
      {
        x: building.position.x,
        y: building.position.y,
        z: building.position.z,
      },
      {
        x: building.size.x,
        y: building.size.y,
        z: building.size.z,
      },
      null,
    );
    addCottagePhysics(physicsWorld, building);
  }

  townRoot.add(createGroundDressing(worldAnimator, TOWN_LAYOUT));
  townRoot.add(createPathsAndPlaza(TOWN_LAYOUT));
  buildingData.forEach((building, index) => {
    townRoot.add(createCottagePlot(building, index, worldAnimator));
    const authoredCottage = authoredCottages.get(building.id);
    const cottage = authoredCottage || createCottage(building, index, worldAnimator);
    cottage.userData.cameraCollision = false;
    townRoot.add(cottage);
    const cameraProxyHeight = building.size.y + 2.3;
    townRoot.add(createCameraProxy(
      `cottage_${building.id}`,
      {
        x: building.position.x,
        y: cameraProxyHeight * 0.5,
        z: building.position.z,
      },
      {
        x: building.size.x + 0.3,
        y: cameraProxyHeight,
        z: building.size.z + 0.3,
      },
      cottage,
    ));
    if (authoredCottage && building.id === 'berry-bakery') {
      townRoot.add(createCottageAmbientDetails(building, index, worldAnimator));
    }
  });
  townRoot.add(authoredVillageProps);

  const stoneWell = TOWN_LAYOUT.authoredProps.stoneWell;
  const stoneWellVisual = authoredVillageProps.getObjectByName('authored_stoneWell');
  if (stoneWellVisual) {
    physicsWorld.createStaticBox(
      { x: stoneWell.x, y: 0.58, z: stoneWell.z },
      { x: 2.15, y: 1.16, z: 2.15 },
      null,
    );
    townRoot.add(createCameraProxy(
      'stone_well',
      { x: stoneWell.x, y: 1.3, z: stoneWell.z },
      { x: 2.7, y: 2.6, z: 2.45 },
      stoneWellVisual,
    ));
  }
  const wayfinder = TOWN_LAYOUT.authoredProps.wayfinder;
  const wayfinderVisual = authoredVillageProps.getObjectByName('authored_wayfinder');
  if (wayfinderVisual) {
    physicsWorld.createStaticBox(
      { x: wayfinder.x, y: 1.05, z: wayfinder.z },
      { x: 0.42, y: 2.1, z: 0.42 },
      null,
    );
    townRoot.add(createCameraProxy(
      'wayfinder',
      { x: wayfinder.x, y: 1.15, z: wayfinder.z },
      { x: 0.48, y: 2.3, z: 0.48 },
      wayfinderVisual,
    ));
  }
  const gardenArch = TOWN_LAYOUT.authoredProps.gardenArch;
  const gardenArchVisual = authoredVillageProps.getObjectByName('authored_gardenArch');
  if (gardenArchVisual) {
    for (const xSign of [-1, 1]) {
      const postPosition = rotatedLocalX(gardenArch, xSign * 1.325);
      physicsWorld.createStaticBox(
        { x: postPosition.x, y: 1.08, z: postPosition.z },
        { x: 0.48, y: 2.16, z: 0.48 },
        null,
      );
      townRoot.add(createCameraProxy(
        `garden_arch_post_${xSign < 0 ? 'left' : 'right'}`,
        { x: postPosition.x, y: 1.25, z: postPosition.z },
        { x: 0.52, y: 2.5, z: 0.52 },
        gardenArchVisual,
      ));
    }
  }
  const welcomeGate = createWelcomeGate(worldAnimator, TOWN_LAYOUT);
  townRoot.add(welcomeGate);
  for (const xSign of [-1, 1]) {
    const gatePostPosition = {
      x: TOWN_LAYOUT.gate.x + xSign * 2.05,
      y: 1.45,
      z: TOWN_LAYOUT.gate.z,
    };
    physicsWorld.createStaticBox(
      gatePostPosition,
      { x: 0.62, y: 2.9, z: 0.62 },
      null,
    );
    townRoot.add(createCameraProxy(
      `welcome_gate_post_${xSign < 0 ? 'left' : 'right'}`,
      gatePostPosition,
      { x: 0.68, y: 3.05, z: 0.68 },
      welcomeGate,
    ));
  }
  townRoot.add(createCameraProxy(
    'welcome_gate_sign',
    { x: TOWN_LAYOUT.gate.x, y: 3.15, z: TOWN_LAYOUT.gate.z },
    { x: 2.5, y: 0.78, z: 0.32 },
    welcomeGate,
  ));
  townRoot.add(createNature(worldAnimator, TOWN_LAYOUT));
  townRoot.add(createPond(worldAnimator, TOWN_LAYOUT));
  townRoot.add(createPlazaFurniture(worldAnimator, TOWN_LAYOUT));

  const ledger = createLedgerLandmark(worldAnimator, TOWN_LAYOUT);
  const bell = createBellLandmark(worldAnimator, TOWN_LAYOUT);
  townRoot.add(ledger, bell);
  physicsWorld.createStaticBox(
    {
      x: TOWN_LAYOUT.landmarks.ledger.x,
      y: 1.1,
      z: TOWN_LAYOUT.landmarks.ledger.z,
    },
    { x: 2.05, y: 2.2, z: 0.38 },
    null,
  );
  townRoot.add(createCameraProxy(
    'community_ledger',
    {
      x: TOWN_LAYOUT.landmarks.ledger.x,
      y: 1.15,
      z: TOWN_LAYOUT.landmarks.ledger.z,
    },
    { x: 2.15, y: 2.3, z: 0.44 },
    ledger,
  ));
  physicsWorld.createStaticBox(
    {
      x: TOWN_LAYOUT.landmarks.bell.x,
      y: 0.22,
      z: TOWN_LAYOUT.landmarks.bell.z,
    },
    { x: 1.65, y: 0.44, z: 1.35 },
    null,
  );
  townRoot.add(createCameraProxy(
    'town_bell',
    {
      x: TOWN_LAYOUT.landmarks.bell.x,
      y: 1.2,
      z: TOWN_LAYOUT.landmarks.bell.z,
    },
    { x: 1.55, y: 2.4, z: 0.82 },
    bell,
  ));

  const ledgerPosition = new Vector3(
    TOWN_LAYOUT.landmarks.ledger.x,
    TOWN_LAYOUT.landmarks.ledger.y,
    TOWN_LAYOUT.landmarks.ledger.z,
  );
  interactables.push({
    id: 'ledger',
    position: ledgerPosition,
    radius: 2,
    prompt: 'Read a sweet note in the Community Ledger',
  });

  const bellPosition = new Vector3(
    TOWN_LAYOUT.landmarks.bell.x,
    TOWN_LAYOUT.landmarks.bell.y,
    TOWN_LAYOUT.landmarks.bell.z,
  );
  interactables.push({
    id: 'bell',
    position: bellPosition,
    radius: 2,
    prompt: 'Ring the ribbon bell',
  });

  townRoot.add(createAmbientLife(worldAnimator, TOWN_LAYOUT));
  worldAnimator.update(0, false);

  return {
    interactables,
    landmarks: { ledger, bell },
    spawnPoint,
    townRoot,
    worldAnimator,
    updateWorld: (dt, nightState) => worldAnimator.update(dt, nightState),
  };
}
