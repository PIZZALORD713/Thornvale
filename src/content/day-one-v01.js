import { DAY_ONE_ACTIONS_V01 } from './day-one-actions-v01.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export const DAY_ONE_INTERACTION_IDS = deepFreeze({
  woodlot: 'day-one-woodlot',
  fishingSpot: 'day-one-fishing-spot',
  campfire: 'day-one-campfire',
  garden: 'day-one-garden',
  shelter: 'day-one-shelter',
});

export const DAY_ONE_V01 = deepFreeze({
  id: 'day-one-v01',
  title: 'A Place for Tonight',
  ids: DAY_ONE_INTERACTION_IDS,

  events: {
    stewardMet: 'steward-lumen-met',
    afternoonComplete: 'first-afternoon-complete',
    ledgerSigned: 'community-ledger-signed',
  },

  actions: DAY_ONE_ACTIONS_V01,

  anchors: {
    camp: { x: -24.2, y: 0, z: 6.25 },
    campRecovery: { x: -29.3, y: 0.9, z: 3.8 },
    woodlot: { x: -32.3, y: 0, z: -0.5 },
    fishingSpot: { x: 16.4, y: 0.25, z: 4 },
    campfire: { x: -24.5, y: 0.2, z: 2.4 },
    garden: { x: -27, y: 0, z: 6.8 },
    shelter: { x: -31.5, y: 0, z: 4.8 },
  },

  tuning: {
    meters: {
      max: 100,
      startingEnergy: 82,
      startingNourishment: 72,
      recoveryEnergy: 70,
      recoveryNourishment: 55,
    },
    startingInventory: {
      wood: 0,
      rawFish: 0,
      cookedFish: 0,
      seeds: 1,
    },
    startingCoins: 8,
    doctorFee: 4,
    woodPerChop: 2,
    woodInventoryLimit: 10,
    fishCatchLimit: 3,
    fireWoodCost: 1,
    shelterWoodCost: 4,
    mealRecovery: {
      energy: 45,
      nourishment: 48,
    },
    labor: {
      chop: { energy: 16, nourishment: 6 },
      fish: { energy: 14, nourishment: 5 },
      plant: { energy: 6, nourishment: 2 },
      water: { energy: 8, nourishment: 3 },
      repairShelter: { energy: 18, nourishment: 7 },
    },
    requirements: {
      woodGathered: 6,
      mealsEaten: 1,
      gardenPlanted: true,
      gardenWatered: true,
      shelterRepaired: true,
    },
  },

  prompts: {
    chop: 'Chop fallen wood',
    woodFull: 'Your arms are full of wood',
    fish: 'Fish the pond',
    fishFinished: 'Let the pond settle',
    lightFire: 'Light the campfire (1 wood)',
    needFireWood: 'Gather 1 wood for the campfire',
    cookFish: 'Cook the fish',
    eatFish: 'Eat the cooked fish',
    warmHands: 'Warm your hands by the fire',
    plant: 'Plant the seed',
    needSeed: 'Find a seed to plant',
    water: 'Water the planted seed',
    gardenDone: 'The little garden is settled',
    repairShelter: 'Brace the shelter (4 wood)',
    needShelterWood: 'Gather 4 wood for the shelter',
    shelterDone: 'The shelter is ready for tonight',
  },

  objectives: {
    meetSteward: {
      id: 'day-one-meet-steward',
      label: 'A place kept warm',
      text: 'Meet the steward who kept the gate open for you.',
      title: 'A place kept warm',
      detail: 'Meet the steward who kept the gate open for you.',
    },
    gatherWood: {
      id: 'day-one-gather-wood',
      label: 'What the forest gives',
      text: 'Gather 6 wood for a fire and a sturdier shelter.',
      title: 'What the forest gives',
      detail: 'Gather 6 wood for a fire and a sturdier shelter.',
    },
    catchFish: {
      id: 'day-one-catch-fish',
      label: 'Supper from the pond',
      text: 'Catch one fish in the pond.',
      title: 'Supper from the pond',
      detail: 'Catch one fish in the pond.',
    },
    lightFire: {
      id: 'day-one-light-fire',
      label: 'A little warmth',
      text: 'Use 1 wood to light the campfire.',
      title: 'A little warmth',
      detail: 'Use 1 wood to light the campfire.',
    },
    cookFish: {
      id: 'day-one-cook-fish',
      label: 'Supper from the pond',
      text: 'Cook your fish over the campfire.',
      title: 'Supper from the pond',
      detail: 'Cook your fish over the campfire.',
    },
    eatFish: {
      id: 'day-one-eat-fish',
      label: 'Take care of yourself',
      text: 'Eat the cooked fish to restore nourishment and energy.',
      title: 'Take care of yourself',
      detail: 'Eat the cooked fish to restore nourishment and energy.',
    },
    plantSeed: {
      id: 'day-one-plant-seed',
      label: 'Something for tomorrow',
      text: 'Plant your seed in the garden bed beside camp.',
      title: 'Something for tomorrow',
      detail: 'Plant your seed in the garden bed beside camp.',
    },
    waterSeed: {
      id: 'day-one-water-seed',
      label: 'Something for tomorrow',
      text: 'Water the planted seed.',
      title: 'Something for tomorrow',
      detail: 'Water the planted seed.',
    },
    gatherShelterWood: {
      id: 'day-one-gather-shelter-wood',
      label: 'A roof for tonight',
      text: 'Gather enough wood to brace the makeshift shelter.',
      title: 'A roof for tonight',
      detail: 'Gather enough wood to brace the makeshift shelter.',
    },
    repairShelter: {
      id: 'day-one-repair-shelter',
      label: 'A roof for tonight',
      text: 'Use 4 wood to brace the makeshift shelter.',
      title: 'A roof for tonight',
      detail: 'Use 4 wood to brace the makeshift shelter.',
    },
    signLedger: {
      id: 'day-one-sign-ledger',
      label: 'Your first evening',
      text: 'Your camp is settled. Enter your name in the Community Ledger.',
      title: 'Your first evening',
      detail: 'Your camp is settled. Enter your name in the Community Ledger.',
    },
  },

  messages: {
    inactive: 'There will be time for that after you meet Thornvale’s steward.',
    busy: 'Take a breath. One thing at a time.',
    actionChanged: 'Something changed before you could finish. Take another look.',
    wood: 'You split two dry branches. They will burn cleanly.',
    woodFull: 'You cannot carry more wood just now.',
    fish: 'A pondfish takes the line. Supper, if you make a fire.',
    fishFinished: 'The pond has given enough for one afternoon.',
    fire: 'The kindling catches. Your little camp feels less temporary.',
    needFireWood: 'The fire ring needs one piece of wood.',
    cookedFish: 'The fish crisps over the coals.',
    ateFish: 'A hot meal restores your nourishment and energy.',
    nothingToCook: 'The fire is warm, but there is nothing to cook.',
    planted: 'One seed settles into the dark soil.',
    needSeed: 'You do not have a seed to plant.',
    watered: 'The soil darkens. Something is ready to begin.',
    gardenDone: 'The seed bed is planted and watered.',
    shelter: 'Four pieces of wood turn the lean-to into a shelter you can trust.',
    needShelterWood: 'You need four pieces of wood to brace the shelter.',
    shelterDone: 'The shelter is already ready for tonight.',
    complete: 'Your first afternoon is settled. The Community Ledger waits in the plaza.',
    passedOutPaid: 'You wake at camp with the doctor’s bitter medicine on your tongue. The fee was {fee} coins.',
    passedOutDebt: 'You wake at camp after the doctor’s medicine. You paid {paid} coins and now owe {debt} more.',
  },
});
