#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
export const DEFAULT_TRAIT_INDEX_PATH = 'assets-src/friendsies/trait-index.json';
export const DEFAULT_TRAIT_PROBES_PATH = 'assets-src/friendsies/trait-probes.json';
export const DEFAULT_DOWNLOAD_LIMIT = 16 * 1024 * 1024;
const JSON_CHUNK_TYPE = 0x4e4f534a;
const GLB_MAGIC = 0x46546c67;
const GLB_VERSION = 2;
const TRIANGLE_MODES = new Set([4, 5, 6]);
const FRIENDSIES_ASSET_ORIGIN = 'https://storage.googleapis.com';
const FRIENDSIES_ASSET_PREFIX = '/friendsies-v2-assets-d8088d/assets/';

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError('GLB input must be a Buffer, ArrayBuffer, or typed-array view');
}

/** Parse and return the JSON document embedded in a glTF 2.0 binary container. */
export function parseGlbJson(value) {
  const buffer = asBuffer(value);
  if (buffer.length < 12) throw new Error('GLB header is truncated');
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error('GLB magic is invalid');

  const version = buffer.readUInt32LE(4);
  if (version !== GLB_VERSION) throw new Error(`GLB version ${version} is unsupported`);

  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength !== buffer.length) {
    throw new Error(
      `GLB declared length ${declaredLength} does not match received bytes ${buffer.length}`,
    );
  }

  let offset = 12;
  let document = null;
  while (offset < declaredLength) {
    if (offset + 8 > declaredLength) throw new Error('GLB chunk header is truncated');
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    if (chunkLength % 4 !== 0) throw new Error('GLB chunk length is not four-byte aligned');
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > declaredLength) throw new Error('GLB chunk payload is truncated');

    if (chunkType === JSON_CHUNK_TYPE) {
      if (document) throw new Error('GLB contains more than one JSON chunk');
      const jsonText = buffer
        .subarray(chunkStart, chunkEnd)
        .toString('utf8')
        .replace(/[\u0000\u0020]+$/u, '');
      try {
        document = JSON.parse(jsonText);
      } catch (error) {
        throw new Error(`GLB JSON chunk is invalid: ${error.message}`);
      }
    }
    offset = chunkEnd;
  }

  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('GLB does not contain an object JSON chunk');
  }
  if (document.asset?.version !== '2.0') {
    throw new Error(`glTF asset version ${document.asset?.version ?? 'missing'} is unsupported`);
  }
  return document;
}

function accessorCount(document, primitive) {
  const accessorIndex = Number.isInteger(primitive.indices)
    ? primitive.indices
    : primitive.attributes?.POSITION;
  const count = document.accessors?.[accessorIndex]?.count;
  return Number.isInteger(count) && count >= 0 ? count : null;
}

function triangleCountForPrimitive(document, primitive) {
  const mode = primitive.mode ?? 4;
  const count = accessorCount(document, primitive);
  if (count === null || !TRIANGLE_MODES.has(mode)) return null;
  if (mode === 4) return count % 3 === 0 ? count / 3 : null;
  return Math.max(0, count - 2);
}

function inspectStructure(document) {
  const meshes = Array.isArray(document.meshes) ? document.meshes : [];
  const primitives = meshes.flatMap((mesh) => (
    Array.isArray(mesh?.primitives) ? mesh.primitives : []
  ));
  const nodes = Array.isArray(document.nodes) ? document.nodes : [];
  const skins = Array.isArray(document.skins) ? document.skins : [];
  const meshNodes = nodes.filter((node) => Number.isInteger(node?.mesh));
  const skinnedMeshNodes = meshNodes.filter((node) => Number.isInteger(node?.skin));
  const triangleCounts = primitives.map((primitive) => (
    triangleCountForPrimitive(document, primitive)
  ));
  const incompleteTriangles = triangleCounts.some((count) => count === null);
  const morphTargetCount = primitives.reduce(
    (total, primitive) => total + (Array.isArray(primitive.targets) ? primitive.targets.length : 0),
    0,
  );
  const jointReferences = skins.flatMap((skin) => (
    Array.isArray(skin?.joints) ? skin.joints : []
  ));
  const incompleteSkinAttributes = primitives.some((primitive) => {
    const attributes = primitive.attributes ?? {};
    return Object.hasOwn(attributes, 'JOINTS_0') !== Object.hasOwn(attributes, 'WEIGHTS_0');
  });

  return {
    meshCount: meshes.length,
    primitiveCount: primitives.length,
    triangleCount: incompleteTriangles
      ? null
      : triangleCounts.reduce((total, count) => total + count, 0),
    skinCount: skins.length,
    jointCount: jointReferences.length,
    uniqueJointCount: new Set(jointReferences).size,
    animationCount: Array.isArray(document.animations) ? document.animations.length : 0,
    materialCount: Array.isArray(document.materials) ? document.materials.length : 0,
    textureCount: Array.isArray(document.textures) ? document.textures.length : 0,
    imageCount: Array.isArray(document.images) ? document.images.length : 0,
    nodeCount: nodes.length,
    meshNodeCount: meshNodes.length,
    skinnedMeshNodeCount: skinnedMeshNodes.length,
    morphTargetCount,
    incompleteTriangles,
    incompleteSkinAttributes,
  };
}

/**
 * Classify whether the container is worth the next, rendered compatibility gate.
 * `rigid-candidate` never claims rigid weights were proven; compressed vertex
 * weights still need the runtime bake or a decoded mesh audit.
 */
export function classifyGlbCompatibility(structure) {
  const reasons = [];
  if (structure.meshCount === 0 || structure.primitiveCount === 0) {
    return {
      classification: 'unsupported',
      reasons: ['No mesh primitives are present.'],
    };
  }
  if (structure.meshNodeCount === 0) {
    return {
      classification: 'unsupported',
      reasons: ['Mesh data is not referenced by a scene node.'],
    };
  }
  if (structure.incompleteTriangles || structure.incompleteSkinAttributes) {
    if (structure.incompleteTriangles) {
      reasons.push('At least one primitive is not countable triangle geometry.');
    }
    if (structure.incompleteSkinAttributes) {
      reasons.push('A primitive has incomplete joint/weight attributes.');
    }
    return { classification: 'unsupported', reasons };
  }
  if (
    structure.morphTargetCount > 0
    || structure.skinCount > 1
    || structure.skinnedMeshNodeCount > 1
  ) {
    if (structure.morphTargetCount > 0) reasons.push('Morph targets require deformable handling.');
    if (structure.skinCount > 1) reasons.push('Multiple skins require deformable handling.');
    if (structure.skinnedMeshNodeCount > 1) {
      reasons.push('Multiple skinned mesh nodes require deformable handling.');
    }
    return { classification: 'deformable', reasons };
  }
  if (
    structure.meshCount === 1
    && structure.primitiveCount === 1
    && structure.meshNodeCount === 1
    && structure.skinCount <= 1
    && structure.skinCount === structure.skinnedMeshNodeCount
  ) {
    reasons.push(
      structure.skinCount === 1
        ? 'Single-skinned primitive; decoded weights must still prove one rigid joint.'
        : 'Single unskinned primitive with a single scene node.',
    );
    return { classification: 'rigid-candidate', reasons };
  }

  reasons.push('Valid triangle geometry has a multi-mesh or multi-primitive structure.');
  return { classification: 'review', reasons };
}

/** Inspect a GLB without decoding geometry, loading textures, or rendering. */
export function inspectGlb(value) {
  const buffer = asBuffer(value);
  const document = parseGlbJson(buffer);
  const structure = inspectStructure(document);
  return {
    format: 'glTF 2.0 binary',
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    generator: document.asset?.generator ?? null,
    counts: {
      meshes: structure.meshCount,
      primitives: structure.primitiveCount,
      triangles: structure.triangleCount,
      skins: structure.skinCount,
      joints: structure.jointCount,
      uniqueJoints: structure.uniqueJointCount,
      animations: structure.animationCount,
      materials: structure.materialCount,
      textures: structure.textureCount,
      images: structure.imageCount,
      nodes: structure.nodeCount,
      meshNodes: structure.meshNodeCount,
      skinnedMeshNodes: structure.skinnedMeshNodeCount,
      morphTargets: structure.morphTargetCount,
    },
    extensionsUsed: [...new Set(document.extensionsUsed ?? [])].sort(),
    extensionsRequired: [...new Set(document.extensionsRequired ?? [])].sort(),
    compatibility: classifyGlbCompatibility(structure),
  };
}

function entriesFromIndex(index) {
  const container = index?.traits ?? index?.entries ?? index;
  if (Array.isArray(container)) return container.map((entry) => [entry?.key, entry]);
  if (!container || typeof container !== 'object') {
    throw new Error('Trait index must expose an object or array at `traits` or `entries`');
  }
  return Object.entries(container);
}

function normalizedVariants(entry) {
  let variants = entry?.variants ?? entry?.assets ?? [];
  if (!Array.isArray(variants) && variants && typeof variants === 'object') {
    variants = Object.entries(variants).map(([id, variant]) => ({ id, ...variant }));
  }
  if (!Array.isArray(variants)) variants = [];
  if (variants.length === 0 && (entry?.assetUrl || entry?.asset_url)) variants = [entry];

  return variants.map((variant, index) => {
    const assetUrl = variant?.assetUrl ?? variant?.asset_url ?? variant?.url;
    const previewUrl = variant?.previewUrl ?? variant?.preview_url ?? null;
    let derivedAssetHash = null;
    try {
      derivedAssetHash = basename(new URL(assetUrl).pathname, '.glb');
    } catch {
      // URL validation produces the actionable error at download time.
    }
    const assetHash = variant?.assetHash ?? derivedAssetHash;
    const id = String(
      variant?.id
      ?? variant?.variantId
      ?? variant?.variant
      ?? assetHash
      ?? index,
    );
    return {
      ...variant,
      id,
      index,
      assetHash,
      assetUrl,
      previewUrl,
    };
  });
}

/** Select one exact, case-sensitive catalog trait from a generated index. */
export function findTraitEntry(index, traitType, value) {
  if (typeof traitType !== 'string' || traitType.length === 0) {
    throw new TypeError('traitType must be a non-empty string');
  }
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('value must be a non-empty string');
  }
  const expectedKey = `${traitType}:${value}`;

  for (const [containerKey, candidate] of entriesFromIndex(index)) {
    if (!candidate || typeof candidate !== 'object') continue;
    const key = candidate.key ?? containerKey;
    const candidateType = candidate.traitType ?? candidate.trait_type ?? (
      typeof key === 'string' ? key.slice(0, key.indexOf(':')) : null
    );
    const candidateValue = candidate.value ?? (
      typeof key === 'string' && key.includes(':') ? key.slice(key.indexOf(':') + 1) : null
    );
    if (candidateType !== traitType || candidateValue !== value) continue;
    const variants = normalizedVariants(candidate);
    if (variants.length === 0) throw new Error(`${expectedKey} has no asset variants`);
    return {
      ...candidate,
      key: expectedKey,
      traitType,
      value,
      variants,
    };
  }

  throw new Error(`Trait not found in index: ${expectedKey}`);
}

/** Resolve an optional variant ID or zero-based variant index. */
export function selectTraitVariant(entry, selector = undefined) {
  const variants = normalizedVariants(entry);
  if (variants.length === 0) throw new Error(`${entry?.key ?? 'Trait'} has no asset variants`);

  if (selector === undefined || selector === null || selector === '') {
    const declaredDefault = entry?.defaultVariant ?? entry?.defaultVariantId;
    if (declaredDefault !== undefined) return selectTraitVariant(entry, String(declaredDefault));
    return variants.find((variant) => variant.default === true || variant.isDefault === true)
      ?? variants[0];
  }

  const requested = String(selector);
  const exact = variants.find((variant) => (
    variant.id === requested
    || variant.assetHash === requested
    || variant.assetUrl === requested
    || (() => {
      try {
        return basename(new URL(variant.assetUrl).pathname, '.glb') === requested;
      } catch {
        return false;
      }
    })()
  ));
  if (exact) return exact;

  if (/^\d+$/u.test(requested)) {
    const byIndex = variants[Number(requested)];
    if (byIndex) return byIndex;
  }

  throw new Error(
    `Variant ${requested} not found; available variants: ${variants.map((item) => item.id).join(', ')}`,
  );
}

export function assertFriendsiesGlbUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Trait asset URL is invalid: ${value}`);
  }
  if (
    url.origin !== FRIENDSIES_ASSET_ORIGIN
    || !url.pathname.startsWith(FRIENDSIES_ASSET_PREFIX)
    || !url.pathname.toLowerCase().endsWith('.glb')
  ) {
    throw new Error(`Trait asset URL is outside the pinned fRiENDSiES GLB host: ${url.href}`);
  }
  return url;
}

/** Download one selected GLB into memory; no binary is written to the repository. */
export async function downloadSelectedGlb(assetUrl, {
  fetchImpl = globalThis.fetch,
  timeoutMs = 20_000,
  maximumBytes = DEFAULT_DOWNLOAD_LIMIT,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A Fetch API implementation is required');
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be positive');
  if (!Number.isInteger(maximumBytes) || maximumBytes <= 0) {
    throw new Error('maximumBytes must be positive');
  }

  const url = assertFriendsiesGlbUrl(assetUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: 'follow' });
    if (!response.ok) throw new Error(`Trait download failed with HTTP ${response.status}`);
    assertFriendsiesGlbUrl(response.url || url.href);
    const declaredBytes = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(declaredBytes) && declaredBytes > maximumBytes) {
      throw new Error(`Trait GLB declares ${declaredBytes} bytes; limit is ${maximumBytes}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maximumBytes) {
      throw new Error(`Trait GLB is ${buffer.length} bytes; limit is ${maximumBytes}`);
    }
    return buffer;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Trait download timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function pathIsInside(rootDir, targetPath) {
  const fromRoot = relative(rootDir, targetPath);
  return fromRoot === '' || (
    fromRoot !== '..'
    && !fromRoot.startsWith(`..${sep}`)
    && !isAbsolute(fromRoot)
  );
}

function resolveRepoPath(rootDir, path, label) {
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error(`${label} must be a non-empty repository-relative path`);
  }
  const absolute = resolve(rootDir, path);
  if (isAbsolute(path) || !pathIsInside(rootDir, absolute)) {
    throw new Error(`${label} escapes the repository: ${path}`);
  }
  return absolute;
}

async function updateProbeFile(outputPath, record, sourceIndex) {
  let output = { schemaVersion: 1, sourceIndex, probes: [] };
  try {
    output = JSON.parse(await readFile(outputPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (output.schemaVersion !== 1 || !Array.isArray(output.probes)) {
    throw new Error('Existing trait probe file must use schemaVersion 1 with a probes array');
  }

  const identity = `${record.key}@${record.variant.id}`;
  const probes = output.probes.filter((candidate) => (
    `${candidate?.key}@${candidate?.variant?.id}` !== identity
  ));
  probes.push(record);
  probes.sort((left, right) => (
    left.key.localeCompare(right.key)
    || left.variant.id.localeCompare(right.variant.id)
  ));

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({
    schemaVersion: 1,
    sourceIndex,
    updatedAt: record.probedAt,
    probes,
  }, null, 2)}\n`);
}

function parseCliArguments(argv) {
  const options = {
    indexPath: DEFAULT_TRAIT_INDEX_PATH,
    outputPath: DEFAULT_TRAIT_PROBES_PATH,
    write: true,
  };
  const valueFlags = new Map([
    ['--type', 'traitType'],
    ['--value', 'value'],
    ['--variant', 'variant'],
    ['--index', 'indexPath'],
    ['--output', 'outputPath'],
    ['--timeout', 'timeoutMs'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--dry-run' || argument === '--no-write') {
      options.write = false;
      continue;
    }
    const field = valueFlags.get(argument);
    if (!field) throw new Error(`Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`${argument} requires a value`);
    }
    options[field] = value;
    index += 1;
  }

  if (options.timeoutMs !== undefined) {
    options.timeoutMs = Number(options.timeoutMs);
    if (!Number.isInteger(options.timeoutMs) || options.timeoutMs <= 0) {
      throw new Error('--timeout must be a positive integer in milliseconds');
    }
  }
  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/probe-friendsies-trait.mjs --type <hand|sprout> --value <exact value> [options]

Options:
  --variant <id|index>  Exact variant ID/hash or zero-based variant index
  --index <path>        Trait index (default: ${DEFAULT_TRAIT_INDEX_PATH})
  --output <path>       Probe ledger (default: ${DEFAULT_TRAIT_PROBES_PATH})
  --timeout <ms>        Download timeout (default: 20000)
  --dry-run             Print the probe without updating the probe ledger
  --help                Show this message

The selected GLB is held in memory for metadata inspection and is never saved.`);
}

export async function runProbeCli(argv = process.argv.slice(2), {
  rootDir = DEFAULT_ROOT,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
} = {}) {
  const options = parseCliArguments(argv);
  if (options.help) {
    printHelp();
    return null;
  }
  if (!options.traitType || !options.value) {
    throw new Error('--type and --value are required; values are exact and case-sensitive');
  }
  if (!['hand', 'sprout'].includes(options.traitType)) {
    throw new Error('--type must be hand or sprout');
  }

  const absoluteRoot = resolve(rootDir);
  const absoluteIndex = resolveRepoPath(absoluteRoot, options.indexPath, 'index path');
  const absoluteOutput = resolveRepoPath(absoluteRoot, options.outputPath, 'output path');
  const index = JSON.parse(await readFile(absoluteIndex, 'utf8'));
  const entry = findTraitEntry(index, options.traitType, options.value);
  const variant = selectTraitVariant(entry, options.variant);
  const glb = await downloadSelectedGlb(variant.assetUrl, {
    fetchImpl,
    timeoutMs: options.timeoutMs,
  });
  const probedAt = now().toISOString();
  const variantTokenIds = variant.tokenIds ?? variant.sampleTokenIds ?? [];
  const record = {
    key: entry.key,
    traitType: entry.traitType,
    value: entry.value,
    variant: {
      id: variant.id,
      index: variant.index,
      assetHash: variant.assetHash,
      assetUrl: variant.assetUrl,
      previewUrl: variant.previewUrl,
      useCount: variant.useCount ?? variantTokenIds.length,
      sampleTokenIds: variantTokenIds.slice(0, 20),
    },
    probedAt,
    inspection: inspectGlb(glb),
  };

  console.log(JSON.stringify(record, null, 2));
  if (options.write) {
    await updateProbeFile(absoluteOutput, record, options.indexPath);
    console.error(`Updated ${options.outputPath}; no GLB was written.`);
  }
  return record;
}

const isCli = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  try {
    await runProbeCli();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
