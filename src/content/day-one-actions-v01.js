import { STORY_ACTIONS_V1 } from './story-actions-v1.js';

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function nativeAction(id, duration, commitTime, worldCue, feedbackKind = 'kindness') {
  return {
    id,
    clipName: '',
    duration,
    commitTime,
    worldCue,
    feedbackKind,
    reducedMotion: 'no-skeletal-motion-world-cue',
  };
}

/**
 * Authoritative timing and contact cues for every successful Day One chore.
 *
 * Planting and watering use the optional story-actions-v1 skeletal clips. The
 * other chores deliberately use code-native world cues until a suitable clip
 * is shipped; their timing and saved-state commits are identical either way.
 */
export const DAY_ONE_ACTIONS_V01 = deepFreeze({
  chopWood: nativeAction('day-one.chop-wood', 3.2, 2.1, 'chop-wood'),
  catchFish: nativeAction('day-one.catch-fish', 3.6, 2.9, 'catch-fish', 'magic'),
  lightFire: nativeAction('day-one.light-fire', 3.1, 2.2, 'light-fire'),
  cookFish: nativeAction('day-one.cook-fish', 3.4, 2.7, 'cook-fish'),
  eatFish: nativeAction('day-one.eat-fish', 3.0, 2.25, 'eat-fish'),
  plantSeed: {
    ...STORY_ACTIONS_V1.dayOne.plantSeed,
    worldCue: 'plant-seed',
    feedbackKind: 'magic',
  },
  waterSeed: {
    ...STORY_ACTIONS_V1.dayOne.waterSeed,
    worldCue: 'water-seed',
    feedbackKind: 'magic',
  },
  repairShelter: nativeAction('day-one.repair-shelter', 3.6, 2.8, 'repair-shelter'),
});

export default DAY_ONE_ACTIONS_V01;
