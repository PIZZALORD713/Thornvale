import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { inspectGlb } from '../scripts/probe-friendsies-trait.mjs';
import {
  FRIENDSIES_PROJECT_FAMILY_ID,
  validateFriendsiesProjectAssetAuthorization,
} from '../scripts/check-asset-budgets.mjs';
import { getCuratedFriendsiesTrait } from '../src/content/friendsies-cast.js';

const METADATA_SHA256 = '9f1c4e1cf8d848bd2ceaff7cde48c4ecf60a4b1d0afe273e7a5c5b68c2aee3ef';
const BUDGET_GROUP = 'friendsies-character:pond-grove-v1';

const EXPECTED_ASSETS = Object.freeze([
  {
    id: 'friendsies-pond-grove-carrot-v1',
    traitType: 'head',
    value: 'Carrot',
    sourceTokenId: 952,
    assetHash: '52ace99054a82db5bb05d1213ec048a5',
    path: 'public/friendsies/environment/pond-grove-v1/head-carrot.glb',
    bytes: 286_216,
    sha256: '497704b585c74c3d4b4a2eaf27d0f6bee2dd36b50144acea0d6c29172e5ed65e',
    triangles: 7_056,
  },
  {
    id: 'friendsies-pond-grove-earthworm-v1',
    traitType: 'head',
    value: 'Earthworm',
    sourceTokenId: 601,
    assetHash: 'e87f8a5943a749d420354f24b5c913df',
    path: 'public/friendsies/environment/pond-grove-v1/head-earthworm.glb',
    bytes: 359_232,
    sha256: '3961eda5f0f194eadc07fe36f126478dc1b5275f11220d5dd44a5be19e03db0b',
    triangles: 9_664,
  },
  {
    id: 'friendsies-pond-grove-flower-hill-v1',
    traitType: 'head',
    value: 'Flower Hill',
    sourceTokenId: 563,
    assetHash: 'be68e9d400f5be45fc485bf18df85a68',
    path: 'public/friendsies/environment/pond-grove-v1/head-flower-hill.glb',
    bytes: 84_744,
    sha256: 'e2cc2e240b5894ca5fa6bfbccb216658c3c833a8063afec181a95b57cda165d8',
    triangles: 2_744,
  },
  {
    id: 'friendsies-pond-grove-blooming-tree-v1',
    traitType: 'sprout',
    value: 'Blooming Tree',
    sourceTokenId: 563,
    assetHash: '832b32717ead69077ab86f57d169a203',
    path: 'public/friendsies/environment/pond-grove-v1/sprout-blooming-tree.glb',
    bytes: 160_004,
    sha256: '307dffcfacb8341c62284e1d572f823a83f061e951e459cfa529e3cccfc7f086',
    triangles: 27_128,
  },
  {
    id: 'friendsies-pond-grove-resting-green-leaf-v1',
    traitType: 'sprout',
    value: 'Resting Green Leaf',
    sourceTokenId: 1017,
    assetHash: 'c3d4251fd07059dd4e8fced0b0ca631a',
    path: 'public/friendsies/environment/pond-grove-v1/sprout-resting-green-leaf.glb',
    bytes: 89_740,
    sha256: '91f4544d2ace120956416407a7afe29e00731bd8b2ac862c256a897740a398a5',
    triangles: 640,
  },
  {
    id: 'friendsies-pond-grove-purp-mush-v1',
    traitType: 'sprout',
    value: 'Purp Mush',
    sourceTokenId: 404,
    assetHash: 'e21213f839a1064cefa849551b6e6d5b',
    path: 'public/friendsies/environment/pond-grove-v1/sprout-purp-mush.glb',
    bytes: 57_888,
    sha256: '75413d5aec8c59ae78a497a38d9a2ff749462e2a4a127415e6d98960ac6c4487',
    triangles: 1_368,
  },
]);

async function readJson(relativeUrl) {
  return JSON.parse(await readFile(new URL(relativeUrl, import.meta.url), 'utf8'));
}

test('Pond-Grove selections resolve exact pinned variants and token witnesses', async () => {
  const index = await readJson('../assets-src/friendsies/trait-index.json');
  assert.equal(index.source.sha256, METADATA_SHA256);

  for (const expected of EXPECTED_ASSETS) {
    const entry = index.traits.find((trait) => (
      trait.id === `${expected.traitType}:${expected.value}`
    ));
    assert.ok(entry, `${expected.value} is absent from the pinned trait index`);
    const variant = entry.variants.find((candidate) => (
      candidate.assetUrl.endsWith(`/${expected.assetHash}.glb`)
    ));
    assert.ok(variant, `${expected.value} lost its exact selected variant`);
    assert.ok(
      variant.tokenIds.includes(expected.sourceTokenId),
      `${expected.value} lost token #${expected.sourceTokenId} as variant evidence`,
    );
  }
});

test('bundled Pond-Grove GLBs are canonical rigid candidates within the family envelope', async () => {
  let totalBytes = 0;
  for (const expected of EXPECTED_ASSETS) {
    const bytes = await readFile(new URL(`../${expected.path}`, import.meta.url));
    assert.equal(bytes.byteLength, expected.bytes, `${expected.value} byte count`);
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      expected.sha256,
      `${expected.value} hash`,
    );
    const inspection = inspectGlb(bytes);
    assert.equal(inspection.counts.meshes, 1);
    assert.equal(inspection.counts.primitives, 1);
    assert.equal(inspection.counts.triangles, expected.triangles);
    assert.equal(inspection.counts.skins, 1);
    assert.equal(inspection.counts.joints, 20);
    assert.equal(inspection.counts.animations, 1);
    assert.equal(inspection.counts.morphTargets, 0);
    assert.deepEqual(inspection.extensionsRequired, ['KHR_draco_mesh_compression']);
    assert.equal(inspection.compatibility.classification, 'rigid-candidate');
    totalBytes += expected.bytes;
  }
  assert.equal(totalBytes, 1_037_824);
});

test('Pond-Grove manifest and curated runtime registry preserve exact lineage and fallback scope', async () => {
  const manifest = await readJson('../assets-src/asset-manifest.json');
  for (const expected of EXPECTED_ASSETS) {
    const asset = manifest.assets.find((entry) => entry.id === expected.id);
    assert.ok(asset, `${expected.id} is absent from the asset manifest`);
    assert.equal(asset.path, expected.path);
    assert.equal(asset.runtime, true);
    assert.equal(asset.kind, 'character-model');
    assert.equal(asset.family, FRIENDSIES_PROJECT_FAMILY_ID);
    assert.deepEqual(asset.budgetGroups, [BUDGET_GROUP]);
    assert.deepEqual(asset.runtimeContexts, [
      'environment:pond-grove',
      'trait-echo:vegetation',
    ]);
    assert.equal(asset.bytes, expected.bytes);
    assert.equal(asset.sha256, expected.sha256);
    assert.match(asset.source.url, new RegExp(`${expected.assetHash}\\.glb$`));
    assert.equal(asset.source.sha256, expected.sha256);
    assert.deepEqual(validateFriendsiesProjectAssetAuthorization(asset), []);

    const curated = getCuratedFriendsiesTrait(
      expected.sourceTokenId,
      expected.traitType,
      expected.value,
    );
    assert.ok(curated, `${expected.value} has no bounded runtime registry entry`);
    assert.equal(curated.asset_url, `/${expected.path.replace(/^public\//u, '')}`);
  }
});

test('Pond-Grove source and provenance records identify every trait and local fallback', async () => {
  const [source, provenance] = await Promise.all([
    readFile(new URL(
      '../assets-src/friendsies/environment/pond-grove-v1/SOURCE.md',
      import.meta.url,
    ), 'utf8'),
    readFile(new URL(
      '../public/friendsies/environment/pond-grove-v1/PROVENANCE.md',
      import.meta.url,
    ), 'utf8'),
  ]);
  for (const expected of EXPECTED_ASSETS) {
    assert.match(source, new RegExp(`${expected.traitType}:${expected.value}`));
    assert.match(source, new RegExp(expected.sha256));
    assert.match(provenance, new RegExp(expected.sha256));
  }
  for (const record of [source, provenance]) {
    assert.match(record, /friendsies-project/);
    assert.match(record, /ADR 0004/);
    assert.match(record, /\?traits=off/);
  }
  assert.match(provenance, /procedural (nature|vegetation|town)/i);
  assert.match(provenance, /must not block startup/i);
});
