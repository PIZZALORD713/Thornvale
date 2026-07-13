import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  buildTraitIndex,
  METADATA_URL,
  validateCollectionMetadata,
} from '../scripts/build-friendsies-trait-index.mjs';
import { FRIENDSIES_METADATA_CATALOG_URL } from '../src/config/player-character.js';

const SOURCE_OPTIONS = Object.freeze({
  sourceUrl: 'https://example.test/pinned/friendsies.json',
  sourceSha256: 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789',
  retrievedOn: '2026-07-12',
});

function trait(traitType, value, assetName, previewName = `${assetName}.png`) {
  return {
    trait_type: traitType,
    value,
    asset_url: `https://assets.example.test/${assetName}`,
    preview_url: `https://previews.example.test/${previewName}`,
  };
}

function miniatureMetadataFixture() {
  return {
    3: {
      id: '3',
      attributes: [
        trait('sprout', 'Crown Up', 'crown-tall.glb'),
        trait('face', 'Open', 'open-a.png'),
      ],
    },
    1: {
      id: '1',
      attributes: [
        trait('hand', 'Flower White', 'flower-white.glb'),
        trait('face', 'Open', 'open-b.png'),
        trait('sprout', 'Crown Up', 'crown-short.glb'),
      ],
    },
    2: {
      id: '2',
      attributes: [
        trait('face', 'Open', 'open-a.png'),
        trait('hand', 'Book Of Ocean', 'book.glb'),
        trait('sprout', 'Crown Up', 'crown-tall.glb'),
      ],
    },
  };
}

test('buildTraitIndex produces a deterministic flat catalog with numeric token ordering', () => {
  const metadata = miniatureMetadataFixture();
  const untouched = structuredClone(metadata);
  const index = buildTraitIndex(metadata, SOURCE_OPTIONS);

  assert.deepEqual(metadata, untouched, 'the pure builder must not mutate metadata');
  assert.equal(index.schemaVersion, 1);
  assert.deepEqual(index.collection, { id: 'friendsies', name: 'fRiENDSiES' });
  assert.deepEqual(index.source, {
    url: SOURCE_OPTIONS.sourceUrl,
    sha256: SOURCE_OPTIONS.sourceSha256.toLowerCase(),
    retrievedOn: SOURCE_OPTIONS.retrievedOn,
  });
  assert.deepEqual(index.summary, {
    tokenCount: 3,
    traitUseCount: 8,
    traitTypeCount: 3,
    traitCount: 4,
    variantCount: 6,
  });
  assert.deepEqual(
    index.typeSummaries.map((type) => type.traitType),
    ['face', 'hand', 'sprout'],
  );
  assert.deepEqual(
    index.traits.map((entry) => entry.id),
    ['face:Open', 'hand:Book Of Ocean', 'hand:Flower White', 'sprout:Crown Up'],
  );

  const reversedMetadata = Object.fromEntries(
    Object.entries(metadata)
      .reverse()
      .map(([id, entry]) => [id, { ...entry, attributes: [...entry.attributes].reverse() }]),
  );
  assert.deepEqual(
    buildTraitIndex(reversedMetadata, SOURCE_OPTIONS),
    index,
    'object and attribute insertion order must not affect the index',
  );
});

test('face and sprout names preserve every distinct asset and preview variant', () => {
  const index = buildTraitIndex(miniatureMetadataFixture(), SOURCE_OPTIONS);
  const open = index.traits.find((entry) => entry.id === 'face:Open');
  const crown = index.traits.find((entry) => entry.id === 'sprout:Crown Up');

  assert.equal(open.useCount, 3);
  assert.deepEqual(open.tokenIds, [1, 2, 3]);
  assert.equal(open.variants.length, 2);
  assert.deepEqual(open.variants.map((variant) => variant.tokenIds), [[2, 3], [1]]);

  assert.equal(crown.useCount, 3);
  assert.deepEqual(crown.tokenIds, [1, 2, 3]);
  assert.equal(crown.variants.length, 2);
  assert.deepEqual(crown.variants.map((variant) => variant.tokenIds), [[1], [2, 3]]);
});

test('collection validation enforces contiguous IDs and required absolute URLs offline', () => {
  assert.equal(
    validateCollectionMetadata(miniatureMetadataFixture(), { expectedTokenCount: 3 }).length,
    3,
  );

  const missingId = miniatureMetadataFixture();
  delete missingId[2];
  assert.throws(
    () => validateCollectionMetadata(missingId, { expectedTokenCount: 3 }),
    /expected 3 token IDs, received 2/,
  );

  const missingUrl = miniatureMetadataFixture();
  delete missingUrl[1].attributes[0].asset_url;
  assert.throws(
    () => validateCollectionMetadata(missingUrl, { expectedTokenCount: 3 }),
    /asset_url must be a non-empty string/,
  );
});

test('generated index records the pinned 10k collection and multi-asset traits', async () => {
  const generated = JSON.parse(await readFile(new URL(
    '../assets-src/friendsies/trait-index.json',
    import.meta.url,
  ), 'utf8'));

  assert.equal(generated.source.url, METADATA_URL);
  assert.match(generated.source.sha256, /^[a-f\d]{64}$/);
  assert.equal(generated.summary.tokenCount, 10_000);
  assert.equal(generated.traits.length, generated.summary.traitCount);
  assert.ok(
    generated.traits.find((entry) => entry.id === 'face:Open')?.variants.length > 1,
  );
  assert.ok(
    generated.traits.find((entry) => entry.id === 'sprout:Crown Up')?.variants.length > 1,
  );
});

test('index generation stays pinned to the shared runtime metadata policy', () => {
  assert.equal(METADATA_URL, FRIENDSIES_METADATA_CATALOG_URL);
});
