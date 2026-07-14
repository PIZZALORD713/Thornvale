function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

/**
 * Stable semantic IDs for the first fRiENDSiES story-motion pilot.
 *
 * The public pack owns files and measured source timing. Authored gameplay
 * duration and commit cues stay here so animation playback never becomes save
 * or progression authority.
 */
export const STORY_ACTIONS_V1 = deepFreeze({
  id: 'story-actions-v1',
  catalogUrl: '/animations/story-actions-v1/pack.json',
  lumen: {
    acknowledging: 'story-actions-v1-lumen-acknowledging',
    happyHandGesture: 'story-actions-v1-lumen-happy-hand-gesture',
    thoughtfulHeadShake: 'story-actions-v1-lumen-thoughtful-head-shake',
    relievedSigh: 'story-actions-v1-lumen-relieved-sigh',
  },
  dayOne: {
    plantSeed: {
      id: 'day-one.plant-seed',
      clipName: 'story-actions-v1-day-one-plant-seed',
      duration: 3.1,
      commitTime: 2.3,
      reducedMotion: 'no-skeletal-motion-world-cue',
    },
    waterSeed: {
      id: 'day-one.water-seed',
      clipName: 'story-actions-v1-day-one-water-seed',
      duration: 3.2,
      commitTime: 2.35,
      reducedMotion: 'no-skeletal-motion-world-cue',
    },
  },
});

export default STORY_ACTIONS_V1;
