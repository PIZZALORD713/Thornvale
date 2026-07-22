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
 * runtime remains a bounded local vocabulary: civic symbols keep their
 * original semantic jobs, while Pond-Grove forms turn exact canonical traits
 * into authored vegetation without moving gameplay or save authority.
 */
export const TRAIT_ECHO_V1 = deepFreeze({
  id: 'friendsies-trait-echo-v1',
  version: '1.1.0',
  budgets: {
    maximumDisplayedTriangles: 95_000,
    maximumDrawCalls: 9,
    expectedPlacements: 21,
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
    {
      id: 'pond-grove-rounded-tree',
      role: 'district-silhouette-and-grove-depth',
      trait: {
        sourceTokenId: 952,
        traitType: 'head',
        value: 'Carrot',
      },
      sourceTriangles: 7_056,
      presentation: {
        motion: 'rooted-still',
        emissiveColor: 0x5f8f3c,
      },
      placements: [
        {
          id: 'pond-rounded-tree',
          cluster: 'pond-grove',
          surface: 'ground',
          position: [25.8, 0.02, 8.8],
          height: 4.8,
          yaw: -0.32,
        },
        {
          id: 'camp-rounded-tree',
          cluster: 'forest-edge',
          surface: 'ground',
          position: [-37.8, 0.02, -7.4],
          height: 4.5,
          yaw: 0.28,
        },
      ],
    },
    {
      id: 'pond-grove-mushroom-landmark',
      role: 'pond-bank-mushroom-landmark',
      trait: {
        sourceTokenId: 601,
        traitType: 'head',
        value: 'Earthworm',
      },
      sourceTriangles: 9_664,
      presentation: {
        motion: 'rooted-still',
        emissiveColor: 0xc9a6bc,
      },
      placements: [
        {
          id: 'pond-mushroom-landmark',
          cluster: 'pond-grove',
          surface: 'ground',
          position: [22.9, 0.02, -1.0],
          height: 2.4,
          yaw: 0.36,
        },
      ],
    },
    {
      id: 'pond-grove-flower-hill',
      role: 'flowered-bank-and-route-framing',
      trait: {
        sourceTokenId: 563,
        traitType: 'head',
        value: 'Flower Hill',
      },
      sourceTriangles: 2_744,
      presentation: {
        motion: 'rooted-still',
        emissiveColor: 0xbdd483,
      },
      placements: [
        {
          id: 'pond-flower-hill-east',
          cluster: 'pond-grove',
          surface: 'ground',
          position: [24.7, 0.02, 1.2],
          height: 1.35,
          yaw: -0.22,
        },
        {
          id: 'pond-flower-hill-route',
          cluster: 'pond-route',
          surface: 'ground',
          position: [15.8, 0.02, 7.6],
          height: 1.1,
          yaw: 0.42,
        },
      ],
    },
    {
      id: 'pond-grove-blooming-tree',
      role: 'grove-growth-endpoint',
      trait: {
        sourceTokenId: 563,
        traitType: 'sprout',
        value: 'Blooming Tree',
      },
      sourceTriangles: 27_128,
      presentation: {
        motion: 'rooted-still',
        emissiveColor: 0xc3dfac,
      },
      placements: [
        {
          id: 'camp-blooming-tree',
          cluster: 'forest-edge',
          surface: 'ground',
          position: [-27.2, 0.02, -7.5],
          height: 3.5,
          yaw: 0.46,
        },
      ],
    },
    {
      id: 'pond-grove-resting-leaf',
      role: 'quiet-water-surface-detail',
      trait: {
        sourceTokenId: 1017,
        traitType: 'sprout',
        value: 'Resting Green Leaf',
      },
      sourceTriangles: 640,
      presentation: {
        motion: 'water-rest',
        emissiveColor: 0x7fdc91,
      },
      placements: [
        {
          id: 'pond-leaf-southwest',
          cluster: 'pond-water',
          surface: 'water',
          position: [18.8, 0.13, 3.2],
          height: 0.24,
          yaw: 0.20,
        },
        {
          id: 'pond-leaf-north',
          cluster: 'pond-water',
          surface: 'water',
          position: [20.1, 0.13, 5.0],
          height: 0.28,
          yaw: -0.40,
        },
        {
          id: 'pond-leaf-east',
          cluster: 'pond-water',
          surface: 'water',
          position: [21.4, 0.13, 3.5],
          height: 0.22,
          yaw: 0.52,
        },
        {
          id: 'pond-leaf-northwest',
          cluster: 'pond-water',
          surface: 'water',
          position: [19.0, 0.13, 5.4],
          height: 0.20,
          yaw: -0.82,
        },
      ],
    },
    {
      id: 'pond-grove-purple-mushroom',
      role: 'fungal-understory-and-bank-detail',
      trait: {
        sourceTokenId: 404,
        traitType: 'sprout',
        value: 'Purp Mush',
      },
      sourceTriangles: 1_368,
      presentation: {
        motion: 'rooted-still',
        emissiveColor: 0xb59ad9,
      },
      placements: [
        {
          id: 'pond-purple-mushroom-east',
          cluster: 'pond-grove',
          surface: 'ground',
          position: [23.2, 0.02, 7.2],
          height: 0.55,
          yaw: 0.12,
        },
        {
          id: 'pond-purple-mushroom-rim',
          cluster: 'pond-grove',
          surface: 'ground',
          position: [25.0, 0.02, 5.8],
          height: 0.50,
          yaw: -0.48,
        },
        {
          id: 'camp-purple-mushroom-inner',
          cluster: 'forest-edge',
          surface: 'ground',
          position: [-28.5, 0.02, -4.6],
          height: 0.48,
          yaw: 0.70,
        },
        {
          id: 'camp-purple-mushroom-outer',
          cluster: 'forest-edge',
          surface: 'ground',
          position: [-38.2, 0.02, -3.0],
          height: 0.52,
          yaw: -0.18,
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
