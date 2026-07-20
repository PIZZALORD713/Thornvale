import PIZZA_LAB_WAYFINDER_V1 from '../content/generated/pizza-lab-wayfinder-v1.json' with { type: 'json' };

export const ASSET_VARIANTS = Object.freeze({
  BASELINE: 'baseline',
  PILOT: 'pilot',
});

export const DEFAULT_ASSET_VARIANT = ASSET_VARIANTS.PILOT;

export const TRAIT_ECHO_VARIANTS = Object.freeze({
  OFF: 'off',
  V1: 'v1',
});

export const DEFAULT_TRAIT_ECHO_VARIANT = TRAIT_ECHO_VARIANTS.V1;

export const TOWN_ASSET_PATHS = Object.freeze({
  cottages: '/town/cottages/thornvale-cottages.glb',
  villageDressing: '/village/thornvale-village-dressing.glb',
  wayfinderPilot: Object.freeze({
    version: PIZZA_LAB_WAYFINDER_V1.version,
    url: PIZZA_LAB_WAYFINDER_V1.url,
    root: PIZZA_LAB_WAYFINDER_V1.root,
    sha256: PIZZA_LAB_WAYFINDER_V1.sha256,
  }),
  arrivalPlazaPilot: Object.freeze({
    version: '1.0.0',
    url: '/village/pilot/v1/thornvale-arrival-plaza.glb',
    roots: Object.freeze({
      welcomeGate: 'WelcomeGate',
      ledger: 'CommunityLedger',
      bell: 'TownBell',
    }),
  }),
});

export function normalizeAssetVariant(value) {
  if (value === ASSET_VARIANTS.PILOT || value === ASSET_VARIANTS.BASELINE) return value;
  if (value === null || value === undefined || value === '') return DEFAULT_ASSET_VARIANT;
  return ASSET_VARIANTS.BASELINE;
}

/**
 * Resolve the reversible environment-art pilot from a URL query string.
 * A missing selector uses the intended authored treatment. Unknown values
 * deliberately fall back to the known-good procedural baseline.
 */
export function resolveAssetVariant(search) {
  const browserSearch = typeof window !== 'undefined' ? window.location?.search : '';
  const params = new URLSearchParams(search ?? browserSearch ?? '');
  return normalizeAssetVariant(params.get('assets'));
}

export function normalizeTraitEchoVariant(value) {
  if (value === TRAIT_ECHO_VARIANTS.V1 || value === TRAIT_ECHO_VARIANTS.OFF) return value;
  if (value === null || value === undefined || value === '') return DEFAULT_TRAIT_ECHO_VARIANT;
  return TRAIT_ECHO_VARIANTS.OFF;
}

/**
 * Resolve the independent fRiENDSiES environment-trait pilot.
 *
 * Trait echoes are deliberately separate from the authored-landmark selector:
 * either landmark presentation can be compared with the same trait treatment.
 * Missing values use v1; explicit `off` and unknown values retain rollback.
 */
export function resolveTraitEchoVariant(search) {
  const browserSearch = typeof window !== 'undefined' ? window.location?.search : '';
  const params = new URLSearchParams(search ?? browserSearch ?? '');
  return normalizeTraitEchoVariant(params.get('traits'));
}
