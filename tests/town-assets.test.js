import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BoxGeometry, Group, Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import {
  ASSET_VARIANTS,
  DEFAULT_ASSET_VARIANT,
  resolveAssetVariant,
  TOWN_ASSET_PATHS,
} from '../src/config/assets.js';
import { TOWN_INTERACTION_CONTRACT, TOWN_LAYOUT } from '../src/config/town.js';
import { bindAuthoredBellMotion } from '../src/game/TownBuilder.js';
import {
  loadAuthoredPilotLandmarks,
  loadAuthoredVillageProps,
} from '../src/visuals/TownAssetLoader.js';
import { WorldAnimator } from '../src/visuals/WorldAnimator.js';

async function readGlbDocument(path) {
  const buffer = await readFile(new URL(path, import.meta.url));
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, `${path} is not a glTF binary`);
  assert.equal(buffer.readUInt32LE(4), 2, `${path} must use glTF 2.0`);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, `${path} has no JSON chunk`);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

async function loadGlbScene(path) {
  const buffer = await readFile(new URL(path, import.meta.url));
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
  globalThis.ProgressEvent ??= class ProgressEvent {};
  const gltf = await new GLTFLoader().parseAsync(arrayBuffer, '');
  return gltf.scene;
}

function getAxisAlignedCapSigns(mesh, axis = 'z', epsilon = 1e-5) {
  const positions = mesh.geometry.getAttribute('position');
  const indices = mesh.geometry.getIndex();
  assert.ok(positions && indices, `${mesh.name} requires indexed position geometry`);

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const edgeA = new Vector3();
  const edgeB = new Vector3();
  const normal = new Vector3();
  const groups = new Map();

  for (let offset = 0; offset < indices.count; offset += 3) {
    a.fromBufferAttribute(positions, indices.getX(offset));
    b.fromBufferAttribute(positions, indices.getX(offset + 1));
    c.fromBufferAttribute(positions, indices.getX(offset + 2));
    const values = [a[axis], b[axis], c[axis]];
    if (Math.max(...values) - Math.min(...values) > epsilon) continue;

    normal.copy(edgeA.subVectors(b, a)).cross(edgeB.subVectors(c, a));
    const sign = Math.sign(normal[axis]);
    if (sign === 0) continue;
    const plane = (values[0] + values[1] + values[2]) / 3;
    const key = plane.toFixed(3);
    const signs = groups.get(key) || [];
    signs.push(sign);
    groups.set(key, signs);
  }
  return groups;
}

function getSignedMeshVolume(mesh) {
  const positions = mesh.geometry.getAttribute('position');
  const indices = mesh.geometry.getIndex();
  assert.ok(positions && indices, `${mesh.name} requires indexed position geometry`);

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const cross = new Vector3();
  let volume = 0;
  for (let offset = 0; offset < indices.count; offset += 3) {
    a.fromBufferAttribute(positions, indices.getX(offset));
    b.fromBufferAttribute(positions, indices.getX(offset + 1));
    c.fromBufferAttribute(positions, indices.getX(offset + 2));
    volume += a.dot(cross.crossVectors(b, c)) / 6;
  }
  return volume;
}

function getPlaneVerticalBounds(mesh, plane, epsilon = 1e-5) {
  const positions = mesh.geometry.getAttribute('position');
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < positions.count; index += 1) {
    if (Math.abs(positions.getZ(index) - plane) > epsilon) continue;
    const y = positions.getY(index);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  assert.ok(Number.isFinite(minY) && Number.isFinite(maxY), `missing roof plane z=${plane}`);
  return { minY, maxY };
}

function getAccessorCount(document, accessorIndex, label) {
  assert.ok(Number.isInteger(accessorIndex), `${label} has no accessor`);
  const accessor = document.accessors?.[accessorIndex];
  assert.ok(accessor, `${label} references missing accessor ${accessorIndex}`);
  assert.ok(Number.isInteger(accessor.count), `${label} accessor has no integer count`);
  return accessor.count;
}

function countGlbGeometry(document) {
  let primitives = 0;
  let triangles = 0;
  for (const [meshIndex, mesh] of (document.meshes || []).entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives || []).entries()) {
      primitives += 1;
      const label = `mesh ${meshIndex} primitive ${primitiveIndex}`;
      const elementAccessor = primitive.indices ?? primitive.attributes?.POSITION;
      const elementCount = getAccessorCount(document, elementAccessor, label);
      const mode = primitive.mode ?? 4;
      if (mode === 4) {
        assert.equal(elementCount % 3, 0, `${label} has incomplete triangles`);
        triangles += elementCount / 3;
      } else if (mode === 5 || mode === 6) {
        triangles += Math.max(0, elementCount - 2);
      }
    }
  }
  return { primitives, triangles };
}

function descendantNodeIndices(document, rootIndex) {
  const descendants = [];
  const pending = [...(document.nodes?.[rootIndex]?.children || [])];
  const seen = new Set();
  while (pending.length > 0) {
    const nodeIndex = pending.pop();
    if (seen.has(nodeIndex)) continue;
    seen.add(nodeIndex);
    descendants.push(nodeIndex);
    pending.push(...(document.nodes?.[nodeIndex]?.children || []));
  }
  return descendants;
}

function assertRootHasGeometry(document, rootName) {
  const matches = (document.nodes || [])
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => node.name === rootName);
  assert.equal(matches.length, 1, `expected one pilot node named ${rootName}`);

  let primitiveCount = 0;
  for (const nodeIndex of descendantNodeIndices(document, matches[0].index)) {
    const meshIndex = document.nodes[nodeIndex]?.mesh;
    if (!Number.isInteger(meshIndex)) continue;
    for (const [index, primitive] of (document.meshes?.[meshIndex]?.primitives || []).entries()) {
      primitiveCount += 1;
      const positionCount = getAccessorCount(
        document,
        primitive.attributes?.POSITION,
        `${rootName} descendant primitive ${index} POSITION`,
      );
      assert.ok(positionCount >= 3, `${rootName} has an empty descendant primitive`);
    }
  }
  assert.ok(primitiveCount > 0, `${rootName} has no descendant mesh geometry`);
}

test('the Blender cottage kit preserves every runtime placement root', async () => {
  const document = await readGlbDocument('../public/town/cottages/thornvale-cottages.glb');
  const names = new Set((document.nodes || []).map((node) => node.name));
  for (const name of [
    'Cottage_berry_bakery',
    'Cottage_lavender_library',
    'Cottage_mint_tea_house',
    'Cottage_rose_post_office',
  ]) {
    assert.ok(names.has(name), `missing authored cottage root ${name}`);
  }
  assert.equal(document.images?.length || 0, 0, 'cottage kit should remain texture-free');
});

test('the tea-house curled roof exports closed caps with outward winding', async () => {
  const scene = await loadGlbScene('../public/town/cottages/thornvale-cottages.glb');
  const roof = scene.getObjectByName('Cottage_mint_tea_house__Roof_Coral');
  assert.ok(roof?.isMesh, 'missing the authored mint tea-house roof mesh');

  const caps = getAxisAlignedCapSigns(roof);
  for (const [plane, expectedSign] of [
    ['-2.550', -1],
    ['2.550', 1],
    ['1.850', -1],
    ['3.610', 1],
  ]) {
    const signs = caps.get(plane);
    assert.ok(signs?.length >= 3, `missing triangulated roof cap at z=${plane}`);
    assert.deepEqual(
      [...new Set(signs)],
      [expectedSign],
      `every triangle on the roof cap at z=${plane} must face out of the solid`,
    );
  }

  const mainUnderside = Math.min(
    getPlaneVerticalBounds(roof, -2.55).minY,
    getPlaneVerticalBounds(roof, 2.55).minY,
  );
  const canopyTop = Math.max(
    getPlaneVerticalBounds(roof, 1.85).maxY,
    getPlaneVerticalBounds(roof, 3.61).maxY,
  );
  assert.ok(
    mainUnderside - canopyTop >= 0.02,
    `main roof and veranda canopy need a visible gap; received ${(mainUnderside - canopyTop).toFixed(3)}m`,
  );
});

test('every authored cottage roof exports as an outward-wound solid', async () => {
  const scene = await loadGlbScene('../public/town/cottages/thornvale-cottages.glb');
  const roofNames = [
    'Cottage_berry_bakery__Roof_Blush',
    'Cottage_lavender_library__Roof_Lavender',
    'Cottage_mint_tea_house__Roof_Coral',
    'Cottage_rose_post_office__Roof_Periwinkle',
  ];
  for (const name of roofNames) {
    const roof = scene.getObjectByName(name);
    assert.ok(roof?.isMesh, `missing authored roof mesh ${name}`);
    assert.ok(
      getSignedMeshVolume(roof) > 0.01,
      `${name} must have positive signed volume from outward triangle winding`,
    );
  }
});

test('the Blender village kit preserves each reusable landmark root', async () => {
  const document = await readGlbDocument('../public/village/thornvale-village-dressing.glb');
  const names = new Set((document.nodes || []).map((node) => node.name));
  for (const name of ['VillageWayfinder', 'GardenArch', 'StoneWell']) {
    assert.ok(names.has(name), `missing authored village prop root ${name}`);
  }
  assert.equal(document.images?.length || 0, 0, 'village kit should remain texture-free');
});

test('the versioned arrival/plaza pilot stays within its runtime contract', async () => {
  const document = await readGlbDocument(
    '../public/village/pilot/v1/thornvale-arrival-plaza.glb',
  );
  const names = new Set((document.nodes || []).map((node) => node.name));
  for (const name of ['WelcomeGate', 'CommunityLedger', 'TownBell', 'TownBellSwing']) {
    assert.ok(names.has(name), `missing pilot node ${name}`);
  }
  for (const rootName of ['WelcomeGate', 'CommunityLedger', 'TownBell', 'TownBellSwing']) {
    assertRootHasGeometry(document, rootName);
  }
  assert.equal(document.images?.length || 0, 0, 'pilot kit should remain texture-free');
  const geometry = countGlbGeometry(document);
  assert.ok(geometry.primitives <= 50, 'pilot kit exceeds its 50-primitive budget');
  assert.ok(geometry.triangles <= 22_000, 'pilot kit exceeds its 22k-triangle budget');

  const file = await readFile(new URL(
    '../public/village/pilot/v1/thornvale-arrival-plaza.glb',
    import.meta.url,
  ));
  assert.ok(file.byteLength <= 800 * 1024, 'pilot kit exceeds its 800 KiB budget');
});

test('the Pizza Lab Wayfinder pilot stays inside its standalone Draco contract', async () => {
  const document = await readGlbDocument(
    '../public/village/pilot/wayfinder/v1/thornvale-wayfinder.glb',
  );
  assert.deepEqual(document.extensionsUsed, ['KHR_draco_mesh_compression']);
  assert.deepEqual(document.extensionsRequired, ['KHR_draco_mesh_compression']);
  assertRootHasGeometry(document, 'VillageWayfinder');
  assert.equal(document.nodes?.length, 11);
  assert.equal(document.meshes?.length, 10);
  assert.equal(document.materials?.length, 10);
  assert.equal(document.images?.length || 0, 0);
  const geometry = countGlbGeometry(document);
  assert.deepEqual(geometry, { primitives: 10, triangles: 1488 });
  const file = await readFile(new URL(
    '../public/village/pilot/wayfinder/v1/thornvale-wayfinder.glb',
    import.meta.url,
  ));
  assert.ok(file.byteLength <= 31_000);
  assert.equal(TOWN_ASSET_PATHS.wayfinderPilot.root, 'VillageWayfinder');
});

test('the authored pilot is default while explicit and unknown values retain baseline rollback', () => {
  assert.equal(DEFAULT_ASSET_VARIANT, ASSET_VARIANTS.PILOT);
  assert.equal(resolveAssetVariant(''), DEFAULT_ASSET_VARIANT);
  assert.equal(resolveAssetVariant('?assets=baseline'), ASSET_VARIANTS.BASELINE);
  assert.equal(resolveAssetVariant('?assets=pilot'), ASSET_VARIANTS.PILOT);
  assert.equal(resolveAssetVariant('?assets=experimental'), ASSET_VARIANTS.BASELINE);
  assert.equal(
    TOWN_ASSET_PATHS.arrivalPlazaPilot.url,
    '/village/pilot/v1/thornvale-arrival-plaza.glb',
  );
});

test('pilot roots fall back independently without moving surviving authored roots', async () => {
  const source = new Group();
  const gate = new Group();
  gate.name = 'WelcomeGate';
  gate.add(new Mesh(new BoxGeometry(1, 1, 1)));
  const ledger = new Group();
  ledger.name = 'CommunityLedger'; // Present but empty: must use fallback.
  const bell = new Group();
  bell.name = 'TownBell';
  const swing = new Group();
  swing.name = 'TownBellSwing';
  swing.add(new Mesh(new BoxGeometry(1, 1, 1)));
  bell.add(swing);
  source.add(gate, ledger, bell);

  const originalWarn = console.warn;
  console.warn = () => {};
  let landmarks;
  try {
    landmarks = await loadAuthoredPilotLandmarks(TOWN_LAYOUT, null, {
      assetVariant: ASSET_VARIANTS.PILOT,
      sceneLoader: async () => source,
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual([...landmarks.keys()], ['welcomeGate', 'bell']);
  assert.deepEqual(landmarks.get('welcomeGate').position.toArray(), [
    TOWN_LAYOUT.gate.x,
    TOWN_LAYOUT.gate.y,
    TOWN_LAYOUT.gate.z,
  ]);
  assert.deepEqual(landmarks.get('bell').position.toArray(), [
    TOWN_LAYOUT.landmarks.bell.x,
    TOWN_LAYOUT.landmarks.bell.baseY,
    TOWN_LAYOUT.landmarks.bell.z,
  ]);
});

function villageSource() {
  const source = new Group();
  for (const name of ['VillageWayfinder', 'GardenArch', 'StoneWell']) {
    const root = new Group();
    root.name = name;
    root.add(new Mesh(new BoxGeometry(1, 1, 1)));
    source.add(root);
  }
  return source;
}

test('pilot mode replaces only the Wayfinder while preserving game-owned placement', async () => {
  const candidate = new Group();
  const candidateRoot = new Group();
  candidateRoot.name = 'VillageWayfinder';
  candidateRoot.add(new Mesh(new BoxGeometry(2, 2, 2)));
  candidate.add(candidateRoot);
  const requests = [];
  const result = await loadAuthoredVillageProps(TOWN_LAYOUT, null, {
    assetVariant: ASSET_VARIANTS.PILOT,
    sceneLoader: async (url, options) => {
      requests.push({ url, options });
      return url === TOWN_ASSET_PATHS.wayfinderPilot.url ? candidate : villageSource();
    },
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1], {
    url: TOWN_ASSET_PATHS.wayfinderPilot.url,
    options: { draco: true },
  });
  const wayfinder = result.getObjectByName('authored_wayfinder');
  assert.deepEqual(wayfinder.position.toArray(), [
    TOWN_LAYOUT.authoredProps.wayfinder.x,
    TOWN_LAYOUT.authoredProps.wayfinder.y,
    TOWN_LAYOUT.authoredProps.wayfinder.z,
  ]);
  assert.equal(wayfinder.userData.assetVersion, TOWN_ASSET_PATHS.wayfinderPilot.version);
  assert.ok(result.getObjectByName('authored_gardenArch'));
  assert.ok(result.getObjectByName('authored_stoneWell'));
});

test('baseline mode skips Wayfinder pilot and candidate failure falls back per root', async () => {
  let baselineRequests = 0;
  const baseline = await loadAuthoredVillageProps(TOWN_LAYOUT, null, {
    assetVariant: ASSET_VARIANTS.BASELINE,
    sceneLoader: async () => {
      baselineRequests += 1;
      return villageSource();
    },
  });
  assert.equal(baselineRequests, 1);
  assert.equal(baseline.getObjectByName('authored_wayfinder').userData.assetVersion, undefined);

  const originalWarn = console.warn;
  console.warn = () => {};
  let fallback;
  try {
    fallback = await loadAuthoredVillageProps(TOWN_LAYOUT, null, {
      assetVariant: ASSET_VARIANTS.PILOT,
      sceneLoader: async (url) => {
        if (url === TOWN_ASSET_PATHS.wayfinderPilot.url) throw new Error('candidate unavailable');
        return villageSource();
      },
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.ok(fallback.getObjectByName('authored_wayfinder'));
  assert.ok(fallback.getObjectByName('authored_gardenArch'));
  assert.ok(fallback.getObjectByName('authored_stoneWell'));
});

test('pilot roots with non-finite geometry bounds are rejected', async () => {
  const source = new Group();
  const gate = new Group();
  gate.name = 'WelcomeGate';
  gate.position.x = Number.POSITIVE_INFINITY;
  gate.add(new Mesh(new BoxGeometry(1, 1, 1)));
  source.add(gate);

  const originalWarn = console.warn;
  console.warn = () => {};
  let landmarks;
  try {
    landmarks = await loadAuthoredPilotLandmarks(TOWN_LAYOUT, null, {
      assetVariant: ASSET_VARIANTS.PILOT,
      sceneLoader: async () => source,
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(landmarks.size, 0);
});

test('baseline mode skips the pilot request entirely', async () => {
  let requested = false;
  const landmarks = await loadAuthoredPilotLandmarks(TOWN_LAYOUT, null, {
    assetVariant: ASSET_VARIANTS.BASELINE,
    sceneLoader: async () => {
      requested = true;
      return new Group();
    },
  });
  assert.equal(requested, false);
  assert.equal(landmarks.size, 0);
});

test('authored TownBell keeps idle and interaction-driven swing behavior', () => {
  const bell = new Group();
  const swing = new Group();
  swing.name = 'TownBellSwing';
  bell.add(swing);
  const animator = new WorldAnimator();

  bindAuthoredBellMotion(animator, bell);
  assert.equal(typeof animator.ringBell, 'function');
  animator.update(0.016, false);
  const idleRotation = swing.rotation.z;
  animator.ringBell();
  animator.update(0.016, false);

  assert.notEqual(idleRotation, 0);
  assert.ok(
    Math.abs(swing.rotation.z - idleRotation) > 0.1,
    'ring impulse should visibly exceed the idle sway',
  );
});

test('the pilot preserves arrival coordinates and the elevated Bell interaction contract', () => {
  assert.deepEqual(TOWN_LAYOUT.spawn, { x: 0, y: 2, z: 14 });
  assert.deepEqual(TOWN_LAYOUT.gate, { x: 0, y: 0, z: 11.7 });
  assert.deepEqual(TOWN_LAYOUT.landmarks.ledger, { x: -2, y: 0.8, z: 3 });
  assert.equal(TOWN_LAYOUT.landmarks.bell.x, 3);
  assert.equal(TOWN_LAYOUT.landmarks.bell.z, -36.5);
  assert.ok(TOWN_LAYOUT.landmarks.bell.baseY >= 2);
  assert.equal(
    TOWN_LAYOUT.landmarks.bell.y,
    TOWN_LAYOUT.landmarks.bell.baseY + 0.5,
  );
  assert.deepEqual(TOWN_INTERACTION_CONTRACT, {
    ledger: { id: 'ledger', radius: 2 },
    bell: { id: 'bell', radius: 2 },
  });
});
