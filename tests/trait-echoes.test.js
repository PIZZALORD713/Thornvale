import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  BoxGeometry,
  Color,
  DataTexture,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Vector3,
} from 'three';

import {
  ASSET_VARIANTS,
  DEFAULT_TRAIT_ECHO_VARIANT,
  resolveAssetVariant,
  resolveTraitEchoVariant,
  TRAIT_ECHO_VARIANTS,
} from '../src/config/assets.js';
import {
  countTraitEchoPlacements,
  countTraitEchoTriangles,
  TRAIT_ECHO_V1,
} from '../src/config/trait-echoes.js';
import { CORE_HOOK_V03 } from '../src/content/core-hook-v03.js';
import { TOWN_LAYOUT } from '../src/config/town.js';
import {
  getCuratedFriendsiesEntry,
  getCuratedFriendsiesTrait,
} from '../src/content/friendsies-cast.js';
import { createNature } from '../src/visuals/CozyTownKit.js';
import {
  bakeRigidTrait,
  loadTraitEchoV1,
  projectTraitEchoStoryState,
} from '../src/visuals/FriendsiesTraitEchoes.js';
import { WorldAnimator } from '../src/visuals/WorldAnimator.js';

function createStaticTraitScene({ size = [1, 2, 1], position = [0, 0, 0] } = {}) {
  const scene = new Group();
  const geometry = new BoxGeometry(...size);
  const material = new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x000000,
  });
  const mesh = new Mesh(geometry, material);
  mesh.position.fromArray(position);
  scene.add(mesh);
  return scene;
}

function storySnapshot(eventsSeen = [], choice = null) {
  return {
    eventsSeen: [...eventsSeen],
    choices: choice ? { [CORE_HOOK_V03.ids.choice]: choice } : {},
  };
}

async function readGlbDocument(path) {
  const buffer = await readFile(new URL(path, import.meta.url));
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, `${path} is not a glTF binary`);
  assert.equal(buffer.readUInt32LE(4), 2, `${path} must use glTF 2.0`);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, `${path} has no JSON chunk`);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

function countDocumentTriangles(document) {
  return (document.meshes || []).reduce((total, mesh) => (
    total + (mesh.primitives || []).reduce((meshTotal, primitive) => {
      const accessor = document.accessors?.[primitive.indices ?? primitive.attributes?.POSITION];
      assert.ok(accessor, 'trait primitive has no vertex/index accessor');
      assert.equal(primitive.mode ?? 4, 4, 'trait primitive must use triangles');
      assert.equal(accessor.count % 3, 0, 'trait primitive has incomplete triangles');
      return meshTotal + accessor.count / 3;
    }, 0)
  ), 0);
}

test('the intended art treatment is default while explicit and unknown values retain safe rollback', () => {
  assert.equal(DEFAULT_TRAIT_ECHO_VARIANT, TRAIT_ECHO_VARIANTS.V1);
  assert.equal(resolveTraitEchoVariant(''), TRAIT_ECHO_VARIANTS.V1);
  assert.equal(resolveTraitEchoVariant('?traits=v1'), TRAIT_ECHO_VARIANTS.V1);
  assert.equal(resolveTraitEchoVariant('?traits=unknown'), TRAIT_ECHO_VARIANTS.OFF);

  assert.equal(resolveTraitEchoVariant('?assets=pilot'), TRAIT_ECHO_VARIANTS.V1);
  assert.equal(resolveAssetVariant('?traits=v1'), ASSET_VARIANTS.PILOT);
  assert.equal(
    resolveTraitEchoVariant('?assets=baseline&traits=v1'),
    TRAIT_ECHO_VARIANTS.V1,
  );
  assert.equal(
    resolveAssetVariant('?assets=pilot&traits=off'),
    ASSET_VARIANTS.PILOT,
  );
});

test('every v1 family resolves through the canonical curated cast registry', () => {
  for (const family of TRAIT_ECHO_V1.families) {
    const { sourceTokenId, traitType, value } = family.trait;
    const entry = getCuratedFriendsiesEntry(sourceTokenId);
    const trait = getCuratedFriendsiesTrait(sourceTokenId, traitType, value);

    assert.ok(entry, `${family.id} references an uncurated token`);
    assert.equal(entry.source.collection, 'fRiENDSiES');
    assert.equal(entry.source.tokenId, sourceTokenId);
    assert.equal(entry.source.canonicalToken, true);
    assert.ok(trait, `${family.id} does not resolve its exact curated trait`);
    assert.equal(trait.sourceTokenId, sourceTokenId);
    assert.equal(trait.trait_type, traitType);
    assert.equal(trait.value, value);
    assert.match(trait.asset_url, /^\/friendsies\/(0001|8914)\/.+\.glb$/);
  }
});

test('the three real trait packages retain the rigid-prop glTF contract', async () => {
  for (const family of TRAIT_ECHO_V1.families) {
    const trait = getCuratedFriendsiesTrait(
      family.trait.sourceTokenId,
      family.trait.traitType,
      family.trait.value,
    );
    const document = await readGlbDocument(`../public${trait.asset_url}`);
    const meshNodes = (document.nodes || []).filter((node) => Number.isInteger(node.mesh));

    assert.equal(document.meshes?.length, 1, `${family.id} must remain one draw family`);
    assert.equal(document.meshes[0].primitives?.length, 1);
    assert.ok(
      document.meshes[0].primitives[0].extensions?.KHR_draco_mesh_compression,
      `${family.id} must remain Draco-compressed`,
    );
    assert.equal(document.skins?.length, 1, `${family.id} lost its source skin`);
    assert.equal(document.skins[0].joints?.length, 20);
    assert.equal(meshNodes.length, 1);
    assert.equal(meshNodes[0].skin, 0);
    assert.ok(document.animations?.some((clip) => clip.name === 'Idle Float'));
    assert.equal(countDocumentTriangles(document), family.sourceTriangles);
  }
});

test('v1 keeps seven strategically mounted placements in three trait families', () => {
  assert.equal(TRAIT_ECHO_V1.families.length, 3);
  assert.equal(TRAIT_ECHO_V1.budgets.expectedPlacements, 7);
  assert.equal(TRAIT_ECHO_V1.budgets.maximumDrawCalls, 3);
  assert.equal(countTraitEchoPlacements(), 7);
  assert.equal(countTraitEchoTriangles(), 26_544);
  assert.ok(
    countTraitEchoTriangles() <= TRAIT_ECHO_V1.budgets.maximumDisplayedTriangles,
    'v1 exceeds its displayed-triangle ceiling',
  );

  const familyIds = TRAIT_ECHO_V1.families.map((family) => family.id);
  const placements = TRAIT_ECHO_V1.families.flatMap((family) => family.placements);
  const placementIds = placements.map((placement) => placement.id);
  assert.equal(new Set(familyIds).size, familyIds.length, 'family IDs must be unique');
  assert.equal(
    new Set(placementIds).size,
    placementIds.length,
    'placement IDs must be globally unique',
  );

  for (const placement of placements) {
    const hasPosition = placement.position?.length === 3
      && placement.position.every(Number.isFinite);
    const hasLandmarkAnchor = typeof placement.anchor?.landmark === 'string'
      && placement.anchor.offset?.length === 3
      && placement.anchor.offset.every(Number.isFinite);
    assert.ok(
      hasPosition || hasLandmarkAnchor,
      `${placement.id} has neither a finite position nor a landmark anchor`,
    );
    assert.ok(Number.isFinite(placement.height) && placement.height > 0);
    assert.ok(
      ['offering', 'sconce', 'crest'].includes(placement.socket),
      `${placement.id} has no authored landmark socket`,
    );
  }

  const pairs = new Map();
  for (const placement of placements.filter((entry) => entry.pairId)) {
    const pair = pairs.get(placement.pairId) || [];
    pair.push(placement);
    pairs.set(placement.pairId, pair);
  }
  assert.deepEqual([...pairs.keys()].sort(), ['gate-guidance', 'ledger-witness']);
  for (const [pairId, pair] of pairs) {
    assert.equal(pair.length, 2, `${pairId} must have exactly two witnesses`);
    assert.deepEqual(pair.map((placement) => placement.pairRole).sort(), ['first', 'second']);
  }
});

test('landmark trait scales stay inside their legibility bands', () => {
  const placements = new Map(
    TRAIT_ECHO_V1.families
      .flatMap((family) => family.placements)
      .map((placement) => [placement.id, placement]),
  );
  const assertHeightInRange = (id, minimum, maximum) => {
    const height = placements.get(id)?.height;
    assert.ok(
      Number.isFinite(height) && height >= minimum && height <= maximum,
      `${id} height ${height} is outside ${minimum}-${maximum}`,
    );
  };

  assert.equal(placements.get('arrival-private-flower')?.height, 0.72);
  assertHeightInRange('ledger-witness-flower-west', 0.70, 0.74);
  assertHeightInRange('ledger-witness-flower-east', 0.70, 0.74);
  assertHeightInRange('gate-guidance-torch-west', 1.16, 1.20);
  assertHeightInRange('gate-guidance-torch-east', 1.16, 1.20);
  assertHeightInRange('bell-ritual-torch', 0.98, 1.02);
  assertHeightInRange('ledger-office-crown', 0.52, 0.56);
});

test('fRiENDSiES route flowers can replace the 56 central procedural placeholders', () => {
  const animator = {
    add() {},
    registerBob() {},
    registerSway() {},
  };
  const fullNature = createNature(animator, TOWN_LAYOUT);
  const curatedNature = createNature(animator, TOWN_LAYOUT, {
    includeRouteWildflowers: false,
  });
  const countFlowers = (nature) => {
    const meadow = nature.getObjectByName('particle_wildflower_meadow');
    const stems = meadow?.getObjectByName('particle_flower_stems');
    const heads = meadow?.getObjectByName('particle_flower_heads');
    assert.ok(stems?.isInstancedMesh);
    assert.ok(heads?.isInstancedMesh);
    assert.equal(stems.count, heads.count);
    return stems.count;
  };

  assert.equal(countFlowers(fullNature), 108);
  assert.equal(countFlowers(curatedNature), 52);
});

test('story projection is pure across arrival, dusk, anomaly, intervention, and both choices', () => {
  const events = CORE_HOOK_V03.events;
  const arrival = storySnapshot();
  const dusk = storySnapshot([events.stewardMet, events.ledgerSigned]);
  const anomaly = storySnapshot([
    events.stewardMet,
    events.ledgerSigned,
    events.firstBellRung,
    events.anomalyBellRang,
  ]);
  const postBell = storySnapshot([
    events.stewardMet,
    events.ledgerSigned,
    events.firstBellRung,
  ]);
  const intervention = storySnapshot([
    ...anomaly.eventsSeen,
    events.falseRecordSeen,
  ]);
  const comply = storySnapshot([
    ...intervention.eventsSeen,
    events.choiceMade,
  ], 'comply');
  const alter = storySnapshot([
    ...intervention.eventsSeen,
    events.choiceMade,
  ], 'alter');
  const inputsBeforeProjection = structuredClone({
    arrival,
    dusk,
    anomaly,
    postBell,
    intervention,
    comply,
    alter,
  });

  assert.deepEqual(projectTraitEchoStoryState(arrival), {
    id: 'arrival',
    ledgerFlowerScale: 0.75,
    ledgerFlowerScaleY: 1,
    ledgerFlowerLean: 0,
    crownTilt: 0,
    torchEmissive: 0.08,
    bellLight: 0,
    torchFlicker: true,
  });
  assert.deepEqual(projectTraitEchoStoryState(dusk), {
    id: 'dusk-guidance',
    ledgerFlowerScale: 1,
    ledgerFlowerScaleY: 1,
    ledgerFlowerLean: 0,
    crownTilt: 0,
    torchEmissive: 0.48,
    bellLight: 0.30,
    torchFlicker: true,
  });
  assert.deepEqual(projectTraitEchoStoryState(anomaly), {
    id: 'anomaly',
    ledgerFlowerScale: 1.08,
    ledgerFlowerScaleY: 1,
    ledgerFlowerLean: -0.22,
    crownTilt: 0.16,
    torchEmissive: 0.16,
    bellLight: 0,
    torchFlicker: false,
  });
  assert.deepEqual(projectTraitEchoStoryState(postBell), {
    id: 'post-bell',
    ledgerFlowerScale: 1,
    ledgerFlowerScaleY: 1,
    ledgerFlowerLean: 0,
    crownTilt: 0,
    torchEmissive: 0.20,
    bellLight: 0.04,
    torchFlicker: true,
  });
  assert.deepEqual(projectTraitEchoStoryState(intervention), {
    id: 'intervention',
    ledgerFlowerScale: 1,
    ledgerFlowerScaleY: 0.80,
    ledgerFlowerLean: 0.25,
    crownTilt: 0.28,
    torchEmissive: 0.04,
    bellLight: 0,
    torchFlicker: false,
  });
  assert.deepEqual(projectTraitEchoStoryState(comply), {
    id: 'comply',
    ledgerFlowerScale: 1,
    ledgerFlowerScaleY: 1,
    ledgerFlowerLean: 0,
    crownTilt: 0,
    torchEmissive: 0.24,
    bellLight: 0.06,
    torchFlicker: true,
  });
  assert.deepEqual(projectTraitEchoStoryState(alter), {
    id: 'alter',
    ledgerFlowerScale: 1,
    ledgerFlowerScaleY: 0.80,
    ledgerFlowerLean: 0.25,
    crownTilt: 0.34,
    torchEmissive: 0.03,
    bellLight: 0,
    torchFlicker: false,
  });

  const first = projectTraitEchoStoryState(anomaly);
  const second = projectTraitEchoStoryState(anomaly);
  assert.notEqual(first, second, 'projection should return a fresh value object');
  assert.deepEqual(first, second);
  assert.equal(Object.isFrozen(first), true);
  assert.deepEqual(
    { arrival, dusk, anomaly, postBell, intervention, comply, alter },
    inputsBeforeProjection,
    'story projection must not mutate durable snapshots',
  );
});

test('explicit off and unknown variants make zero trait asset requests', async () => {
  let requests = 0;
  const sceneLoader = async () => {
    requests += 1;
    return createStaticTraitScene();
  };

  assert.equal(await loadTraitEchoV1({ variant: 'unknown', sceneLoader }), null);
  assert.equal(
    await loadTraitEchoV1({ variant: TRAIT_ECHO_VARIANTS.OFF, sceneLoader }),
    null,
  );
  assert.equal(requests, 0);
});

test('one family load failure does not remove surviving trait families', async () => {
  const requestedUrls = [];
  const sourceScenes = [];
  const originalWarn = console.warn;
  console.warn = () => {};
  let echoes;
  try {
    echoes = await loadTraitEchoV1({
      variant: TRAIT_ECHO_VARIANTS.V1,
      sceneLoader: async (url) => {
        requestedUrls.push(url);
        if (url.endsWith('/hand-torch.glb')) throw new Error('simulated torch failure');
        const scene = createStaticTraitScene();
        sourceScenes.push(scene);
        return scene;
      },
    });
  } finally {
    console.warn = originalWarn;
  }

  assert.ok(echoes);
  assert.equal(requestedUrls.length, 3);
  assert.deepEqual([...echoes.families.keys()].sort(), ['civic-crown', 'welcome-flower']);
  assert.deepEqual([...echoes.failedFamilies.keys()], ['civic-torch']);
  assert.equal(echoes.families.get('welcome-flower').mesh.count, 3);
  assert.equal(echoes.families.get('civic-crown').mesh.count, 1);
  assert.deepEqual(
    [...echoes.root.userData.traitEcho.loadedFamilies].sort(),
    ['civic-crown', 'welcome-flower'],
  );
  assert.deepEqual(echoes.root.userData.traitEcho.failedFamilies, ['civic-torch']);

  echoes.dispose();
  for (const scene of sourceScenes) {
    const mesh = scene.children[0];
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});

test('v1 caches identical trait URLs within one initialization', async () => {
  const flower = TRAIT_ECHO_V1.families.find((family) => family.id === 'welcome-flower');
  const config = {
    id: 'trait-cache-test',
    version: '1.0.0-test',
    budgets: {
      maximumDisplayedTriangles: flower.sourceTriangles * 2,
      maximumDrawCalls: 2,
      expectedPlacements: 2,
    },
    families: [
      {
        ...flower,
        id: 'flower-cache-a',
        placements: [{ ...flower.placements[0], id: 'flower-cache-placement-a' }],
      },
      {
        ...flower,
        id: 'flower-cache-b',
        placements: [{ ...flower.placements[1], id: 'flower-cache-placement-b' }],
      },
    ],
  };
  let requests = 0;
  const source = createStaticTraitScene();
  const echoes = await loadTraitEchoV1({
    variant: TRAIT_ECHO_VARIANTS.V1,
    config,
    sceneLoader: async () => {
      requests += 1;
      return source;
    },
  });

  assert.equal(requests, 1);
  assert.deepEqual(
    [...echoes.families.keys()].sort(),
    ['flower-cache-a', 'flower-cache-b'],
  );
  assert.equal(echoes.failedFamilies.size, 0);

  echoes.dispose();
  source.children[0].geometry.dispose();
  source.children[0].material.dispose();
});

test('the Ledger crown anchors to the surviving landmark instead of floating at a fixed height', async () => {
  const sourceScenes = [];
  const echoes = await loadTraitEchoV1({
    variant: TRAIT_ECHO_VARIANTS.V1,
    sceneLoader: async () => {
      const scene = createStaticTraitScene();
      sourceScenes.push(scene);
      return scene;
    },
  });
  const ledger = new Group();
  const ledgerMesh = new Mesh(
    new BoxGeometry(2, 2, 1),
    new MeshStandardMaterial(),
  );
  ledgerMesh.position.set(-2, 1, 3);
  ledger.add(ledgerMesh);

  assert.equal(echoes.anchorToLandmarks({ ledger }), true);
  const position = echoes.positionOverrides.get('ledger-office-crown');
  assert.ok(Math.abs(position[0] - -2) < 1e-12);
  assert.ok(Math.abs(position[1] - 2.012) < 1e-12);
  assert.ok(Math.abs(position[2] - 3) < 1e-12);
  assert.equal(echoes.root.userData.traitEcho.ledgerCrownAnchored, true);

  echoes.dispose();
  ledgerMesh.geometry.dispose();
  ledgerMesh.material.dispose();
  for (const scene of sourceScenes) {
    scene.children[0].geometry.dispose();
    scene.children[0].material.dispose();
  }
});

test('the ritual torch and guidance light follow the Bell landmark while Ledger anchoring remains intact', async () => {
  const sourceScenes = [];
  const echoes = await loadTraitEchoV1({
    variant: TRAIT_ECHO_VARIANTS.V1,
    reducedMotion: true,
    sceneLoader: async () => {
      const scene = createStaticTraitScene();
      sourceScenes.push(scene);
      return scene;
    },
  });
  const townRoot = new Group();
  const bell = new Group();
  bell.position.set(3, 2.4, -36.5);
  townRoot.add(bell, echoes.root);

  const ledger = new Group();
  const ledgerMesh = new Mesh(
    new BoxGeometry(2, 2, 1),
    new MeshStandardMaterial(),
  );
  ledgerMesh.position.set(-2, 1, 3);
  ledger.add(ledgerMesh);
  townRoot.add(ledger);

  assert.equal(echoes.anchorToLandmarks({ ledger, bell }), true);
  assert.deepEqual(
    echoes.positionOverrides.get('bell-ritual-torch'),
    [2.44, 3.88, -36.2],
  );
  assert.deepEqual(
    echoes.positionOverrides.get('ledger-office-crown'),
    [-2, 2.012, 3],
  );
  assert.equal(echoes.root.userData.traitEcho.bellTorchAnchored, true);
  assert.equal(echoes.root.userData.traitEcho.ledgerCrownAnchored, true);

  const torchRuntime = echoes.families.get('civic-torch');
  const torchIndex = torchRuntime.config.placements.findIndex(
    (placement) => placement.id === 'bell-ritual-torch',
  );
  const torchMatrix = new Matrix4();
  const torchPosition = new Vector3();
  const assertPosition = (actual, expected, label) => {
    assert.ok(
      actual.distanceTo(new Vector3(...expected)) <= 1e-5,
      `${label} ${actual.toArray()} does not match ${expected}`,
    );
  };
  torchRuntime.mesh.getMatrixAt(torchIndex, torchMatrix);
  torchPosition.setFromMatrixPosition(torchMatrix);
  assertPosition(torchPosition, [2.44, 3.88, -36.2], 'torch');
  assertPosition(torchRuntime.light.position, [2.44, 4.72, -36.2], 'guidance light');

  bell.position.set(-8, 1.25, 17);
  assert.equal(echoes.anchorToLandmarks({ bell }), true);
  torchRuntime.mesh.getMatrixAt(torchIndex, torchMatrix);
  torchPosition.setFromMatrixPosition(torchMatrix);
  assertPosition(torchPosition, [-8.56, 2.73, 17.3], 'moved torch');
  assertPosition(torchRuntime.light.position, [-8.56, 3.57, 17.3], 'moved guidance light');
  assert.deepEqual(
    echoes.positionOverrides.get('ledger-office-crown'),
    [-2, 2.012, 3],
    'anchoring the Bell again must preserve the Ledger override',
  );

  echoes.dispose();
  ledgerMesh.geometry.dispose();
  ledgerMesh.material.dispose();
  for (const scene of sourceScenes) {
    scene.children[0].geometry.dispose();
    scene.children[0].material.dispose();
  }
});

test('reduced motion applies story state immediately and disposal unregisters world animation', async () => {
  const worldAnimator = new WorldAnimator();
  const sourceScenes = [];
  const echoes = await loadTraitEchoV1({
    variant: TRAIT_ECHO_VARIANTS.V1,
    worldAnimator,
    reducedMotion: true,
    sceneLoader: async () => {
      const scene = createStaticTraitScene();
      sourceScenes.push(scene);
      return scene;
    },
  });
  assert.equal(worldAnimator.animations.length, 1);
  assert.equal(echoes.mounts.mesh.count, 7);
  assert.equal(echoes.mounts.mesh.name, 'trait_echo_civic_mounts');
  assert.equal(echoes.root.userData.traitEcho.mountDrawCalls, 1);
  assert.ok([...echoes.mounts.mesh.instanceMatrix.array].every(Number.isFinite));
  for (const runtime of echoes.families.values()) assert.equal(runtime.mesh.castShadow, true);

  const state = projectTraitEchoStoryState(storySnapshot([
    CORE_HOOK_V03.events.stewardMet,
    CORE_HOOK_V03.events.ledgerSigned,
  ]));
  echoes.setStoryState(storySnapshot([
    CORE_HOOK_V03.events.stewardMet,
    CORE_HOOK_V03.events.ledgerSigned,
  ]));
  assert.equal(echoes.current.crownTilt, state.crownTilt);
  assert.equal(echoes.current.ledgerFlowerScale, state.ledgerFlowerScale);
  assert.equal(echoes.current.bellLight, state.bellLight);

  worldAnimator.update(0.1, true);
  const torch = echoes.families.get('civic-torch');
  assert.ok(torch.light.intensity > 0);
  assert.ok([...torch.mesh.instanceMatrix.array].every(Number.isFinite));

  echoes.dispose();
  assert.equal(echoes.mounts, null);
  assert.equal(worldAnimator.animations.length, 0);
  for (const scene of sourceScenes) {
    scene.children[0].geometry.dispose();
    scene.children[0].material.dispose();
  }
});

test('the shared civic mount draw uses socket colors over a white material base', async () => {
  const sourceScenes = [];
  const echoes = await loadTraitEchoV1({
    variant: TRAIT_ECHO_VARIANTS.V1,
    sceneLoader: async () => {
      const scene = createStaticTraitScene();
      sourceScenes.push(scene);
      return scene;
    },
  });
  const { material, mesh, placements } = echoes.mounts;
  const expectedColors = {
    offering: 0x5f6848,
    sconce: 0x7a4538,
    crest: 0xa88b52,
  };

  assert.deepEqual(TRAIT_ECHO_V1.civicMount, {
    baseColor: 0xffffff,
    socketColors: expectedColors,
  });
  assert.equal(material.color.getHex(), 0xffffff);
  assert.equal(material.vertexColors, false);
  assert.equal(mesh.count, 7);
  assert.equal(
    echoes.root.children.filter((child) => child.isInstancedMesh).length,
    4,
    'v1 must remain three trait draws plus one civic-mount draw',
  );
  assert.ok(mesh.instanceColor, 'setColorAt must allocate an instance-color attribute');
  assert.equal(mesh.instanceColor.count, 7);
  assert.equal(mesh.instanceColor.itemSize, 3);
  assert.ok(
    [...mesh.instanceColor.array].every((component) => Number.isFinite(component) && component > 0),
    'every mount instance needs a non-black finite color',
  );

  const actual = new Color();
  placements.forEach(({ placement }, index) => {
    mesh.getColorAt(index, actual);
    assert.equal(
      actual.getHex(),
      expectedColors[placement.socket],
      `${placement.id} does not use the ${placement.socket} socket color`,
    );
  });

  echoes.dispose();
  for (const scene of sourceScenes) {
    scene.children[0].geometry.dispose();
    scene.children[0].material.dispose();
  }
});

test('Trait Echo disposal releases shared embedded textures exactly once', async () => {
  const textureDisposeCounts = [];
  const sourceScenes = [];
  const echoes = await loadTraitEchoV1({
    variant: TRAIT_ECHO_VARIANTS.V1,
    sceneLoader: async () => {
      const scene = createStaticTraitScene();
      const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
      let disposeCount = 0;
      texture.dispose = () => {
        disposeCount += 1;
      };
      scene.children[0].material.map = texture;
      textureDisposeCounts.push(() => disposeCount);
      sourceScenes.push(scene);
      return scene;
    },
  });

  echoes.dispose();
  assert.deepEqual(textureDisposeCounts.map((getCount) => getCount()), [1, 1, 1]);
  for (const scene of sourceScenes) {
    scene.children[0].geometry.dispose();
    scene.children[0].material.dispose();
  }
});

test('bakeRigidTrait rejects malformed geometry without vertical extent', () => {
  const source = createStaticTraitScene({ size: [1, 0, 1] });
  assert.throws(
    () => bakeRigidTrait(source, 'Flat Trait'),
    /no usable vertical extent/,
  );
  source.children[0].geometry.dispose();
  source.children[0].material.dispose();
});

test('bakeRigidTrait supports a static plain mesh without an armature', () => {
  const source = createStaticTraitScene({
    size: [2, 4, 6],
    position: [3, 5, -2],
  });
  const sourceMesh = source.children[0];
  const baked = bakeRigidTrait(source, 'Static Flower');

  assert.notEqual(baked.geometry, sourceMesh.geometry);
  assert.notEqual(baked.material, sourceMesh.material);
  assert.equal(baked.sourceHeight, 4);
  assert.deepEqual(baked.sourceSize.toArray(), [2, 4, 6]);
  assert.equal(baked.geometry.getAttribute('skinIndex'), undefined);
  assert.equal(baked.geometry.getAttribute('skinWeight'), undefined);

  baked.geometry.computeBoundingBox();
  const size = baked.geometry.boundingBox.getSize(new Vector3());
  assert.ok(Math.abs(baked.geometry.boundingBox.min.y) < 1e-12);
  assert.ok(Math.abs(size.y - 1) < 1e-12);
  assert.deepEqual(size.toArray(), [0.5, 1, 1.5]);

  baked.geometry.dispose();
  baked.material.dispose();
  sourceMesh.geometry.dispose();
  sourceMesh.material.dispose();
});
