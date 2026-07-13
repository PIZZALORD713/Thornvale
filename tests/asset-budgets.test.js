import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RELEASE_APPROVED_RUNTIME_STATUSES,
  runAssetAudit,
  validateExternalRuntimeDependencies,
} from '../scripts/check-asset-budgets.mjs';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('asset manifest covers runtime media and stays within pilot budgets', async () => {
  const report = await runAssetAudit({ rootDir: REPOSITORY_ROOT });

  assert.equal(report.runtimeAssetCount, 21);
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
  assert.equal(report.releaseReady, true);
  assert.deepEqual(report.releaseBlockedFamilies, []);
});

test('release approval cannot be extended by the manifest', async () => {
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
  assert.deepEqual(manifest.families['friendsies-animations'], {
    creator: 'PIZZALORD713 / fRiENDSiES',
    status: 'project-release-authorized',
    licenseOrPermission: 'The source repository and Thornvale project owner authorized these exact animation-only runtime derivatives for publication in Thornvale builds; Adobe permits royalty-free video-game use of Mixamo-sourced motion',
    sourcePage: 'https://github.com/PIZZALORD713/animation_collection2/tree/f8286ef2c5421d54115afdafdac33f206533ac25',
    sourceRetrievedOn: '2026-07-12',
    provenance: 'public/animations/PROVENANCE.md',
    runtimeDistributionScope: 'Bundled distribution as part of Thornvale game builds; no standalone asset-pack or raw-source redistribution',
    rawSourceRedistribution: false,
    releaseBlocked: false,
  });

  for (const familyId of ['friendsies-0001', 'friendsies-6602', 'friendsies-8914']) {
    const family = manifest.families[familyId];
    assert.equal(family.status, 'project-release-authorized');
    assert.equal(family.releaseBlocked, false);
    assert.equal(family.rawSourceRedistribution, false);
    assert.match(family.runtimeDistributionScope, /Thornvale game builds/);
    assert.equal(Object.hasOwn(family, 'releaseBlockReason'), false);
  }

  assert.deepEqual(manifest.families['friendsies-remote-player-streaming'], {
    creator: 'fRiENDSiES',
    status: 'project-release-authorized',
    licenseOrPermission: "On 2026-07-12, the Thornvale project owner authorized published Thornvale builds to fetch the revision-pinned catalog for token IDs 1..10000 and stream, render, and assemble the selected token's components from https://storage.googleapis.com as an integrated in-game player avatar only",
    sourcePage: 'https://gist.githubusercontent.com/IntergalacticPizzaLord/a7b0eeac98041a483d715c8320ccf660/raw/ce7d37a94c33c63e2b50d5922e0711e72494c8dd/fRiENDSiES',
    sourceRetrievedOn: '2026-07-12',
    provenance: 'docs/decisions/0003-external-runtime-asset-dependencies.md',
    runtimeDistributionScope: "Published Thornvale builds may fetch only the revision-pinned catalog for token IDs 1..10000 and stream, render, and assemble the selected token's components only from https://storage.googleapis.com as an integrated in-game player avatar; no full-collection bundling, canonical or raw copying, mirroring, standalone asset or character packs, environmental reuse or adaptation, sublicensing, unrelated-origin delivery, or reuse outside Thornvale",
    rawSourceRedistribution: false,
    releaseBlocked: false,
  });
});

test('release audit accepts local families and bounded remote player streaming', async () => {
  const report = await runAssetAudit({ rootDir: REPOSITORY_ROOT, releaseMode: true });
  assert.equal(report.releaseReady, true);
  assert.deepEqual(report.releaseBlockedFamilies, []);
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
      family: 'friendsies-remote-player-streaming',
      metadataCatalog: {
        url: 'https://gist.githubusercontent.com/IntergalacticPizzaLord/a7b0eeac98041a483d715c8320ccf660/raw/ce7d37a94c33c63e2b50d5922e0711e72494c8dd/fRiENDSiES',
        sha256: '9f1c4e1cf8d848bd2ceaff7cde48c4ecf60a4b1d0afe273e7a5c5b68c2aee3ef',
        bytes: 18_489_230,
      },
      allowedAssetOrigins: ['https://storage.googleapis.com'],
      tokenScope: {
        type: 'inclusive-range',
        minimum: 1,
        maximum: 10_000,
      },
      runtimeUse: "Shareable player links fetch one ranged entry from the pinned catalog, then stream the selected token's component assets; bundled #6602 and #8914 remain failure fallbacks.",
      reason: "On 2026-07-12, the Thornvale project owner authorized published Thornvale builds to fetch the revision-pinned catalog for token IDs 1..10000 and stream, render, and assemble the selected token's components from https://storage.googleapis.com as an integrated in-game player avatar only",
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

  const staleBlockerReason = structuredClone(manifest);
  staleBlockerReason.externalRuntimeDependencies[0].reason = 'Permission is not recorded.';
  assert.match(
    validateExternalRuntimeDependencies(staleBlockerReason).errors.join('\n'),
    /reason must match family friendsies-remote-player-streaming licenseOrPermission/,
  );

  const contradictoryUnblockedFamily = structuredClone(manifest);
  contradictoryUnblockedFamily.families['friendsies-remote-player-streaming'].releaseBlockReason = 'Still blocked.';
  assert.match(
    validateExternalRuntimeDependencies(contradictoryUnblockedFamily).errors.join('\n'),
    /unblocked family friendsies-remote-player-streaming cannot declare releaseBlockReason/,
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

test('Trait Echo v1 reuses only the three manifested character traits', async () => {
  const manifest = JSON.parse(await readFile(
    resolve(REPOSITORY_ROOT, 'assets-src/asset-manifest.json'),
    'utf8',
  ));
  const byId = Object.fromEntries(manifest.assets.map((asset) => [asset.id, asset]));

  assert.ok(byId['friendsies-0001-hand-flower-white'].runtimeContexts.includes(
    'environment:trait-echo-v1:welcome-flower',
  ));
  assert.ok(byId['friendsies-8914-hand-torch'].runtimeContexts.includes(
    'environment:trait-echo-v1:civic-torch',
  ));
  assert.ok(byId['friendsies-8914-sprout-crown-up'].runtimeContexts.includes(
    'environment:trait-echo-v1:civic-crown',
  ));

  const traitEchoContexts = manifest.assets.flatMap((asset) => (
    asset.runtimeContexts?.filter((context) => context.startsWith('environment:trait-echo-v1:'))
    || []
  ));
  assert.deepEqual(traitEchoContexts.sort(), [
    'environment:trait-echo-v1:civic-crown',
    'environment:trait-echo-v1:civic-torch',
    'environment:trait-echo-v1:welcome-flower',
  ]);
});
