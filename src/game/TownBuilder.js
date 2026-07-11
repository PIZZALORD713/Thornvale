import { Group, Vector3 } from 'three';
import {
  createAmbientLife,
  createBellLandmark,
  createCottage,
  createGroundDressing,
  createLedgerLandmark,
  createNature,
  createPathsAndPlaza,
  createPlazaFurniture,
  createPond,
  createWelcomeGate,
  getTownMaterials,
} from '../visuals/CozyTownKit.js';
import { WorldAnimator } from '../visuals/WorldAnimator.js';

/**
 * Builds Thornvale's cozy town slice.
 *
 * Existing callers can continue to consume interactables and spawnPoint. The
 * extended worldAnimator/updateWorld API owns all ambient environmental motion.
 */
export async function buildTown(physicsWorld, scene) {
  const interactables = [];
  const spawnPoint = new Vector3(0, 2, 14);
  const worldAnimator = new WorldAnimator();
  const townRoot = new Group();
  townRoot.name = 'thornvale_kawaii_town';
  scene.add(townRoot);

  const mat = getTownMaterials();
  const buildingData = [
    {
      id: 'berry-bakery',
      position: new Vector3(8, 1.6, -6),
      size: new Vector3(6, 3.2, 4.5),
      frontSign: 1,
      wallMaterial: mat.cream,
      roofMaterial: mat.blush,
      doorMaterial: mat.mint,
    },
    {
      id: 'lavender-library',
      position: new Vector3(-8, 2, -4),
      size: new Vector3(5, 4, 6),
      frontSign: 1,
      wallMaterial: mat.vanilla,
      roofMaterial: mat.lavender,
      doorMaterial: mat.teal,
    },
    {
      id: 'mint-tea-house',
      position: new Vector3(7, 1.4, 7),
      size: new Vector3(4, 2.8, 4),
      frontSign: -1,
      wallMaterial: mat.mint,
      roofMaterial: mat.coral,
      doorMaterial: mat.lavender,
    },
    {
      id: 'rose-post-office',
      position: new Vector3(-6, 1.8, 8),
      size: new Vector3(6, 3.6, 5),
      frontSign: -1,
      wallMaterial: mat.blush,
      roofMaterial: mat.periwinkle,
      doorMaterial: mat.cocoa,
    },
  ];

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
  }

  townRoot.add(createGroundDressing(worldAnimator));
  townRoot.add(createPathsAndPlaza());
  buildingData.forEach((building, index) => {
    townRoot.add(createCottage(building, index, worldAnimator));
  });
  townRoot.add(createWelcomeGate(worldAnimator));
  townRoot.add(createNature(worldAnimator));
  townRoot.add(createPond(worldAnimator));
  townRoot.add(createPlazaFurniture(worldAnimator));

  const ledger = createLedgerLandmark(worldAnimator);
  const bell = createBellLandmark(worldAnimator);
  townRoot.add(ledger, bell);

  const ledgerPosition = new Vector3(-2, 0.8, 3);
  interactables.push({
    id: 'ledger',
    position: ledgerPosition,
    radius: 2,
    prompt: 'Read a sweet note in the Community Ledger',
  });

  const bellPosition = new Vector3(3, 0.5, -2);
  interactables.push({
    id: 'bell',
    position: bellPosition,
    radius: 2,
    prompt: 'Ring the ribbon bell',
  });

  townRoot.add(createAmbientLife(worldAnimator));
  worldAnimator.update(0, false);

  return {
    interactables,
    spawnPoint,
    townRoot,
    worldAnimator,
    updateWorld: (dt, nightState) => worldAnimator.update(dt, nightState),
  };
}
