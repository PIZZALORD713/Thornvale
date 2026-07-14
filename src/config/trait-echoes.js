function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

/**
 * fRiENDSiES Trait Echo v1
 *
 * Sprouts communicate identity or office. Hand items communicate intent. The
 * first runtime slice deliberately uses only traits already bundled for the
 * player and Steward so evaluation cannot silently expand the asset intake.
 */
export const TRAIT_ECHO_V1 = deepFreeze({
  id: 'friendsies-trait-echo-v1',
  version: '1.0.0',
  budgets: {
    maximumDisplayedTriangles: 45_000,
    maximumDrawCalls: 3,
    expectedPlacements: 7,
  },
  civicMount: {
    baseColor: 0xffffff,
    socketColors: {
      offering: 0x5f6848,
      sconce: 0x7a4538,
      crest: 0xa88b52,
    },
  },
  families: [
    {
      id: 'welcome-flower',
      role: 'welcome-and-performed-kindness',
      trait: {
        sourceTokenId: 1,
        traitType: 'hand',
        value: 'Flower White',
      },
      sourceTriangles: 4_812,
      presentation: {
        motion: 'planted-sway',
        emissiveColor: 0xffe8f1,
      },
      placements: [
        {
          id: 'arrival-private-flower',
          cluster: 'spawn',
          socket: 'offering',
          witnessRole: 'private',
          position: [-1.45, 0.02, 13.10],
          height: 0.72,
          yaw: 0.28,
        },
        {
          id: 'ledger-witness-flower-west',
          cluster: 'ledger',
          socket: 'offering',
          pairId: 'ledger-witness',
          pairRole: 'first',
          position: [-3.00, 0.02, 3.55],
          height: 0.72,
          yaw: 0.14,
        },
        {
          id: 'ledger-witness-flower-east',
          cluster: 'ledger',
          socket: 'offering',
          pairId: 'ledger-witness',
          pairRole: 'second',
          position: [-1.00, 0.02, 3.55],
          height: 0.72,
          yaw: -0.14,
        },
      ],
    },
    {
      id: 'civic-torch',
      role: 'guidance-becoming-authority',
      trait: {
        sourceTokenId: 8914,
        traitType: 'hand',
        value: 'Torch',
      },
      sourceTriangles: 3_364,
      presentation: {
        motion: 'night-ember',
        emissiveColor: 0xffb35c,
        lightDistance: 3.2,
        lightDecay: 2,
      },
      placements: [
        {
          id: 'gate-guidance-torch-west',
          cluster: 'gate',
          socket: 'sconce',
          pairId: 'gate-guidance',
          pairRole: 'first',
          position: [-2.12, 2.05, 11.60],
          height: 1.18,
          yaw: 0,
        },
        {
          id: 'gate-guidance-torch-east',
          cluster: 'gate',
          socket: 'sconce',
          pairId: 'gate-guidance',
          pairRole: 'second',
          position: [2.12, 2.05, 11.60],
          height: 1.18,
          yaw: Math.PI,
        },
        {
          id: 'bell-ritual-torch',
          cluster: 'bell',
          socket: 'sconce',
          witnessRole: 'ritual',
          anchor: {
            landmark: 'bell',
            offset: [-0.56, 1.48, 0.30],
          },
          height: 1.00,
          yaw: Math.PI,
        },
      ],
    },
    {
      id: 'civic-crown',
      role: 'civic-office',
      trait: {
        sourceTokenId: 8914,
        traitType: 'sprout',
        value: 'Crown Up',
      },
      sourceTriangles: 2_016,
      presentation: {
        motion: 'office-tilt',
        emissiveColor: 0xffdf84,
      },
      placements: [
        {
          id: 'ledger-office-crown',
          cluster: 'ledger',
          socket: 'crest',
          witnessRole: 'office',
          position: [-2.00, 2.48, 3.00],
          height: 0.54,
          yaw: 0,
        },
      ],
    },
  ],
});

/**
 * Named extension points only. These are not runtime assets and carry no URL;
 * each pair inherits the standing fRiENDSiES authorization but still must
 * complete exact-variant, provenance, geometry, budget, fallback, and QA review.
 */
export const TRAIT_ECHO_BACKLOG = deepFreeze([
  {
    id: 'records-and-access',
    status: 'cataloged-intake-required',
    traits: [
      { sourceTokenId: 431, traitType: 'hand', value: 'Book Of Ocean' },
      { sourceTokenId: 431, traitType: 'sprout', value: 'Friends Key' },
    ],
  },
  {
    id: 'uncanny-observation',
    status: 'cataloged-anomaly-hold',
    traits: [
      { traitType: 'sprout', value: 'All Seeing' },
      { traitType: 'hand', value: 'Orb' },
    ],
  },
]);

export function countTraitEchoPlacements(config = TRAIT_ECHO_V1) {
  return config.families.reduce((total, family) => total + family.placements.length, 0);
}

export function countTraitEchoTriangles(config = TRAIT_ECHO_V1) {
  return config.families.reduce(
    (total, family) => total + family.sourceTriangles * family.placements.length,
    0,
  );
}
