import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FRIENDSIES_CANONICAL_ASSET_URL_PREFIX,
  FRIENDSIES_PROJECT_FAMILY_ID,
  FRIENDSIES_REMOTE_PLAYER_DEPENDENCY_ID,
  RELEASE_APPROVED_RUNTIME_STATUSES,
  runAssetAudit,
  validateExternalRuntimeDependencies,
  validateFriendsiesProjectAssetAuthorization,
} from '../scripts/check-asset-budgets.mjs';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('asset manifest covers runtime media and stays within pilot budgets', async () => {
  const report = await runAssetAudit({ rootDir: REPOSITORY_ROOT });

  assert.equal(report.runtimeAssetCount, 27);
  assert.equal(report.sourceAssetCount, 0);
  assert.equal(report.externalRuntimeDependencyCount, 1);
  assert.equal(report.activeTownBytes, 970_068);
  assert.equal(report.pilotArrivalBytes, 326_584);
  assert.deepEqual(report.characterBytes, {
    '0001': 295_916,
    '6602': 888_847,
    '8914': 1_609_420,
  });
  assert.equal(report.cc0RuntimeBytes, 0);
  assert.equal(report.compressedAudioBytes, 0);
  assert.deepEqual(report.sourceBatchBytes, {});
  assert.equal(report.releaseReady, false);
  assert.deepEqual(
    report.releaseBlockedFamilies.map((family) => ({
      id: family.id,
      status: family.status,
      assetCount: family.assetCount,
      bytes: family.bytes,
      externalDependencyCount: family.externalDependencyCount,
    })),
    [{
      id: 'friendsies-story-actions-v1',
      status: 'project-use-recorded',
      assetCount: 6,
      bytes: 270_232,
      externalDependencyCount: 0,
    }],
  );
  assert.match(
    report.releaseBlockedFamilies[0].reason,
    /exact-file bundled Thornvale publication authorization/,
  );
});

test('fRiENDSiES uses one standing project authorization without per-use gates', async () => {
  const manifest = JSON.parse(await readFile(
    resolve(REPOSITORY_ROOT, 'assets-src/asset-manifest.json'),
    'utf8',
  ));

  assert.deepEqual(RELEASE_APPROVED_RUNTIME_STATUSES, [
    'project-authored',
    'cc0-1.0-verified',
    'project-release-authorized',
  ]);
  assert.equal(Object.hasOwn(manifest.policy, 'allowedRuntimeStatuses'), false);
  const family = manifest.families[FRIENDSIES_PROJECT_FAMILY_ID];
  assert.equal(family.status, 'project-release-authorized');
  assert.equal(family.releaseBlocked, false);
  assert.equal(family.rawSourceRedistribution, false);
  assert.equal(family.provenance, 'docs/decisions/0004-friendsies-project-wide-authorization.md');
  assert.match(family.licenseOrPermission, /standing project-wide authorization/);
  assert.match(family.licenseOrPermission, /without per-asset, per-token, per-role, per-context/);
  assert.match(family.runtimeDistributionScope, /any integrated Thornvale/);
  assert.match(family.runtimeDistributionScope, /standalone asset packs/);
  assert.equal(Object.hasOwn(family, 'releaseBlockReason'), false);

  for (const retiredFamilyId of [
    'friendsies-0001',
    'friendsies-6602',
    'friendsies-8914',
    'friendsies-remote-player-streaming',
  ]) {
    assert.equal(Object.hasOwn(manifest.families, retiredFamilyId), false);
  }

  const canonicalAssets = manifest.assets.filter((asset) => (
    asset.source?.url?.startsWith(FRIENDSIES_CANONICAL_ASSET_URL_PREFIX)
  ));
  assert.equal(canonicalAssets.length, 14);
  assert.ok(canonicalAssets.every((asset) => asset.family === FRIENDSIES_PROJECT_FAMILY_ID));

  // Mixamo contributes separate upstream motion rights, so animation derivatives
  // deliberately remain outside the native fRiENDSiES umbrella.
  assert.equal(manifest.families['friendsies-animations'].status, 'project-release-authorized');
  assert.match(manifest.families['friendsies-animations'].licenseOrPermission, /Mixamo/);
});

test('release audit rejects only the development-only Story Actions family', async () => {
  const developmentReport = await runAssetAudit({ rootDir: REPOSITORY_ROOT });
  assert.deepEqual(
    developmentReport.releaseBlockedFamilies.map((family) => family.id),
    ['friendsies-story-actions-v1'],
  );

  await assert.rejects(
    runAssetAudit({ rootDir: REPOSITORY_ROOT, releaseMode: true }),
    /release-blocked runtime family friendsies-story-actions-v1:.*exact-file bundled Thornvale publication authorization/,
  );
});

test('fRiENDSiES authorization follows canonical source identity, never runtime context', () => {
  const canonicalAsset = {
    id: 'friendsies-hand-axe',
    family: FRIENDSIES_PROJECT_FAMILY_ID,
    runtimeContexts: [
      'character:hand',
      'equipment:backpiece-stow',
      'ui:quick-action-radial',
      'environment:woodcutting-station',
    ],
    source: {
      url: `${FRIENDSIES_CANONICAL_ASSET_URL_PREFIX}example-axe.glb`,
    },
  };
  assert.deepEqual(validateFriendsiesProjectAssetAuthorization(canonicalAsset), []);

  const wronglyNarrowed = structuredClone(canonicalAsset);
  wronglyNarrowed.family = 'friendsies-hand-items';
  assert.match(
    validateFriendsiesProjectAssetAuthorization(wronglyNarrowed).join('\n'),
    /must inherit standing authorization from family friendsies-project/,
  );

  const unrelatedAsset = structuredClone(canonicalAsset);
  unrelatedAsset.source.url = 'https://example.com/unrelated-axe.glb';
  assert.match(
    validateFriendsiesProjectAssetAuthorization(unrelatedAsset).join('\n'),
    /claims friendsies-project without a canonical fRiENDSiES source URL/,
  );
});

test('remote player streaming has a pinned, bounded, project-authorized manifest contract', async () => {
  const manifest = JSON.parse(await readFile(
    resolve(REPOSITORY_ROOT, 'assets-src/asset-manifest.json'),
    'utf8',
  ));
  const validation = validateExternalRuntimeDependencies(manifest);

  assert.deepEqual(validation.errors, []);
  assert.deepEqual(validation.releaseBlockedFamilyIds, []);
  assert.deepEqual(validation.dependencies, [
    {
      id: 'friendsies-remote-player-streaming',
      family: 'friendsies-project',
      metadataCatalog: {
        url: 'https://gist.githubusercontent.com/IntergalacticPizzaLord/a7b0eeac98041a483d715c8320ccf660/raw/ce7d37a94c33c63e2b50d5922e0711e72494c8dd/fRiENDSiES',
        sha256: '9f1c4e1cf8d848bd2ceaff7cde48c4ecf60a4b1d0afe273e7a5c5b68c2aee3ef',
        bytes: 18_489_230,
      },
      allowedAssetOrigins: ['https://storage.googleapis.com'],
      allowedAssetUrlPrefixes: [FRIENDSIES_CANONICAL_ASSET_URL_PREFIX],
      tokenScope: {
        type: 'inclusive-range',
        minimum: 1,
        maximum: 10_000,
      },
      runtimeUse: "Shareable player links fetch one ranged entry from the pinned catalog, then stream the selected token's component assets; bundled #6602 and #8914 remain failure fallbacks. Runtime use is engineering metadata and does not narrow the standing project authorization.",
    },
  ]);
});

test('external runtime dependency validation rejects missing families, unpinned catalogs, and non-origin hosts', async () => {
  const manifest = JSON.parse(await readFile(
    resolve(REPOSITORY_ROOT, 'assets-src/asset-manifest.json'),
    'utf8',
  ));

  const missingFamily = structuredClone(manifest);
  missingFamily.externalRuntimeDependencies[0].family = 'missing-family';
  assert.match(
    validateExternalRuntimeDependencies(missingFamily).errors.join('\n'),
    /references unknown family: missing-family/,
  );

  const unpinnedCatalog = structuredClone(manifest);
  delete unpinnedCatalog.externalRuntimeDependencies[0].metadataCatalog.sha256;
  assert.match(
    validateExternalRuntimeDependencies(unpinnedCatalog).errors.join('\n'),
    /metadataCatalog\.sha256 must be a lowercase SHA-256 digest/,
  );

  const pathInsteadOfOrigin = structuredClone(manifest);
  pathInsteadOfOrigin.externalRuntimeDependencies[0].allowedAssetOrigins = [
    'https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/',
  ];
  assert.match(
    validateExternalRuntimeDependencies(pathInsteadOfOrigin).errors.join('\n'),
    /allowed asset origin must contain only an origin/,
  );

  const missingContract = structuredClone(manifest);
  delete missingContract.externalRuntimeDependencies;
  assert.deepEqual(validateExternalRuntimeDependencies(missingContract).errors, [
    'externalRuntimeDependencies must be an array',
  ]);

  const duplicatedAuthorizationReason = structuredClone(manifest);
  duplicatedAuthorizationReason.externalRuntimeDependencies[0].reason = 'A narrower permission claim.';
  assert.match(
    validateExternalRuntimeDependencies(duplicatedAuthorizationReason).errors.join('\n'),
    /must not duplicate authorization prose in reason/,
  );

  const contradictoryUnblockedFamily = structuredClone(manifest);
  contradictoryUnblockedFamily.families[FRIENDSIES_PROJECT_FAMILY_ID].releaseBlockReason = 'Still blocked.';
  assert.match(
    validateExternalRuntimeDependencies(contradictoryUnblockedFamily).errors.join('\n'),
    /unblocked family friendsies-project cannot declare releaseBlockReason/,
  );

  const narrowedFamily = structuredClone(manifest);
  narrowedFamily.externalRuntimeDependencies[0].family = 'friendsies-animations';
  assert.match(
    validateExternalRuntimeDependencies(narrowedFamily).errors.join('\n'),
    new RegExp(`${FRIENDSIES_REMOTE_PLAYER_DEPENDENCY_ID} must inherit standing authorization from family ${FRIENDSIES_PROJECT_FAMILY_ID}`),
  );

  const missingPrefix = structuredClone(manifest);
  delete missingPrefix.externalRuntimeDependencies[0].allowedAssetUrlPrefixes;
  assert.match(
    validateExternalRuntimeDependencies(missingPrefix).errors.join('\n'),
    /allowedAssetUrlPrefixes must be a non-empty array/,
  );
});

test('village runtime assets hash the deterministic generator, not generated Blender state', async () => {
  const manifest = JSON.parse(await readFile(
    resolve(REPOSITORY_ROOT, 'assets-src/asset-manifest.json'),
    'utf8',
  ));
  const byId = Object.fromEntries(manifest.assets.map((asset) => [asset.id, asset]));

  assert.equal(byId['thornvale-village-dressing'].source.path, 'scripts/build-village-dressing.py');
  assert.equal(byId['thornvale-arrival-plaza-v1'].source.path, 'scripts/build-village-dressing.py');
  assert.doesNotMatch(byId['thornvale-village-dressing'].source.path, /\.blend$/);
  assert.doesNotMatch(byId['thornvale-arrival-plaza-v1'].source.path, /\.blend$/);
});
