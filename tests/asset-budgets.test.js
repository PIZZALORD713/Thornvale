import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ANIMATION_AUTHORIZATION_FAMILY_ID,
  ANIMATION_AUTHORIZATION_PROVENANCE_PATH,
  ANIMATION_UPSTREAM_RIGHTS_STATUSES,
  FRIENDSIES_CANONICAL_ASSET_URL_PREFIX,
  FRIENDSIES_PROJECT_FAMILY_ID,
  FRIENDSIES_REMOTE_PLAYER_DEPENDENCY_ID,
  RELEASE_APPROVED_RUNTIME_STATUSES,
  runAssetAudit,
  validateExternalRuntimeDependencies,
  validateFamilyContract,
  validateFriendsiesProjectAssetAuthorization,
  validateRuntimeAnimationFamilyAuthorization,
} from '../scripts/check-asset-budgets.mjs';

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('asset manifest covers runtime media and stays within pilot budgets', async () => {
  const report = await runAssetAudit({ rootDir: REPOSITORY_ROOT });

  assert.equal(report.runtimeAssetCount, 28);
  assert.equal(report.sourceAssetCount, 1);
  assert.equal(report.externalRuntimeDependencyCount, 1);
  assert.equal(report.activeTownBytes, 1_001_492);
  assert.equal(report.pilotArrivalBytes, 326_584);
  assert.deepEqual(report.characterBytes, {
    '0001': 295_916,
    '6602': 888_847,
    '8914': 1_609_420,
  });
  assert.equal(report.cc0RuntimeBytes, 0);
  assert.equal(report.compressedAudioBytes, 0);
  assert.deepEqual(report.sourceBatchBytes, {
    'pizza-lab-wayfinder-v1': 114_616,
  });
  assert.equal(report.releaseReady, true);
  assert.deepEqual(report.releaseBlockedFamilies, []);
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

  // Mixamo contributes separate upstream motion rights, while publication
  // authority comes from the animation umbrella rather than fRiENDSiES.
  assert.equal(manifest.families['friendsies-animations'].status, 'project-release-authorized');
  assert.match(manifest.families['friendsies-animations'].licenseOrPermission, /Mixamo/);
  assert.equal(
    manifest.families['friendsies-animations'].authorizationFamily,
    ANIMATION_AUTHORIZATION_FAMILY_ID,
  );
});

test('all runtime animations inherit one standing project authorization', async () => {
  const manifest = JSON.parse(await readFile(
    resolve(REPOSITORY_ROOT, 'assets-src/asset-manifest.json'),
    'utf8',
  ));
  const authorizationFamily = manifest.families[ANIMATION_AUTHORIZATION_FAMILY_ID];

  assert.equal(ANIMATION_AUTHORIZATION_FAMILY_ID, 'thornvale-animation-project');
  assert.deepEqual(ANIMATION_UPSTREAM_RIGHTS_STATUSES, [
    'project-authored',
    'verified-for-game-use',
  ]);
  assert.equal(authorizationFamily.status, 'project-release-authorized');
  assert.equal(authorizationFamily.assetKind, 'animation');
  assert.equal(authorizationFamily.releaseBlocked, false);
  assert.equal(authorizationFamily.rawSourceRedistribution, false);
  assert.equal(authorizationFamily.provenance, ANIMATION_AUTHORIZATION_PROVENANCE_PATH);
  assert.deepEqual(authorizationFamily.standingAuthorization, {
    assetKind: 'animation',
    coverage: 'present-and-future',
    integratedProject: 'Thornvale',
    itemApprovalRequired: false,
    upstreamRightsRequired: true,
  });
  assert.match(authorizationFamily.licenseOrPermission, /all present and future animation assets/);
  assert.match(authorizationFamily.licenseOrPermission, /controls or may lawfully use/);
  assert.match(authorizationFamily.runtimeDistributionScope, /verified upstream rights/);

  const validation = validateRuntimeAnimationFamilyAuthorization(manifest);
  assert.deepEqual(validation.errors, []);
  assert.deepEqual(validation.animationFamilyIds, [
    'friendsies-animations',
    'friendsies-story-actions-v1',
  ]);

  for (const familyId of validation.animationFamilyIds) {
    const family = manifest.families[familyId];
    assert.equal(family.assetKind, 'animation');
    assert.equal(family.authorizationFamily, ANIMATION_AUTHORIZATION_FAMILY_ID);
    assert.equal(family.upstreamRights.status, 'verified-for-game-use');
    assert.ok(family.upstreamRights.evidence.length > 0);
    assert.ok(family.fallbackContract.length > 0);
    assert.ok(family.qaEvidence.length > 0);
    assert.doesNotMatch(family.licenseOrPermission, /six exact|exact-file|ship PR #13/i);
    assert.doesNotMatch(family.runtimeDistributionScope, /six exact|exact-file|ship PR #13/i);
  }

  const report = await runAssetAudit({ rootDir: REPOSITORY_ROOT, releaseMode: true });
  assert.equal(report.releaseReady, true);
  assert.deepEqual(report.releaseBlockedFamilies, []);
});

test('animation audit rejects narrowed owner approval and unsafe upstream sources', async () => {
  const manifest = JSON.parse(await readFile(
    resolve(REPOSITORY_ROOT, 'assets-src/asset-manifest.json'),
    'utf8',
  ));

  const missingInheritance = structuredClone(manifest);
  delete missingInheritance.families['friendsies-story-actions-v1'].authorizationFamily;
  assert.match(
    validateRuntimeAnimationFamilyAuthorization(missingInheritance).errors.join('\n'),
    new RegExp(`friendsies-story-actions-v1 must inherit standing authorization from family ${ANIMATION_AUTHORIZATION_FAMILY_ID}`),
  );

  for (const unsafeStatus of ['unknown', 'prohibited']) {
    const unsafeUpstream = structuredClone(manifest);
    unsafeUpstream.families['friendsies-story-actions-v1'].upstreamRights.status = unsafeStatus;
    assert.match(
      validateRuntimeAnimationFamilyAuthorization(unsafeUpstream).errors.join('\n'),
      /unknown or prohibited upstream sources cannot ship/,
    );
  }

  for (const releaseBlockReason of [
    'Record project owner approval for this animation clip.',
    'Record exact-file bundled publication authorization before release.',
  ]) {
    const narrowedApproval = structuredClone(manifest);
    Object.assign(narrowedApproval.families['friendsies-story-actions-v1'], {
      status: 'project-use-recorded',
      releaseBlocked: true,
      releaseBlockCategory: 'qa',
      releaseBlockReason,
    });
    assert.match(
      validateRuntimeAnimationFamilyAuthorization(narrowedApproval).errors.join('\n'),
      new RegExp(`cannot require item-level project-owner approval; it inherits ${ANIMATION_AUTHORIZATION_FAMILY_ID}`),
    );
  }

  const narrowedFamilyRecord = structuredClone(manifest);
  narrowedFamilyRecord.families['friendsies-animations'].licenseOrPermission =
    'The project owner authorized these exact animation files for publication.';
  assert.match(
    validateRuntimeAnimationFamilyAuthorization(narrowedFamilyRecord).errors.join('\n'),
    new RegExp(`friendsies-animations licenseOrPermission must inherit ${ANIMATION_AUTHORIZATION_FAMILY_ID}`),
  );

  const missingFallback = structuredClone(manifest);
  delete missingFallback.families['friendsies-animations'].fallbackContract;
  assert.match(
    validateRuntimeAnimationFamilyAuthorization(missingFallback).errors.join('\n'),
    /friendsies-animations must declare fallbackContract/,
  );

  const missingQa = structuredClone(manifest);
  missingQa.families['friendsies-animations'].qaEvidence = [];
  assert.match(
    validateRuntimeAnimationFamilyAuthorization(missingQa).errors.join('\n'),
    /friendsies-animations qaEvidence must be a non-empty array/,
  );

  const mislabeledAnimations = structuredClone(manifest);
  for (const asset of mislabeledAnimations.assets) {
    if (asset.kind === 'animation') asset.kind = 'model';
  }
  assert.match(
    validateRuntimeAnimationFamilyAuthorization(mislabeledAnimations).errors.join('\n'),
    /runtime animation asset .* kind must be animation/,
  );

  const qaBlockedButAuthorized = {
    ...manifest.families['friendsies-story-actions-v1'],
    releaseBlocked: true,
    releaseBlockCategory: 'qa',
    releaseBlockReason: 'Complete the recorded browser acceptance matrix.',
  };
  assert.deepEqual(
    validateFamilyContract('friendsies-story-actions-v1', qaBlockedButAuthorized, { runtime: true }),
    [],
    'project authorization must remain recorded while a non-permission release gate is open',
  );
  const qaBlockedManifest = structuredClone(manifest);
  qaBlockedManifest.families['friendsies-story-actions-v1'] = qaBlockedButAuthorized;
  assert.deepEqual(
    validateRuntimeAnimationFamilyAuthorization(qaBlockedManifest).errors,
    [],
    'a categorized QA blocker is valid and must not reopen owner authorization',
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
