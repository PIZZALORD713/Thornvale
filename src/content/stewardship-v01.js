function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export const STEWARDSHIP_ITEM_IDS = deepFreeze({
  wood: 'resource.wood',
  gardenSeed: 'seed.garden.common',
  treeSeed: 'seed.tree.common',
  wormBait: 'bait.worm',
  pondDace: 'fish.pond-dace',
});

export const STEWARDSHIP_TOOL_IDS = deepFreeze({
  axe: 'tool.axe.friendsies',
  simpleRod: 'tool.rod.simple',
});

export const STEWARDSHIP_INTERACTION_IDS = deepFreeze({
  axePickup: 'stewardship.axe-pickup',
  plantingSite: 'planting.grove.01',
  fishingSpot: 'day-one-fishing-spot',
});

export const STEWARDSHIP_TREE_IDS = deepFreeze([
  'tree.grove.01',
  'tree.grove.02',
  'tree.grove.03',
]);

const TREE_DEFINITIONS = STEWARDSHIP_TREE_IDS.map((id, index) => deepFreeze({
  id,
  definitionId: 'tree.common',
  stage: 'mature',
  hitCount: 0,
  plantingSiteId: null,
  position: [
    [-34.6, 0, -3.4],
    [-30.7, 0, -4.8],
    [-36.2, 0, 1.1],
  ][index],
  requiredHits: 3,
  rewards: {
    [STEWARDSHIP_ITEM_IDS.wood]: 6,
    [STEWARDSHIP_ITEM_IDS.treeSeed]: 1,
  },
}));

export const STEWARDSHIP_V01 = deepFreeze({
  id: 'stewardship-v01',
  title: 'What the Forest Returns',
  items: STEWARDSHIP_ITEM_IDS,
  tools: STEWARDSHIP_TOOL_IDS,
  ids: STEWARDSHIP_INTERACTION_IDS,
  treeIds: STEWARDSHIP_TREE_IDS,
  trees: TREE_DEFINITIONS,
  plantingSites: [
    {
      id: STEWARDSHIP_INTERACTION_IDS.plantingSite,
      position: [-31.8, 0, -1.9],
      accepts: STEWARDSHIP_ITEM_IDS.treeSeed,
      plantedDefinitionId: 'tree.common',
      plantedStage: 'seedling',
    },
  ],
  axePickup: {
    id: STEWARDSHIP_INTERACTION_IDS.axePickup,
    toolId: STEWARDSHIP_TOOL_IDS.axe,
    position: [-32.3, 0.9, -0.5],
  },
  fishing: {
    id: STEWARDSHIP_INTERACTION_IDS.fishingSpot,
    position: [16.4, 0.25, 4],
    requiredRodId: STEWARDSHIP_TOOL_IDS.simpleRod,
    easyFish: {
      itemId: STEWARDSHIP_ITEM_IDS.pondDace,
      speciesId: STEWARDSHIP_ITEM_IDS.pondDace,
      displayName: 'Pond dace',
      sizeCm: 18,
      quality: 'ordinary',
      caughtAt: 'pond.shallows',
    },
    timing: {
      castDuration: 0.95,
      waitBeforeNibble: 0.9,
      falseNibbleDuration: 0.7,
      waitBeforeBite: 0.85,
      hookWindow: 1.05,
      landingWindow: 1.15,
    },
    struggle: {
      progressPerSecond: 0.58,
      progressLossPerSecond: 0.05,
      tensionGainPulling: 0.9,
      tensionGainResting: 0.42,
      tensionReleasePerSecond: 0.72,
      pullDuration: 0.62,
      restDuration: 0.48,
      breakTension: 1,
    },
  },
  messages: {
    axeFound: 'The fRiENDSiES axe settles into your hand. It feels made to be kept.',
    axeAlreadyOwned: 'The axe is already yours.',
    axeRequired: 'A mature trunk waits for a proper axe.',
    treeStruck: 'The cut deepens. Pale wood shows beneath the bark.',
    treeFelled: 'The tree comes down. Six usable wood and one living seed remain.',
    treeSpent: 'Only the stump remains.',
    seedRequired: 'This marked patch is waiting for a tree seed.',
    siteOccupied: 'A seedling already has this place.',
    seedPlanted: 'The seed settles into the town-marked earth.',
    rodRequired: 'A simple rod and hook would reach the quiet water.',
    fishingStarted: 'The line arcs into the pond.',
    fishingBusy: 'The line is already in the water.',
  },
});

export default STEWARDSHIP_V01;
