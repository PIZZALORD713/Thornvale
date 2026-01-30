import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export async function buildTown(physicsWorld, scene) {
  const interactables = [];
  const spawnPoint = new THREE.Vector3(0, 2, 14);

  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8b8b8,
    roughness: 0.95,
  });

  const buildingData = [
    { position: new THREE.Vector3(8, 1.6, -6), size: new THREE.Vector3(6, 3.2, 4.5) },
    { position: new THREE.Vector3(-8, 2, -4), size: new THREE.Vector3(5, 4, 6) },
    { position: new THREE.Vector3(7, 1.4, 7), size: new THREE.Vector3(4, 2.8, 4) },
    { position: new THREE.Vector3(-6, 1.8, 8), size: new THREE.Vector3(6, 3.6, 5) },
  ];

  for (const building of buildingData) {
    physicsWorld.createStaticBox(
      { x: building.position.x, y: building.position.y, z: building.position.z },
      { x: building.size.x, y: building.size.y, z: building.size.z },
      scene,
      { color: 0xb1b1b1 }
    );
  }

  const ledgerPosition = new THREE.Vector3(-2, 0.8, 3);
  const ledger = createLedgerMesh(buildingMaterial);
  ledger.position.copy(ledgerPosition);
  scene.add(ledger);

  const bellPosition = new THREE.Vector3(3, 0.5, -2);
  const bell = createBellMesh(buildingMaterial);
  bell.position.copy(bellPosition);
  scene.add(bell);

  interactables.push({
    id: 'ledger',
    position: ledgerPosition,
    radius: 2,
    prompt: 'Check the Community Ledger',
  });

  interactables.push({
    id: 'bell',
    position: bellPosition,
    radius: 2,
    prompt: 'Ring the Town Bell',
  });

  await loadOptionalTownGLB(physicsWorld, scene);

  return { interactables, spawnPoint };
}

function createLedgerMesh(material) {
  const group = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 12), material);
  post.position.y = 0.6;
  post.castShadow = true;
  post.receiveShadow = true;
  group.add(post);

  const box = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.4, 0.5), material);
  box.position.y = 1.0;
  box.castShadow = true;
  box.receiveShadow = true;
  group.add(box);

  return group;
}

function createBellMesh(material) {
  const group = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), material);
  frame.position.y = 0.9;
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), material);
  bell.position.y = 1.2;
  bell.castShadow = true;
  bell.receiveShadow = true;
  group.add(bell);

  return group;
}

async function loadOptionalTownGLB(physicsWorld, scene) {
  try {
    const response = await fetch('/assets/town.glb', { method: 'HEAD' });
    if (!response.ok) {
      return;
    }
  } catch (error) {
    return;
  }

  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      '/assets/town.glb',
      (gltf) => {
        scene.add(gltf.scene);
        gltf.scene.traverse((child) => {
          if (!child.isMesh) return;

          child.castShadow = true;
          child.receiveShadow = true;

          if (child.name.startsWith('COLLIDER_')) {
            child.visible = false;
            const bounds = new THREE.Box3().setFromObject(child);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            bounds.getSize(size);
            bounds.getCenter(center);
            if (size.lengthSq() > 0.0001) {
              physicsWorld.createStaticBox(
                { x: center.x, y: center.y, z: center.z },
                { x: size.x, y: size.y, z: size.z },
                null
              );
            }
          }
        });
        resolve();
      },
      undefined,
      () => resolve()
    );
  });
}
