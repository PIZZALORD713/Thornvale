import { GAME_ITEM_IDS } from './GameSession.js';

function specimensByCondition(snapshot, condition) {
  return Object.entries(snapshot?.player?.inventory?.specimens || {})
    .filter(([, specimen]) => specimen?.condition === condition);
}

/**
 * Read-only projection for the authored first-afternoon chapter. It is never
 * persisted; global player, world, activity, and chapter paths remain the
 * sole authority.
 */
export function selectDayOneState(snapshot) {
  const stackables = snapshot?.player?.inventory?.stackables || {};
  return {
    complete: snapshot?.chapters?.dayOne?.complete === true,
    nourishment: Number(snapshot?.player?.meters?.nourishment) || 0,
    energy: Number(snapshot?.player?.meters?.energy) || 0,
    coins: Number(snapshot?.player?.economy?.coins) || 0,
    doctorDebt: Number(snapshot?.player?.economy?.doctorDebt) || 0,
    passedOutCount: Number(snapshot?.player?.passedOutCount) || 0,
    inventory: {
      wood: Number(stackables[GAME_ITEM_IDS.wood]) || 0,
      rawFish: specimensByCondition(snapshot, 'raw').length,
      cookedFish: specimensByCondition(snapshot, 'cooked').length,
      seeds: Number(stackables[GAME_ITEM_IDS.gardenSeed]) || 0,
    },
    activity: { ...snapshot?.chapters?.dayOne?.account },
    camp: { ...snapshot?.world?.camp },
    garden: { ...snapshot?.world?.garden },
  };
}

export function findFishSpecimenId(snapshot, condition) {
  return specimensByCondition(snapshot, condition)[0]?.[0] || null;
}
