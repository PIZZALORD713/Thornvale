import { STORY_ACTIONS_V1 } from '../../src/content/story-actions-v1.js';

const action = (id, label, kind, options = {}) => Object.freeze({
  id,
  label,
  kind,
  ...options,
});

export const SAFE_PREVIEW_ACTIONS = Object.freeze([
  action('idle', 'Idle', 'loop', { shortcut: '1' }),
  action('walk', 'Walk', 'locomotion', { shortcut: '2' }),
  action('jump', 'Jump', 'locomotion', { shortcut: '3' }),
  action('joy', 'Joy', 'one-shot', { shortcut: '4', clipName: 'Joy-Jumper' }),
  action('dance', 'Dance', 'one-shot', { shortcut: '5', clipName: 'Dance_Rumba' }),
  action(STORY_ACTIONS_V1.dayOne.plantSeed.id, 'Plant Seed', 'story-one-shot', {
    shortcut: '6',
    clipName: STORY_ACTIONS_V1.dayOne.plantSeed.clipName,
    duration: STORY_ACTIONS_V1.dayOne.plantSeed.duration,
  }),
  action(STORY_ACTIONS_V1.dayOne.waterSeed.id, 'Water Seed', 'story-one-shot', {
    shortcut: '7',
    clipName: STORY_ACTIONS_V1.dayOne.waterSeed.clipName,
    duration: STORY_ACTIONS_V1.dayOne.waterSeed.duration,
  }),
]);

export const SAFE_PREVIEW_ACTION_IDS = Object.freeze(
  SAFE_PREVIEW_ACTIONS.map((entry) => entry.id),
);

const SAFE_CLIP_NAMES = new Set([
  'Idle Float',
  'Idle Float.001',
  'walk-low-arms',
  'friendsies-jump-ascent',
  'friendsies-fall',
  'friendsies-land',
  'Joy-Jumper',
  'Dance_Rumba',
  STORY_ACTIONS_V1.dayOne.plantSeed.clipName,
  STORY_ACTIONS_V1.dayOne.waterSeed.clipName,
].map((name) => name.toLowerCase()));

export function getSafePreviewAction(id) {
  return SAFE_PREVIEW_ACTIONS.find((entry) => entry.id === id) || null;
}

export function filterSafePreviewClips(clips) {
  return (Array.isArray(clips) ? clips : []).filter(
    (clip) => SAFE_CLIP_NAMES.has(String(clip?.name || '').toLowerCase()),
  );
}

export function validateInvocationAction(invocation) {
  if (!invocation?.action) return invocation;
  if (!SAFE_PREVIEW_ACTION_IDS.includes(invocation.action)) {
    throw new Error(`Unknown or unavailable Friend 6602 action: ${invocation.action}`);
  }
  return invocation;
}
