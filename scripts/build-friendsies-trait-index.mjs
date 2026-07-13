#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  FRIENDSIES_METADATA_CATALOG_URL,
  FRIENDSIES_TOKEN_MAX,
} from '../src/config/player-character.js';

export const METADATA_URL = FRIENDSIES_METADATA_CATALOG_URL;
export const EXPECTED_TOKEN_COUNT = FRIENDSIES_TOKEN_MAX;

const DEFAULT_OUTPUT_PATH = fileURLToPath(new URL(
  '../assets-src/friendsies/trait-index.json',
  import.meta.url,
));

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function assertAbsoluteHttpUrl(value, label) {
  assertNonEmptyString(value, label);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`${label} must be an absolute URL`);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new TypeError(`${label} must use http or https`);
  }
  return value;
}

function metadataEntries(metadata) {
  if (Array.isArray(metadata)) {
    return metadata.map((entry, index) => [String(index + 1), entry]);
  }
  if (!metadata || typeof metadata !== 'object') {
    throw new TypeError('metadata must be an array or object of token entries');
  }
  return Object.entries(metadata);
}

function normalizeTokenRecords(metadata, { requireAbsoluteUrls = false } = {}) {
  const seenTokenIds = new Set();
  const records = metadataEntries(metadata).map(([metadataKey, entry]) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new TypeError(`metadata entry ${metadataKey} must be an object`);
    }

    const tokenId = Number(entry.id ?? entry.token_id ?? metadataKey);
    if (!Number.isSafeInteger(tokenId) || tokenId <= 0) {
      throw new TypeError(`metadata entry ${metadataKey} has an invalid token ID`);
    }
    if (seenTokenIds.has(tokenId)) {
      throw new TypeError(`metadata contains duplicate token ID ${tokenId}`);
    }
    seenTokenIds.add(tokenId);

    if (!Array.isArray(entry.attributes)) {
      throw new TypeError(`token ${tokenId} attributes must be an array`);
    }

    const attributes = entry.attributes.map((attribute, attributeIndex) => {
      const prefix = `token ${tokenId} attribute ${attributeIndex}`;
      if (!attribute || typeof attribute !== 'object' || Array.isArray(attribute)) {
        throw new TypeError(`${prefix} must be an object`);
      }
      const traitType = assertNonEmptyString(attribute.trait_type, `${prefix} trait_type`);
      const value = assertNonEmptyString(attribute.value, `${prefix} value`);
      const validateUrl = requireAbsoluteUrls ? assertAbsoluteHttpUrl : assertNonEmptyString;
      const assetUrl = validateUrl(attribute.asset_url, `${prefix} asset_url`);
      const previewUrl = validateUrl(attribute.preview_url, `${prefix} preview_url`);
      return { traitType, value, assetUrl, previewUrl };
    });

    return { tokenId, attributes };
  });

  return records.sort((left, right) => left.tokenId - right.tokenId);
}

/**
 * Validate the pinned collection snapshot before the CLI writes an index.
 * `expectedTokenCount` remains configurable so the same contract can be tested
 * against a small offline fixture.
 */
export function validateCollectionMetadata(metadata, {
  expectedTokenCount = EXPECTED_TOKEN_COUNT,
} = {}) {
  if (!Number.isSafeInteger(expectedTokenCount) || expectedTokenCount <= 0) {
    throw new TypeError('expectedTokenCount must be a positive integer');
  }

  const records = normalizeTokenRecords(metadata, { requireAbsoluteUrls: true });
  if (records.length !== expectedTokenCount) {
    throw new Error(
      `expected ${expectedTokenCount} token IDs, received ${records.length}`,
    );
  }
  for (let index = 0; index < records.length; index += 1) {
    const expectedTokenId = index + 1;
    if (records[index].tokenId !== expectedTokenId) {
      throw new Error(
        `expected contiguous token ID ${expectedTokenId}, received ${records[index].tokenId}`,
      );
    }
  }
  return records;
}

function validateBuildOptions({ sourceUrl, sourceSha256, retrievedOn }) {
  assertAbsoluteHttpUrl(sourceUrl, 'sourceUrl');
  if (typeof sourceSha256 !== 'string' || !/^[a-f\d]{64}$/i.test(sourceSha256)) {
    throw new TypeError('sourceSha256 must be a 64-character hexadecimal SHA-256');
  }
  if (typeof retrievedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(retrievedOn)) {
    throw new TypeError('retrievedOn must use YYYY-MM-DD');
  }
}

/**
 * Build a deterministic, flat catalog of collection traits.
 *
 * The same named trait can point at more than one binary or preview. Those
 * combinations remain distinct variants rather than being collapsed to the
 * first URL encountered.
 */
export function buildTraitIndex(metadata, {
  sourceUrl,
  sourceSha256,
  retrievedOn,
}) {
  validateBuildOptions({ sourceUrl, sourceSha256, retrievedOn });
  const records = normalizeTokenRecords(metadata);
  const traitGroups = new Map();

  for (const { tokenId, attributes } of records) {
    for (const { traitType, value, assetUrl, previewUrl } of attributes) {
      const traitKey = JSON.stringify([traitType, value]);
      let trait = traitGroups.get(traitKey);
      if (!trait) {
        trait = {
          traitType,
          value,
          useCount: 0,
          tokenIds: new Set(),
          variants: new Map(),
        };
        traitGroups.set(traitKey, trait);
      }
      trait.useCount += 1;
      trait.tokenIds.add(tokenId);

      const variantKey = JSON.stringify([assetUrl, previewUrl]);
      let variant = trait.variants.get(variantKey);
      if (!variant) {
        variant = {
          assetUrl,
          previewUrl,
          useCount: 0,
          tokenIds: new Set(),
        };
        trait.variants.set(variantKey, variant);
      }
      variant.useCount += 1;
      variant.tokenIds.add(tokenId);
    }
  }

  const traits = [...traitGroups.values()]
    .sort((left, right) => (
      compareText(left.traitType, right.traitType)
      || compareText(left.value, right.value)
    ))
    .map((trait) => ({
      id: `${trait.traitType}:${trait.value}`,
      traitType: trait.traitType,
      value: trait.value,
      useCount: trait.useCount,
      tokenIds: [...trait.tokenIds].sort((left, right) => left - right),
      variants: [...trait.variants.values()]
        .sort((left, right) => (
          compareText(left.assetUrl, right.assetUrl)
          || compareText(left.previewUrl, right.previewUrl)
        ))
        .map((variant) => ({
          assetUrl: variant.assetUrl,
          previewUrl: variant.previewUrl,
          useCount: variant.useCount,
          tokenIds: [...variant.tokenIds].sort((left, right) => left - right),
        })),
    }));

  const typeGroups = new Map();
  for (const trait of traits) {
    let type = typeGroups.get(trait.traitType);
    if (!type) {
      type = {
        traitType: trait.traitType,
        useCount: 0,
        tokenIds: new Set(),
        traitCount: 0,
        variantCount: 0,
      };
      typeGroups.set(trait.traitType, type);
    }
    type.useCount += trait.useCount;
    type.traitCount += 1;
    type.variantCount += trait.variants.length;
    for (const tokenId of trait.tokenIds) type.tokenIds.add(tokenId);
  }

  const typeSummaries = [...typeGroups.values()]
    .sort((left, right) => compareText(left.traitType, right.traitType))
    .map((type) => ({
      traitType: type.traitType,
      useCount: type.useCount,
      tokenCount: type.tokenIds.size,
      traitCount: type.traitCount,
      variantCount: type.variantCount,
    }));

  const traitUseCount = traits.reduce((total, trait) => total + trait.useCount, 0);
  const variantCount = traits.reduce((total, trait) => total + trait.variants.length, 0);

  return {
    schemaVersion: 1,
    collection: {
      id: 'friendsies',
      name: 'fRiENDSiES',
    },
    source: {
      url: sourceUrl,
      sha256: sourceSha256.toLowerCase(),
      retrievedOn,
    },
    summary: {
      tokenCount: records.length,
      traitUseCount,
      traitTypeCount: typeSummaries.length,
      traitCount: traits.length,
      variantCount,
    },
    typeSummaries,
    traits,
  };
}

function parseCliArguments(argv) {
  const options = {
    outputPath: DEFAULT_OUTPUT_PATH,
    retrievedOn: new Date().toISOString().slice(0, 10),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--output') {
      const value = argv[index + 1];
      if (!value) throw new Error('--output requires a path');
      options.outputPath = resolve(value);
      index += 1;
    } else if (argument === '--retrieved-on') {
      const value = argv[index + 1];
      if (!value) throw new Error('--retrieved-on requires YYYY-MM-DD');
      options.retrievedOn = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argument}`);
    }
  }
  return options;
}

async function fetchPinnedMetadata() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(METADATA_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`metadata request failed with HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    let metadata;
    try {
      metadata = JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      throw new Error(`metadata response is not valid JSON: ${error.message}`);
    }
    return { bytes, metadata };
  } finally {
    clearTimeout(timer);
  }
}

export async function runCli(argv = process.argv.slice(2)) {
  const options = parseCliArguments(argv);
  if (options.help) {
    process.stdout.write(
      'Usage: node scripts/build-friendsies-trait-index.mjs '
      + '[--output PATH] [--retrieved-on YYYY-MM-DD]\n',
    );
    return null;
  }

  const { bytes, metadata } = await fetchPinnedMetadata();
  validateCollectionMetadata(metadata);
  const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
  const index = buildTraitIndex(metadata, {
    sourceUrl: METADATA_URL,
    sourceSha256,
    retrievedOn: options.retrievedOn,
  });

  await mkdir(dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `Wrote ${index.summary.traitCount} traits from ${index.summary.tokenCount} tokens `
    + `to ${options.outputPath}\n`,
  );
  return index;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  runCli().catch((error) => {
    console.error(`[friendsies-trait-index] ${error.message}`);
    process.exitCode = 1;
  });
}
