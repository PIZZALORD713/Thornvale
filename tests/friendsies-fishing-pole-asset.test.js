import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  inspectGlb,
  parseGlbJson,
} from '../scripts/probe-friendsies-trait.mjs';
import {
  FRIENDSIES_PROJECT_FAMILY_ID,
  validateFriendsiesProjectAssetAuthorization,
} from '../scripts/check-asset-budgets.mjs';
import { FRIENDSIES_FISHING_POLE_URL } from '../src/visuals/FishingWorld.js';

const EXPECTED_URL = 'https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/a7c18d32c3575842b53793691ab74e55.glb';
const EXPECTED_PREVIEW_URL = 'https://storage.googleapis.com/friendsies-v2-assets-d8088d/previews/90ae4fe8ab596152204199023b8b1f1f.png';
const EXPECTED_SHA256 = 'f7fd184057ea34c3a2a0b3ee0c0f5f5a2acfa978182ecd73758eb2b65b91b1b1';
const EXPECTED_BYTES = 368_156;
const EXPECTED_SAMPLE_TOKEN_IDS = [
  40, 258, 285, 336, 343, 382, 401, 421, 501, 611,
  671, 728, 857, 891, 903, 938, 1048, 1058, 1265, 1287,
];

async function readJson(relativeUrl) {
  return JSON.parse(await readFile(new URL(relativeUrl, import.meta.url), 'utf8'));
}

test('canonical hand:Guess metadata resolves to the exact fishing-pole variant', async () => {
  const index = await readJson('../assets-src/friendsies/trait-index.json');
  assert.equal(index.source.sha256, '9f1c4e1cf8d848bd2ceaff7cde48c4ecf60a4b1d0afe273e7a5c5b68c2aee3ef');

  const pole = index.traits.find((entry) => entry.id === 'hand:Guess');
  assert.ok(pole, 'hand:Guess must remain present in the pinned trait index');
  assert.equal(pole.traitType, 'hand');
  assert.equal(pole.value, 'Guess');
  assert.equal(pole.useCount, 120);
  assert.equal(pole.tokenIds.length, 120);
  assert.deepEqual(pole.tokenIds.slice(0, 20), EXPECTED_SAMPLE_TOKEN_IDS);
  assert.equal(pole.variants.length, 1);
  assert.equal(pole.variants[0].assetUrl, EXPECTED_URL);
  assert.equal(pole.variants[0].previewUrl, EXPECTED_PREVIEW_URL);
  assert.equal(pole.variants[0].useCount, 120);
});

test('bundled fishing pole is byte-for-byte canonical and keeps the expected GLB contract', async () => {
  const bytes = await readFile(new URL(
    '../public/friendsies/tools/fishing-pole-v1.glb',
    import.meta.url,
  ));
  assert.equal(bytes.byteLength, EXPECTED_BYTES);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), EXPECTED_SHA256);

  const inspection = inspectGlb(bytes);
  assert.equal(inspection.sha256, EXPECTED_SHA256);
  assert.deepEqual(inspection.counts, {
    meshes: 1,
    primitives: 1,
    triangles: 2464,
    skins: 1,
    joints: 20,
    uniqueJoints: 20,
    animations: 1,
    materials: 1,
    textures: 3,
    images: 3,
    nodes: 22,
    meshNodes: 1,
    skinnedMeshNodes: 1,
    morphTargets: 0,
  });
  assert.deepEqual(inspection.extensionsRequired, ['KHR_draco_mesh_compression']);
  assert.equal(inspection.compatibility.classification, 'rigid-candidate');

  const document = parseGlbJson(bytes);
  assert.equal(document.scenes[0].name, 'Scene');
  assert.equal(document.nodes[document.scenes[0].nodes[0]].name, 'Character Rig');
  assert.equal(document.nodes.find((node) => node.mesh === 0)?.name, 'X');
  assert.equal(document.meshes[0].name, 'Mesh.108');
  assert.equal(document.animations[0].name, 'Idle Float');
  assert.deepEqual(
    document.images.map((image) => image.name),
    ['T_Guess_N', 'T_Guess_D', 'T_Guess_M_1-T_Guess_R_1'],
  );
});

test('fishing-pole manifest entry inherits standing authorization and exact lineage', async () => {
  const manifest = await readJson('../assets-src/asset-manifest.json');
  const pole = manifest.assets.find((entry) => entry.id === 'friendsies-tool-fishing-pole-v1');
  assert.deepEqual(pole, {
    id: 'friendsies-tool-fishing-pole-v1',
    path: 'public/friendsies/tools/fishing-pole-v1.glb',
    runtime: true,
    kind: 'character-model',
    family: FRIENDSIES_PROJECT_FAMILY_ID,
    budgetGroups: ['friendsies-character:tool-fishing-pole-v1'],
    runtimeContexts: [
      'environment:pond-fishing',
      'equipment:fishing',
    ],
    bytes: EXPECTED_BYTES,
    sha256: EXPECTED_SHA256,
    source: {
      originalFilename: 'a7c18d32c3575842b53793691ab74e55.glb',
      url: EXPECTED_URL,
      sha256: EXPECTED_SHA256,
      transform: 'Bundled unchanged from the canonical hand:Guess trait asset and presented as ThornVale fishing equipment.',
    },
  });
  assert.deepEqual(validateFriendsiesProjectAssetAuthorization(pole), []);
  assert.equal(FRIENDSIES_FISHING_POLE_URL, '/friendsies/tools/fishing-pole-v1.glb');
});

test('source and runtime records identify hand:Guess and preserve the fallback contract', async () => {
  const [source, provenance] = await Promise.all([
    readFile(new URL('../assets-src/friendsies/tools/SOURCE.md', import.meta.url), 'utf8'),
    readFile(new URL('../public/friendsies/tools/PROVENANCE.md', import.meta.url), 'utf8'),
  ]);
  for (const record of [source, provenance]) {
    assert.match(record, new RegExp(EXPECTED_SHA256));
    assert.match(record, /hand:Guess/);
    assert.match(record, /friendsies-project/);
    assert.match(record, /ADR 0004/);
  }
  assert.match(source, /a7c18d32c3575842b53793691ab74e55\.glb/);
  assert.match(provenance, /\/friendsies\/tools\/fishing-pole-v1\.glb/);
  assert.match(provenance, /procedural (rod|pole)/i);
  assert.match(provenance, /must not block startup/i);
});
