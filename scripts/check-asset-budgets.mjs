#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_MANIFEST = 'assets-src/asset-manifest.json';
const HASH_PATTERN = /^[a-f0-9]{64}$/;
export const RELEASE_APPROVED_RUNTIME_STATUSES = Object.freeze([
  'project-authored',
  'cc0-1.0-verified',
  'project-release-authorized',
]);
const RELEASE_APPROVED_STATUS_SET = new Set(RELEASE_APPROVED_RUNTIME_STATUSES);
const DEVELOPMENT_EXCEPTION_STATUS = 'project-use-recorded';
const PROJECT_RELEASE_AUTHORIZED_STATUS = 'project-release-authorized';
export const FRIENDSIES_PROJECT_FAMILY_ID = 'friendsies-project';
export const FRIENDSIES_REMOTE_PLAYER_DEPENDENCY_ID = 'friendsies-remote-player-streaming';
export const FRIENDSIES_CANONICAL_ASSET_URL_PREFIX = 'https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/';

function formatBytes(bytes) {
  return `${bytes.toLocaleString('en-US')} B`;
}

function isInside(rootDir, targetPath) {
  const pathFromRoot = relative(rootDir, targetPath);
  return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..' && !isAbsolute(pathFromRoot));
}

function resolveRepoPath(rootDir, repoPath, errors, label) {
  if (typeof repoPath !== 'string' || repoPath.length === 0) {
    errors.push(`${label} must be a non-empty repository-relative path`);
    return null;
  }

  const absolutePath = resolve(rootDir, repoPath);
  if (isAbsolute(repoPath) || !isInside(rootDir, absolutePath)) {
    errors.push(`${label} escapes the repository: ${repoPath}`);
    return null;
  }

  return absolutePath;
}

async function fileHash(filePath) {
  const contents = await readFile(filePath);
  return createHash('sha256').update(contents).digest('hex');
}

async function listFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function groupTotal(assets, groupName) {
  return assets
    .filter((asset) => asset.budgetGroups?.includes(groupName))
    .reduce((sum, asset) => sum + asset.bytes, 0);
}

function checkLimit(errors, label, actual, maximum) {
  if (!Number.isInteger(maximum) || maximum < 0) {
    errors.push(`budget ${label} must be a non-negative integer`);
  } else if (actual > maximum) {
    errors.push(`${label} is ${formatBytes(actual)}; limit is ${formatBytes(maximum)}`);
  }
}

function validateFamilyContract(familyId, family, { runtime = false } = {}) {
  const errors = [];
  if (!family) {
    errors.push(`unknown family: ${familyId}`);
    return errors;
  }

  for (const field of ['creator', 'status', 'licenseOrPermission', 'provenance']) {
    if (typeof family[field] !== 'string' || family[field].length === 0) {
      errors.push(`family ${familyId} must declare ${field}`);
    }
  }
  if (typeof family.rawSourceRedistribution !== 'boolean') {
    errors.push(`family ${familyId} must declare rawSourceRedistribution as a boolean`);
  }
  if (typeof family.releaseBlocked !== 'boolean') {
    errors.push(`family ${familyId} must declare releaseBlocked as a boolean`);
  }
  if (family.releaseBlocked && (typeof family.releaseBlockReason !== 'string' || family.releaseBlockReason.length === 0)) {
    errors.push(`release-blocked family ${familyId} must declare releaseBlockReason`);
  }
  if (family.releaseBlocked === false && Object.hasOwn(family, 'releaseBlockReason')) {
    errors.push(`unblocked family ${familyId} cannot declare releaseBlockReason`);
  }
  if (!Object.hasOwn(family, 'sourcePage') || !Object.hasOwn(family, 'sourceRetrievedOn')) {
    errors.push(`family ${familyId} must declare sourcePage and sourceRetrievedOn, using null for project-authored or unresolved sources`);
  }
  if (family.status === PROJECT_RELEASE_AUTHORIZED_STATUS) {
    if (typeof family.runtimeDistributionScope !== 'string' || family.runtimeDistributionScope.length === 0) {
      errors.push(`project-release-authorized family ${familyId} must declare runtimeDistributionScope`);
    }
    if (family.rawSourceRedistribution !== false) {
      errors.push(`project-release-authorized family ${familyId} must keep rawSourceRedistribution false`);
    }
    if (family.releaseBlocked !== false) {
      errors.push(`project-release-authorized family ${familyId} cannot remain release blocked`);
    }
  }
  if (runtime && family.status !== 'project-authored') {
    if (typeof family.sourcePage !== 'string' || family.sourcePage.length === 0) {
      errors.push(`runtime family ${familyId} must record a source page`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(family.sourceRetrievedOn ?? '')) {
      errors.push(`runtime family ${familyId} must record sourceRetrievedOn as YYYY-MM-DD`);
    }
  }

  return errors;
}

function parseHttpsUrl(value, label, errors) {
  if (typeof value !== 'string' || value.length === 0) {
    errors.push(`${label} must be a non-empty HTTPS URL`);
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      errors.push(`${label} must use HTTPS: ${value}`);
      return null;
    }
    return url;
  } catch {
    errors.push(`${label} must be a valid HTTPS URL: ${value}`);
    return null;
  }
}

function isCanonicalFriendsiesAssetUrl(value) {
  return typeof value === 'string'
    && value.startsWith(FRIENDSIES_CANONICAL_ASSET_URL_PREFIX);
}

export function validateFriendsiesProjectAssetAuthorization(asset) {
  const errors = [];
  const label = asset?.id ? `asset ${asset.id}` : 'asset with missing id';
  const canonicalSource = isCanonicalFriendsiesAssetUrl(asset?.source?.url);
  if (canonicalSource && asset?.family !== FRIENDSIES_PROJECT_FAMILY_ID) {
    errors.push(`${label} must inherit standing authorization from family ${FRIENDSIES_PROJECT_FAMILY_ID}`);
  }
  if (asset?.family === FRIENDSIES_PROJECT_FAMILY_ID && !canonicalSource) {
    errors.push(`${label} claims ${FRIENDSIES_PROJECT_FAMILY_ID} without a canonical fRiENDSiES source URL`);
  }
  return errors;
}

/**
 * Validate network-fetched creative media that never appears under public/.
 * The returned errors are folded into the aggregate asset audit so tests can
 * also exercise this contract without network access or temporary files.
 */
export function validateExternalRuntimeDependencies(manifest) {
  const errors = [];
  const families = manifest?.families ?? {};
  const rawDependencies = manifest?.externalRuntimeDependencies;
  if (!Array.isArray(rawDependencies)) {
    errors.push('externalRuntimeDependencies must be an array');
    return { dependencies: [], errors, releaseBlockedFamilyIds: [] };
  }

  const dependencies = [];
  const seenIds = new Set();
  const releaseBlockedFamilyIds = new Set();

  for (const dependency of rawDependencies) {
    const id = dependency?.id;
    const label = typeof id === 'string' && id.length > 0
      ? `external runtime dependency ${id}`
      : 'external runtime dependency with missing id';

    if (!dependency || typeof dependency !== 'object' || Array.isArray(dependency)) {
      errors.push('every external runtime dependency must be an object');
      continue;
    }
    dependencies.push(dependency);

    if (typeof id !== 'string' || id.length === 0) {
      errors.push('every external runtime dependency must have a non-empty id');
    } else if (seenIds.has(id)) {
      errors.push(`duplicate external runtime dependency id: ${id}`);
    } else {
      seenIds.add(id);
    }

    if (typeof dependency.family !== 'string' || dependency.family.length === 0) {
      errors.push(`${label} must reference a family`);
    }
    const family = families[dependency.family];
    if (!family) {
      errors.push(`${label} references unknown family: ${dependency.family}`);
    } else {
      errors.push(...validateFamilyContract(dependency.family, family, { runtime: true }));
      if (RELEASE_APPROVED_STATUS_SET.has(family.status)) {
        if (family.releaseBlocked) releaseBlockedFamilyIds.add(dependency.family);
      } else if (family.status === DEVELOPMENT_EXCEPTION_STATUS && family.releaseBlocked === true) {
        releaseBlockedFamilyIds.add(dependency.family);
      } else {
        errors.push(`${label} uses status ${family.status}, which is neither release-approved nor an explicit release-blocked development exception`);
      }
    }

    if (
      id === FRIENDSIES_REMOTE_PLAYER_DEPENDENCY_ID
      && dependency.family !== FRIENDSIES_PROJECT_FAMILY_ID
    ) {
      errors.push(`${label} must inherit standing authorization from family ${FRIENDSIES_PROJECT_FAMILY_ID}`);
    }

    const catalog = dependency.metadataCatalog;
    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
      errors.push(`${label} must declare metadataCatalog`);
    } else {
      parseHttpsUrl(catalog.url, `${label} metadataCatalog.url`, errors);
      if (!HASH_PATTERN.test(catalog.sha256 ?? '')) {
        errors.push(`${label} metadataCatalog.sha256 must be a lowercase SHA-256 digest`);
      }
      if (!Number.isInteger(catalog.bytes) || catalog.bytes <= 0) {
        errors.push(`${label} metadataCatalog.bytes must be a positive integer`);
      }
    }

    if (!Array.isArray(dependency.allowedAssetOrigins) || dependency.allowedAssetOrigins.length === 0) {
      errors.push(`${label} allowedAssetOrigins must be a non-empty array`);
    } else {
      const seenOrigins = new Set();
      for (const origin of dependency.allowedAssetOrigins) {
        const url = parseHttpsUrl(origin, `${label} allowed asset origin`, errors);
        if (url && url.origin !== origin) {
          errors.push(`${label} allowed asset origin must contain only an origin: ${origin}`);
        }
        if (seenOrigins.has(origin)) {
          errors.push(`${label} has duplicate allowed asset origin: ${origin}`);
        }
        seenOrigins.add(origin);
      }
    }

    if (!Array.isArray(dependency.allowedAssetUrlPrefixes) || dependency.allowedAssetUrlPrefixes.length === 0) {
      errors.push(`${label} allowedAssetUrlPrefixes must be a non-empty array`);
    } else {
      const seenPrefixes = new Set();
      for (const prefix of dependency.allowedAssetUrlPrefixes) {
        const url = parseHttpsUrl(prefix, `${label} allowed asset URL prefix`, errors);
        if (url && !prefix.endsWith('/')) {
          errors.push(`${label} allowed asset URL prefix must end with /: ${prefix}`);
        }
        if (url && !dependency.allowedAssetOrigins?.includes(url.origin)) {
          errors.push(`${label} allowed asset URL prefix must belong to an allowed origin: ${prefix}`);
        }
        if (seenPrefixes.has(prefix)) {
          errors.push(`${label} has duplicate allowed asset URL prefix: ${prefix}`);
        }
        seenPrefixes.add(prefix);
      }
    }

    const scope = dependency.tokenScope;
    if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
      errors.push(`${label} must declare tokenScope`);
    } else {
      if (scope.type !== 'inclusive-range') {
        errors.push(`${label} tokenScope.type must be inclusive-range`);
      }
      if (!Number.isSafeInteger(scope.minimum) || scope.minimum <= 0) {
        errors.push(`${label} tokenScope.minimum must be a positive safe integer`);
      }
      if (!Number.isSafeInteger(scope.maximum) || scope.maximum < scope.minimum) {
        errors.push(`${label} tokenScope.maximum must be a safe integer at least as large as minimum`);
      }
    }

    for (const field of ['runtimeUse']) {
      if (typeof dependency[field] !== 'string' || dependency[field].length === 0) {
        errors.push(`${label} must declare ${field}`);
      }
    }
    if (Object.hasOwn(dependency, 'reason')) {
      errors.push(`${label} must not duplicate authorization prose in reason; authorization comes from its family`);
    }
  }

  return {
    dependencies,
    errors,
    releaseBlockedFamilyIds: [...releaseBlockedFamilyIds],
  };
}

/**
 * Validate the asset manifest, every managed file, and the declared byte budgets.
 * Throws one aggregate error so CI reports every actionable problem in one run.
 */
export async function runAssetAudit({
  rootDir = DEFAULT_ROOT,
  manifestPath = DEFAULT_MANIFEST,
  requireDist = false,
  releaseMode = false,
} = {}) {
  const errors = [];
  const absoluteRoot = resolve(rootDir);
  const absoluteManifest = resolveRepoPath(absoluteRoot, manifestPath, errors, 'manifest path');
  if (!absoluteManifest) throw new Error(errors.join('\n'));

  let manifest;
  try {
    manifest = JSON.parse(await readFile(absoluteManifest, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${manifestPath}: ${error.message}`);
  }

  if (manifest.schemaVersion !== 1) errors.push('schemaVersion must be 1');
  const policy = manifest.policy ?? {};
  const budgets = policy.budgets ?? {};
  const managedExtensions = new Set((policy.managedRuntimeExtensions ?? []).map((extension) => extension.toLowerCase()));
  const families = manifest.families ?? {};
  const assets = Array.isArray(manifest.assets) ? manifest.assets : [];

  if (Object.hasOwn(policy, 'allowedRuntimeStatuses')) {
    errors.push('policy.allowedRuntimeStatuses is not configurable; release-approved statuses are hard-coded in the audit');
  }
  if (managedExtensions.size === 0) errors.push('policy.managedRuntimeExtensions must not be empty');
  if (assets.length === 0) errors.push('assets must not be empty');

  const seenIds = new Set();
  const seenPaths = new Set();
  const runtimeAssets = [];
  const sourceAssets = [];
  const releaseBlockedFamilyIds = new Set();
  const externalValidation = validateExternalRuntimeDependencies(manifest);
  const externalRuntimeDependencies = externalValidation.dependencies;
  errors.push(...externalValidation.errors);
  for (const familyId of externalValidation.releaseBlockedFamilyIds) {
    releaseBlockedFamilyIds.add(familyId);
  }

  const checkedExternalProvenance = new Set();
  for (const dependency of externalRuntimeDependencies) {
    const familyId = dependency.family;
    const family = families[familyId];
    if (!family || checkedExternalProvenance.has(familyId)) continue;
    checkedExternalProvenance.add(familyId);
    const provenancePath = resolveRepoPath(
      absoluteRoot,
      family.provenance,
      errors,
      `family ${familyId} provenance`,
    );
    if (provenancePath) {
      try {
        const provenanceStat = await stat(provenancePath);
        if (!provenanceStat.isFile()) {
          errors.push(`family ${familyId} provenance is not a file: ${family.provenance}`);
        }
      } catch (error) {
        errors.push(`family ${familyId} provenance is missing: ${family.provenance}`);
      }
    }
  }

  for (const asset of assets) {
    const label = asset?.id ? `asset ${asset.id}` : 'asset with missing id';
    if (typeof asset?.id !== 'string' || asset.id.length === 0) {
      errors.push('every asset must have a non-empty id');
    } else if (seenIds.has(asset.id)) {
      errors.push(`duplicate asset id: ${asset.id}`);
    } else {
      seenIds.add(asset.id);
    }

    if (typeof asset?.path !== 'string' || asset.path.length === 0) {
      errors.push(`${label} must have a path`);
      continue;
    }
    if (seenPaths.has(asset.path)) errors.push(`duplicate asset path: ${asset.path}`);
    seenPaths.add(asset.path);

    const family = families[asset.family];
    if (!family) {
      errors.push(`${label} references unknown family: ${asset.family}`);
    } else {
      errors.push(...validateFamilyContract(asset.family, family, { runtime: asset.runtime }));
      const provenancePath = resolveRepoPath(absoluteRoot, family.provenance, errors, `family ${asset.family} provenance`);
      if (provenancePath) {
        try {
          const provenanceStat = await stat(provenancePath);
          if (!provenanceStat.isFile()) errors.push(`family ${asset.family} provenance is not a file: ${family.provenance}`);
        } catch (error) {
          errors.push(`family ${asset.family} provenance is missing: ${family.provenance}`);
        }
      }
    }

    errors.push(...validateFriendsiesProjectAssetAuthorization(asset));

    if (typeof asset.runtime !== 'boolean') errors.push(`${label} runtime must be boolean`);
    if (!Number.isInteger(asset.bytes) || asset.bytes < 0) errors.push(`${label} bytes must be a non-negative integer`);
    if (!HASH_PATTERN.test(asset.sha256 ?? '')) errors.push(`${label} sha256 must be a lowercase SHA-256 digest`);
    if (typeof asset.kind !== 'string' || asset.kind.length === 0) errors.push(`${label} must declare kind`);
    if (!asset.source || typeof asset.source !== 'object') {
      errors.push(`${label} must declare source metadata`);
    } else {
      if (typeof asset.source.originalFilename !== 'string' || asset.source.originalFilename.length === 0) {
        errors.push(`${label} source.originalFilename must be set`);
      }
      if (!HASH_PATTERN.test(asset.source.sha256 ?? '')) {
        errors.push(`${label} source.sha256 must be a lowercase SHA-256 digest`);
      }
      if (typeof asset.source.transform !== 'string' || asset.source.transform.length === 0) {
        errors.push(`${label} source.transform must be set`);
      }
      if (!asset.source.path && !asset.source.url) {
        errors.push(`${label} source must declare path or url`);
      }

      if (asset.source.path) {
        const sourcePath = resolveRepoPath(absoluteRoot, asset.source.path, errors, `${label} source.path`);
        if (sourcePath) {
          try {
            const sourceDigest = await fileHash(sourcePath);
            if (HASH_PATTERN.test(asset.source.sha256 ?? '') && sourceDigest !== asset.source.sha256) {
              errors.push(`${label} source hash mismatch: expected ${asset.source.sha256}, received ${sourceDigest}`);
            }
          } catch (error) {
            errors.push(`${label} source is missing: ${asset.source.path}`);
          }
        }
      }
    }

    const absoluteAssetPath = resolveRepoPath(absoluteRoot, asset.path, errors, `${label} path`);
    if (absoluteAssetPath) {
      try {
        const assetStat = await stat(absoluteAssetPath);
        if (!assetStat.isFile()) {
          errors.push(`${label} path is not a file: ${asset.path}`);
        } else {
          if (Number.isInteger(asset.bytes) && assetStat.size !== asset.bytes) {
            errors.push(`${label} size mismatch: expected ${asset.bytes}, received ${assetStat.size}`);
          }
          const digest = await fileHash(absoluteAssetPath);
          if (HASH_PATTERN.test(asset.sha256 ?? '') && digest !== asset.sha256) {
            errors.push(`${label} hash mismatch: expected ${asset.sha256}, received ${digest}`);
          }
        }
      } catch (error) {
        errors.push(`${label} file is missing: ${asset.path}`);
      }
    }

    if (asset.runtime) {
      runtimeAssets.push(asset);
      if (!asset.path.startsWith('public/')) errors.push(`${label} is runtime media but is not under public/`);
      if (family) {
        if (RELEASE_APPROVED_STATUS_SET.has(family.status)) {
          if (family.releaseBlocked) releaseBlockedFamilyIds.add(asset.family);
        } else if (family.status === DEVELOPMENT_EXCEPTION_STATUS && family.releaseBlocked === true) {
          releaseBlockedFamilyIds.add(asset.family);
        } else {
          errors.push(`${label} uses status ${family.status}, which is neither release-approved nor an explicit release-blocked development exception`);
        }
      }
    } else {
      sourceAssets.push(asset);
      if (asset.path.startsWith('public/')) errors.push(`${label} is non-runtime media but is under public/`);
      if (!['git', 'git-lfs', 'external-archive'].includes(asset.storage)) {
        errors.push(`${label} must declare storage as git, git-lfs, or external-archive`);
      }
      if (asset.storage === 'git' && asset.bytes > budgets.sourceBinaryMaxBytes) {
        errors.push(`${label} is ${formatBytes(asset.bytes)} in normal Git; use LFS or an approved external archive above ${formatBytes(budgets.sourceBinaryMaxBytes)}`);
      }
    }
  }

  const publicFiles = await listFiles(resolve(absoluteRoot, 'public'));
  const managedPublicPaths = publicFiles
    .filter((filePath) => managedExtensions.has(extname(filePath).toLowerCase()))
    .map((filePath) => relative(absoluteRoot, filePath).split(sep).join('/'))
    .sort();
  const declaredRuntimePaths = runtimeAssets.map((asset) => asset.path).sort();

  for (const runtimePath of managedPublicPaths) {
    if (!declaredRuntimePaths.includes(runtimePath)) errors.push(`unmanifested runtime media: ${runtimePath}`);
  }
  for (const declaredPath of declaredRuntimePaths) {
    if (!managedPublicPaths.includes(declaredPath)) errors.push(`manifest runtime path is not managed media: ${declaredPath}`);
  }
  for (const forbiddenPath of policy.forbiddenRuntimePaths ?? []) {
    if (managedPublicPaths.includes(forbiddenPath)) errors.push(`reference-only file returned to public/: ${forbiddenPath}`);
  }

  const releaseBlockedFamilies = [...releaseBlockedFamilyIds]
    .sort()
    .map((familyId) => {
      const familyAssets = runtimeAssets.filter((asset) => asset.family === familyId);
      const familyDependencies = externalRuntimeDependencies.filter(
        (dependency) => dependency.family === familyId,
      );
      return {
        id: familyId,
        status: families[familyId].status,
        reason: families[familyId].releaseBlockReason,
        assetCount: familyAssets.length,
        bytes: familyAssets.reduce((sum, asset) => sum + asset.bytes, 0),
        externalDependencyCount: familyDependencies.length,
        externalDependencyIds: familyDependencies.map((dependency) => dependency.id).sort(),
      };
    });

  if (releaseMode) {
    for (const family of releaseBlockedFamilies) {
      const dependencyLabel = family.externalDependencyCount === 1
        ? 'external runtime dependency'
        : 'external runtime dependencies';
      errors.push(
        `release-blocked runtime family ${family.id}: ${family.reason} `
        + `(${family.assetCount} local files; ${family.externalDependencyCount} ${dependencyLabel})`,
      );
    }
  }

  const activeTownBytes = groupTotal(runtimeAssets, 'active-town-glb');
  const pilotArrivalBytes = groupTotal(runtimeAssets, 'pilot-arrival-glb');
  const cc0RuntimeBytes = runtimeAssets
    .filter((asset) => families[asset.family]?.status === 'cc0-1.0-verified')
    .reduce((sum, asset) => sum + asset.bytes, 0);
  const compressedAudioBytes = runtimeAssets
    .filter((asset) => asset.kind === 'audio')
    .reduce((sum, asset) => sum + asset.bytes, 0);

  checkLimit(errors, 'active cottage + village GLBs', activeTownBytes, budgets.activeTownGlbMaxBytes);
  checkLimit(errors, 'pilot arrival/plaza GLB', pilotArrivalBytes, budgets.pilotArrivalGlbMaxBytes);
  checkLimit(errors, 'CC0 runtime payload', cc0RuntimeBytes, budgets.cc0RuntimeMaxBytes);
  checkLimit(errors, 'compressed audio payload', compressedAudioBytes, budgets.compressedAudioMaxBytes);

  const characterGroups = [...new Set(runtimeAssets
    .flatMap((asset) => asset.budgetGroups ?? [])
    .filter((group) => group.startsWith('friendsies-character:')))]
    .sort();
  const characterBytes = {};
  for (const group of characterGroups) {
    const total = groupTotal(runtimeAssets, group);
    characterBytes[group.slice('friendsies-character:'.length)] = total;
    checkLimit(errors, `fRiENDSiES character ${group.split(':')[1]}`, total, budgets.friendsiesCharacterMaxBytes);
  }

  for (const asset of runtimeAssets.filter((entry) => entry.kind === 'environment-texture')) {
    checkLimit(errors, `${asset.id} texture bytes`, asset.bytes, budgets.environmentTextureMaxBytes);
    if (!asset.dimensions || !Number.isInteger(asset.dimensions.width) || !Number.isInteger(asset.dimensions.height)) {
      errors.push(`${asset.id} must declare integer texture dimensions`);
    } else if (Math.max(asset.dimensions.width, asset.dimensions.height) > budgets.environmentTextureMaxDimension) {
      errors.push(`${asset.id} is ${asset.dimensions.width}x${asset.dimensions.height}; maximum dimension is ${budgets.environmentTextureMaxDimension}`);
    }
  }

  const sourceBatchBytes = {};
  for (const asset of sourceAssets) {
    if (!asset.intakeBatch) continue;
    sourceBatchBytes[asset.intakeBatch] = (sourceBatchBytes[asset.intakeBatch] ?? 0) + asset.bytes;
  }
  for (const [batch, bytes] of Object.entries(sourceBatchBytes).sort(([left], [right]) => left.localeCompare(right))) {
    checkLimit(errors, `source intake batch ${batch}`, bytes, budgets.sourceBatchMaxBytes);
  }

  let distBytes = null;
  if (requireDist) {
    const distFiles = await listFiles(resolve(absoluteRoot, 'dist'));
    if (distFiles.length === 0) {
      errors.push('dist/ is missing or empty; run the production build before --dist');
    } else {
      distBytes = 0;
      for (const filePath of distFiles) distBytes += (await stat(filePath)).size;
      checkLimit(errors, 'production dist', distBytes, budgets.distMaxBytes);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Asset audit failed:\n- ${[...new Set(errors)].sort().join('\n- ')}`);
  }

  return {
    manifestPath,
    runtimeAssetCount: runtimeAssets.length,
    runtimeAssetBytes: runtimeAssets.reduce((sum, asset) => sum + asset.bytes, 0),
    sourceAssetCount: sourceAssets.length,
    sourceAssetBytes: sourceAssets.reduce((sum, asset) => sum + asset.bytes, 0),
    externalRuntimeDependencyCount: externalRuntimeDependencies.length,
    externalRuntimeDependencies,
    activeTownBytes,
    pilotArrivalBytes,
    characterBytes,
    cc0RuntimeBytes,
    compressedAudioBytes,
    sourceBatchBytes,
    releaseBlockedFamilies,
    releaseReady: releaseBlockedFamilies.length === 0,
    distBytes,
    budgets,
  };
}

function printReport(report) {
  console.log(report.releaseReady ? 'Asset audit passed' : 'Asset audit passed for development; release blockers remain');
  console.log(`  Runtime media: ${report.runtimeAssetCount} files / ${formatBytes(report.runtimeAssetBytes)}`);
  console.log(`  External runtime dependencies: ${report.externalRuntimeDependencyCount}`);
  console.log(`  Active town GLBs: ${formatBytes(report.activeTownBytes)} / ${formatBytes(report.budgets.activeTownGlbMaxBytes)}`);
  for (const [token, bytes] of Object.entries(report.characterBytes)) {
    console.log(`  fRiENDSiES #${token}: ${formatBytes(bytes)} / ${formatBytes(report.budgets.friendsiesCharacterMaxBytes)}`);
  }
  console.log(`  CC0 runtime payload: ${formatBytes(report.cc0RuntimeBytes)} / ${formatBytes(report.budgets.cc0RuntimeMaxBytes)}`);
  console.log(`  Compressed audio: ${formatBytes(report.compressedAudioBytes)} / ${formatBytes(report.budgets.compressedAudioMaxBytes)}`);
  for (const [batch, bytes] of Object.entries(report.sourceBatchBytes)) {
    console.log(`  Source batch ${batch}: ${formatBytes(bytes)} / ${formatBytes(report.budgets.sourceBatchMaxBytes)}`);
  }
  for (const family of report.releaseBlockedFamilies) {
    const dependencyLabel = family.externalDependencyCount === 1
      ? 'external dependency'
      : 'external dependencies';
    console.log(
      `  RELEASE BLOCKED ${family.id}: ${family.assetCount} local files / `
      + `${family.externalDependencyCount} ${dependencyLabel} / ${formatBytes(family.bytes)} — ${family.reason}`,
    );
  }
  if (report.distBytes === null) {
    console.log('  Production dist: skipped (pass --dist after npm run build)');
  } else {
    console.log(`  Production dist: ${formatBytes(report.distBytes)} / ${formatBytes(report.budgets.distMaxBytes)}`);
  }
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) {
  const argumentsSet = new Set(process.argv.slice(2));
  const knownArguments = new Set(['--dist', '--release']);
  const unknownArguments = [...argumentsSet].filter((argument) => !knownArguments.has(argument));
  if (unknownArguments.length > 0) {
    console.error(`Unknown argument(s): ${unknownArguments.join(', ')}`);
    process.exitCode = 2;
  } else {
    try {
      const report = await runAssetAudit({
        requireDist: argumentsSet.has('--dist'),
        releaseMode: argumentsSet.has('--release'),
      });
      printReport(report);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
