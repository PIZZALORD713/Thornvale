import {
  BoxGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import {
  normalizeAssetVariant,
  normalizeTraitEchoVariant,
  resolveAssetVariant,
  resolveTraitEchoVariant,
} from '../config/assets.js';
import {
  getCottageBlockingColliderEnvelopes,
  getTownStaticColliderEnvelopes,
  TOWN_INTERACTION_CONTRACT,
  TOWN_LAYOUT,
} from '../config/town.js';
import {
  createAmbientLife,
  createBellLandmark,
  createBellPrecinct,
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
  loadAuthoredPilotLandmarks,
  loadAuthoredVillageProps,
} from '../visuals/TownAssetLoader.js';
import { loadTraitEchoV1 } from '../visuals/FriendsiesTraitEchoes.js';
import { createDayOneWorld } from '../visuals/DayOneWorld.js';
import { WorldAnimator } from '../visuals/WorldAnimator.js';
import { createMoundSurfaceGrid } from '../utils/terrain-surface.js';

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
  for (const collider of getCottageBlockingColliderEnvelopes(building)) {
    physicsWorld.createStaticBox(collider.position, collider.size, null);
  }
}

export function addWalkableTerrainPhysics(physicsWorld, hill = TOWN_LAYOUT.terrain?.bellHill) {
  if (!hill?.walkable) return null;
  const surface = createMoundSurfaceGrid(hill);
  return physicsWorld.createStaticTrimesh(
    { x: 0, y: 0, z: 0 },
    surface.vertices,
    surface.indices,
    { friction: 0.95 },
  );
}

export function bindAuthoredBellMotion(worldAnimator, bell) {
  const bellPivot = bell.getObjectByName('TownBellSwing');
  if (!bellPivot) return;

  const baseRotation = bellPivot.rotation.z;
  let ringImpulse = 0;
  worldAnimator.ringBell = () => {
    ringImpulse = 1;
  };
  worldAnimator.add((time, dt) => {
    ringImpulse = MathUtils.damp(ringImpulse, 0, 2.7, dt);
    const idleSwing = Math.sin(time * 0.86 + 0.6) * 0.035;
    const ringing = Math.sin(time * 18.5) * 0.42 * ringImpulse;
    bellPivot.rotation.z = baseRotation + idleSwing + ringing;
  });
}

/**
 * Builds Thornvale's cozy town slice.
 *
 * Existing callers can continue to consume interactables and spawnPoint. The
 * extended worldAnimator/updateWorld API owns all ambient environmental motion.
 */
export async function buildTown(physicsWorld, scene, {
  assetVariant = resolveAssetVariant(),
  traitEchoVariant = resolveTraitEchoVariant(),
  reducedMotion = false,
  quality = 'high',
} = {}) {
  const selectedAssetVariant = normalizeAssetVariant(assetVariant);
  const selectedTraitEchoVariant = normalizeTraitEchoVariant(traitEchoVariant);
  const interactables = [];
  const spawnPoint = new Vector3(
    TOWN_LAYOUT.spawn.x,
    TOWN_LAYOUT.spawn.y,
    TOWN_LAYOUT.spawn.z,
  );
  const worldAnimator = new WorldAnimator();
  const townRoot = new Group();
  const staticColliderEnvelopes = new Map(
    getTownStaticColliderEnvelopes(TOWN_LAYOUT).map((entry) => [entry.id, entry]),
  );
  const createStaticCollider = (id) => {
    const envelope = staticColliderEnvelopes.get(id);
    return envelope
      ? physicsWorld.createStaticBox(envelope.position, envelope.size, null)
      : null;
  };
  townRoot.name = 'thornvale_kawaii_town';
  townRoot.userData.assetVariant = selectedAssetVariant;
  townRoot.userData.traitEchoVariant = selectedTraitEchoVariant;
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
  const [
    authoredCottages,
    authoredVillageProps,
    authoredPilotLandmarks,
    traitEchoes,
  ] = await Promise.all([
    loadAuthoredCottages(buildingData, mat),
    loadAuthoredVillageProps(TOWN_LAYOUT, mat, {
      assetVariant: selectedAssetVariant,
    }),
    loadAuthoredPilotLandmarks(TOWN_LAYOUT, mat, {
      assetVariant: selectedAssetVariant,
    }),
    loadTraitEchoV1({
      variant: selectedTraitEchoVariant,
      worldAnimator,
      reducedMotion,
    }).catch((error) => {
      console.warn('[TownBuilder] Trait Echo v1 unavailable; continuing without it.', error);
      return null;
    }),
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

  const terrainDressing = createGroundDressing(worldAnimator, TOWN_LAYOUT, {
    quality,
    reducedMotion,
    assetVariant: selectedAssetVariant,
  });
  const breathingGrass = terrainDressing.breathingGrass;
  townRoot.add(terrainDressing);
  addWalkableTerrainPhysics(physicsWorld);
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
    createStaticCollider('stone-well');
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
    createStaticCollider('wayfinder');
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
      const colliderId = `garden-arch-${xSign < 0 ? 'left' : 'right'}`;
      const postPosition = staticColliderEnvelopes.get(colliderId)?.position;
      createStaticCollider(colliderId);
      townRoot.add(createCameraProxy(
        `garden_arch_post_${xSign < 0 ? 'left' : 'right'}`,
        { x: postPosition.x, y: 1.25, z: postPosition.z },
        { x: 0.52, y: 2.5, z: 0.52 },
        gardenArchVisual,
      ));
    }
  }
  const welcomeGate = authoredPilotLandmarks.get('welcomeGate')
    || createWelcomeGate(worldAnimator, TOWN_LAYOUT);
  townRoot.add(welcomeGate);
  for (const xSign of [-1, 1]) {
    const colliderId = `welcome-gate-${xSign < 0 ? 'left' : 'right'}`;
    const gatePostPosition = staticColliderEnvelopes.get(colliderId)?.position;
    createStaticCollider(colliderId);
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
  const hasFriendsiesRouteFlowers = traitEchoes?.families?.has?.('welcome-flower') === true;
  townRoot.add(createNature(worldAnimator, TOWN_LAYOUT, {
    // The fRiENDSiES flower must replace the central placeholder meadow, not
    // compete with it. If that family fails to load, retain the full procedural
    // meadow as a resilient visual fallback.
    includeRouteWildflowers: !hasFriendsiesRouteFlowers,
  }));
  townRoot.add(createBellPrecinct(worldAnimator, TOWN_LAYOUT));
  townRoot.add(createPond(worldAnimator, TOWN_LAYOUT));
  townRoot.add(createPlazaFurniture(worldAnimator, TOWN_LAYOUT));

  const dayOneWorld = createDayOneWorld({
    layout: TOWN_LAYOUT,
    reducedMotion,
  });
  townRoot.add(dayOneWorld.root);
  interactables.push(...dayOneWorld.interactables);

  const ledger = authoredPilotLandmarks.get('ledger')
    || createLedgerLandmark(worldAnimator, TOWN_LAYOUT);
  const authoredBell = authoredPilotLandmarks.get('bell');
  const bell = authoredBell || createBellLandmark(worldAnimator, TOWN_LAYOUT);
  if (authoredBell) bindAuthoredBellMotion(worldAnimator, authoredBell);
  townRoot.add(ledger, bell);
  if (traitEchoes?.root) {
    townRoot.add(traitEchoes.root);
    traitEchoes.anchorToLandmarks({ ledger, bell, welcomeGate });
  }
  createStaticCollider('community-ledger');
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
  createStaticCollider('town-bell');
  townRoot.add(createCameraProxy(
    'town_bell',
    {
      x: TOWN_LAYOUT.landmarks.bell.x,
      y: TOWN_LAYOUT.landmarks.bell.baseY + 1.2,
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
    id: TOWN_INTERACTION_CONTRACT.ledger.id,
    position: ledgerPosition,
    radius: TOWN_INTERACTION_CONTRACT.ledger.radius,
    prompt: 'Read a sweet note in the Community Ledger',
  });

  const bellPosition = new Vector3(
    TOWN_LAYOUT.landmarks.bell.x,
    TOWN_LAYOUT.landmarks.bell.y,
    TOWN_LAYOUT.landmarks.bell.z,
  );
  interactables.push({
    id: TOWN_INTERACTION_CONTRACT.bell.id,
    position: bellPosition,
    radius: TOWN_INTERACTION_CONTRACT.bell.radius,
    prompt: 'Ring the ribbon bell',
  });

  const ambientLife = createAmbientLife(worldAnimator, TOWN_LAYOUT, {
    quality,
    reducedMotion,
    assetVariant: selectedAssetVariant,
  });
  townRoot.add(ambientLife.root);
  worldAnimator.update(0, false);

  return {
    interactables,
    landmarks: { ledger, bell },
    spawnPoint,
    townRoot,
    assetVariant: selectedAssetVariant,
    traitEchoVariant: selectedTraitEchoVariant,
    traitEchoes,
    breathingGrass,
    ambientLife,
    dayOneWorld,
    worldAnimator,
    updateWorld: (dt, nightState) => {
      worldAnimator.update(dt, nightState);
      dayOneWorld.update(dt);
    },
  };
}
