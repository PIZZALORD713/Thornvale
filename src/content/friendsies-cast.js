/**
 * Curated fRiENDSiES cast bundled with Thornvale.
 *
 * This is intentionally a small runtime manifest rather than a copy of the
 * full collection index. Every trait retains its canonical source token so a
 * future Thornvale-authored composition cannot be mistaken for an original
 * collection token.
 */

export const FRIENDSIES_LICENSE_STATUS = Object.freeze({
  PROJECT_RELEASE_AUTHORIZED: 'project-release-authorized',
});

export const FRIENDSIES_REDISTRIBUTION_STATUS = Object.freeze({
  THORNVALE_BUNDLED_ONLY: 'thornvale-bundled-only',
});

export const DEFAULT_PLAYER_FRIENDSIES_TOKEN_ID = 6602;
export const PLAYER_FRIENDSIES_FALLBACK_TOKEN_IDS = Object.freeze([6602, 8914]);

const PROJECT_RELEASE_AUTHORIZED = FRIENDSIES_LICENSE_STATUS.PROJECT_RELEASE_AUTHORIZED;
const THORNVALE_BUNDLED_ONLY = FRIENDSIES_REDISTRIBUTION_STATUS.THORNVALE_BUNDLED_ONLY;
const RUNTIME_DISTRIBUTION_SCOPE = 'bundled-thornvale-game-builds-only';
const SOFT_WHITE_HEAD_EMISSION = Object.freeze({
  color: 0xffffff,
  emissiveIntensity: 0.22,
  softWhite: true,
});

// Streamed collection metadata has no Thornvale presentation fields. Keep the
// exception list exact and intentionally tiny until each additional head is
// visually reviewed; broad name matching washes authored colors.
export const FRIENDSIES_HEAD_EMISSION_EXCEPTIONS = Object.freeze({
  'Grey Cloud': SOFT_WHITE_HEAD_EMISSION,
});

export function getFriendsiesHeadEmissionException(value) {
  return FRIENDSIES_HEAD_EMISSION_EXCEPTIONS[String(value ?? '')] || null;
}

function curatedTrait(sourceTokenId, traitType, value, assetUrl, options = {}) {
  return {
    trait_type: traitType,
    value,
    asset_url: assetUrl,
    sourceTokenId,
    licenseStatus: PROJECT_RELEASE_AUTHORIZED,
    redistributionStatus: THORNVALE_BUNDLED_ONLY,
    runtimeDistributionScope: RUNTIME_DISTRIBUTION_SCOPE,
    rawSourceRedistribution: false,
    releaseBlocked: false,
    ...options,
  };
}

function castEntry(tokenId, role, storyUse, attributes) {
  return {
    token_id: tokenId,
    role,
    storyUse,
    bundledCharacter: attributes.some((trait) => (
      trait.trait_type === 'body' && Boolean(trait.asset_url)
    )),
    licenseStatus: PROJECT_RELEASE_AUTHORIZED,
    redistributionStatus: THORNVALE_BUNDLED_ONLY,
    runtimeDistributionScope: RUNTIME_DISTRIBUTION_SCOPE,
    rawSourceRedistribution: false,
    releaseBlocked: false,
    source: {
      collection: 'fRiENDSiES',
      tokenId,
      canonicalToken: true,
      provenancePath: `/friendsies/${String(tokenId).padStart(4, '0')}/PROVENANCE.md`,
    },
    attributes,
  };
}

export const CURATED_FRIENDSIES_CAST = deepFreeze({
  1: castEntry(1, 'trait-echo-source', [
    'welcome-gift',
    'performed-kindness',
  ], [
    curatedTrait(1, 'hand', 'Flower White', '/friendsies/0001/hand-flower-white.glb', {
      storyUse: ['arrival-gift', 'performed-kindness'],
      presentation: {
        storySignal: 'welcome-flower',
      },
    }),
  ]),
  6602: castEntry(6602, 'default-player', [
    'arrival',
    'player-avatar',
  ], [
    curatedTrait(6602, 'backpiece', 'Ghostin', '/friendsies/6602/backpiece-ghostin.glb'),
    curatedTrait(6602, 'body', 'Pop', '/friendsies/6602/body.glb'),
    curatedTrait(6602, 'face', 'Romeo', '/friendsies/6602/face-romeo.png'),
    curatedTrait(6602, 'hand', 'Staffv', '/friendsies/6602/hand-staffv.glb'),
    curatedTrait(6602, 'head', 'Deli', '/friendsies/6602/head-deli.glb'),
    curatedTrait(6602, 'shoe', 'High Boots Red', '/friendsies/6602/shoes-high-boots-red.glb'),
    curatedTrait(6602, 'sprout', 'Totem', '/friendsies/6602/sprout-totem.glb'),
  ]),
  8914: castEntry(8914, 'steward-lumen', [
    'opening-guide',
    'nighttime-authority',
    'civic-status',
  ], [
    curatedTrait(8914, 'backpiece', 'Pip', '/friendsies/8914/backpiece-pip.glb', {
      storyUse: ['companion', 'civic-status'],
      presentation: {
        storySignal: 'steward-companion',
      },
    }),
    curatedTrait(8914, 'body', 'Frosted Cloud Boy', '/friendsies/8914/body.glb'),
    curatedTrait(8914, 'hand', 'Torch', '/friendsies/8914/hand-torch.glb', {
      storyUse: ['guidance', 'nighttime-authority'],
      presentation: {
        storySignal: 'steward-guidance',
        handheldGlow: {
          color: 0xffb35c,
          emissiveIntensity: 0.48,
          lightIntensity: 0.34,
          lightDistance: 2.6,
          lightDecay: 2,
          flameOffsetFromTop: 0.12,
        },
      },
    }),
    curatedTrait(8914, 'head', 'White Elephant', '/friendsies/8914/head-white-elephant.glb', {
      presentation: {
        headEmission: SOFT_WHITE_HEAD_EMISSION,
      },
    }),
    curatedTrait(8914, 'shoe', 'Wrappers Gold', '/friendsies/8914/shoes-wrappers-gold.glb'),
    curatedTrait(8914, 'sprout', 'Crown Up', '/friendsies/8914/sprout-crown-up.glb', {
      storyUse: ['civic-status'],
      presentation: {
        storySignal: 'steward-office',
      },
    }),
  ]),
});

export function getCuratedFriendsiesEntry(tokenId) {
  return CURATED_FRIENDSIES_CAST[Number(tokenId)] || null;
}

export function hasCuratedFriendsiesEntry(tokenId) {
  return Boolean(getCuratedFriendsiesEntry(tokenId));
}

export function hasCuratedFriendsiesCharacter(tokenId) {
  return Boolean(getCuratedFriendsiesEntry(tokenId)?.bundledCharacter);
}

export function getCuratedFriendsiesTrait(tokenId, traitType, value) {
  const entry = getCuratedFriendsiesEntry(tokenId);
  if (!entry) return null;
  return entry.attributes.find((trait) => (
    trait.trait_type === traitType
    && (value === undefined || trait.value === value)
  )) || null;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}
