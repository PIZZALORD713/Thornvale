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

const EXPECTED_URL = 'https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/2e7d86ace19eafc64df6be34dbd82483.glb';
const EXPECTED_SHA256 = '866cef9aec2a8817983e150f38e8634990c9038864d6a69fad67c5c26c4c98ba';
const EXPECTED_BYTES = 146_792;
const EXPECTED_TOKEN_IDS = [
  90, 172, 236, 546, 872, 900, 1046, 3604, 3706, 3720,
  4078, 4080, 4268, 5156, 5599, 6796, 6981, 7104, 8344,
];

async function readJson(relativeUrl) {
  return JSON.parse(await readFile(new URL(relativeUrl, import.meta.url), 'utf8'));
}

test('canonical hand:Axe metadata resolves to one exact pinned variant', async () => {
  const index = await readJson('../assets-src/friendsies/trait-index.json');
  assert.equal(index.source.sha256, '9f1c4e1cf8d848bd2ceaff7cde48c4ecf60a4b1d0afe273e7a5c5b68c2aee3ef');

  const axe = index.traits.find((entry) => entry.id === 'hand:Axe');
  assert.ok(axe, 'hand:Axe must remain present in the pinned trait index');
  assert.equal(axe.traitType, 'hand');
  assert.equal(axe.value, 'Axe');
  assert.equal(axe.useCount, 19);
  assert.deepEqual(axe.tokenIds, EXPECTED_TOKEN_IDS);
  assert.equal(axe.variants.length, 1);
  assert.equal(axe.variants[0].assetUrl, EXPECTED_URL);
  assert.equal(axe.variants[0].useCount, 19);
  assert.deepEqual(axe.variants[0].tokenIds, EXPECTED_TOKEN_IDS);
});

test('bundled Axe is byte-for-byte canonical and keeps the expected GLB contract', async () => {
  const bytes = await readFile(new URL(
    '../public/friendsies/tools/axe-v1.glb',
    import.meta.url,
  ));
  assert.equal(bytes.byteLength, EXPECTED_BYTES);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), EXPECTED_SHA256);

  const inspection = inspectGlb(bytes);
  assert.equal(inspection.sha256, EXPECTED_SHA256);
  assert.deepEqual(inspection.counts, {
    meshes: 1,
    primitives: 1,
    triangles: 1504,
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
  assert.equal(document.meshes[0].name, 'Mesh.339');
  assert.equal(document.animations[0].name, 'Idle Float');
  assert.deepEqual(
    document.images.map((image) => image.name),
    ['T_Axe_N', 'M_Axe_D', 'M_Axe_M-M_Axe_R'],
  );
});

test('Axe manifest entry inherits standing authorization and records exact lineage', async () => {
  const manifest = await readJson('../assets-src/asset-manifest.json');
  const axe = manifest.assets.find((entry) => entry.id === 'friendsies-tool-axe-v1');
  assert.deepEqual(axe, {
    id: 'friendsies-tool-axe-v1',
    path: 'public/friendsies/tools/axe-v1.glb',
    runtime: true,
    kind: 'character-model',
    family: FRIENDSIES_PROJECT_FAMILY_ID,
    budgetGroups: ['friendsies-character:tool-axe-v1'],
    runtimeContexts: [
      'environment:axe-discovery',
      'equipment:woodcutting',
    ],
    bytes: EXPECTED_BYTES,
    sha256: EXPECTED_SHA256,
    source: {
      originalFilename: '2e7d86ace19eafc64df6be34dbd82483.glb',
      url: EXPECTED_URL,
      sha256: EXPECTED_SHA256,
      transform: 'Bundled unchanged from the canonical hand:Axe trait asset.',
    },
  });
  assert.deepEqual(validateFriendsiesProjectAssetAuthorization(axe), []);

  const family = manifest.families[FRIENDSIES_PROJECT_FAMILY_ID];
  assert.equal(family.status, 'project-release-authorized');
  assert.equal(family.releaseBlocked, false);
  assert.equal(family.rawSourceRedistribution, false);
});

test('Axe source and runtime records preserve the stable URL, hash, and fallback', async () => {
  const [source, provenance] = await Promise.all([
    readFile(new URL('../assets-src/friendsies/tools/SOURCE.md', import.meta.url), 'utf8'),
    readFile(new URL('../public/friendsies/tools/PROVENANCE.md', import.meta.url), 'utf8'),
  ]);
  for (const record of [source, provenance]) {
    assert.match(record, new RegExp(EXPECTED_SHA256));
    assert.match(record, /friendsies-project/);
    assert.match(record, /ADR 0004/);
  }
  assert.match(source, /hand:Axe/);
  assert.match(source, /2e7d86ace19eafc64df6be34dbd82483\.glb/);
  assert.match(provenance, /\/friendsies\/tools\/axe-v1\.glb/);
  assert.match(provenance, /procedural Axe/i);
  assert.match(provenance, /must not block startup/i);
});
