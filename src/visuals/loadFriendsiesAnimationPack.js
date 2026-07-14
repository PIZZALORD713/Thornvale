import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AnimationUtils } from 'three';
import { STORY_ACTIONS_V1 } from '../content/story-actions-v1.js';

const BASE_SOURCES = [
  '/animations/friendsies-walk.glb',
  '/animations/friendsies-joy-jump.glb',
  '/animations/friendsies-dance-rumba.glb',
];

let animationPackPromise = null;

const JOY_JUMP_PHASES = [
  { name: 'friendsies-jump-ascent', start: 0.16, end: 0.5 },
  { name: 'friendsies-fall', start: 0.47, end: 0.66 },
  { name: 'friendsies-land', start: 0.62, end: 1 },
];

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/**
 * Split the collection's 1.9 second Joy-Jumper performance into locomotion
 * phases. The source clip is preserved for explicit joy emotes; these derived
 * in-place clips let physical ascent, descent, and contact drive their own
 * timing without playing the full celebration on every jump.
 */
export function deriveFriendsiesLocomotionClips(source, fps = 30) {
  const clips = Array.isArray(source) ? source.filter(Boolean) : [];
  const names = new Set(clips.map((clip) => normalizeName(clip?.name)));
  const joyJump = clips.find((clip) => normalizeName(clip?.name) === 'joyjumper')
    || clips.find((clip) => normalizeName(clip?.name).includes('joyjump'));
  if (!joyJump || !Number.isFinite(joyJump.duration) || joyJump.duration <= 0) return clips;

  const frameRate = Math.max(1, Number(fps) || 30);
  const totalFrames = Math.max(2, Math.round(joyJump.duration * frameRate));
  const derived = [];

  for (const phase of JOY_JUMP_PHASES) {
    if (names.has(normalizeName(phase.name))) continue;
    const startFrame = Math.max(0, Math.round(totalFrames * phase.start));
    const endFrame = Math.max(startFrame + 1, Math.round(totalFrames * phase.end));
    const clip = AnimationUtils.subclip(
      joyJump,
      phase.name,
      startFrame,
      endFrame,
      frameRate,
    );
    if (clip.tracks.length > 0 && clip.duration > 0) {
      clip.optimize();
      derived.push(clip);
      names.add(normalizeName(phase.name));
    }
  }

  return [...clips, ...derived];
}

async function loadStoryActionSources() {
  try {
    const response = await fetch(STORY_ACTIONS_V1.catalogUrl, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`Story action catalog returned ${response.status}`);
    const catalog = await response.json();
    if (catalog?.id !== STORY_ACTIONS_V1.id || !Array.isArray(catalog.clips)) {
      throw new TypeError('Story action catalog contract did not match story-actions-v1');
    }
    return catalog.clips
      .map((clip) => clip?.url)
      .filter((url) => typeof url === 'string' && url.startsWith('/animations/'));
  } catch (error) {
    console.warn('[FriendsiesAnimator] Optional story-actions-v1 catalog was skipped:', error);
    return [];
  }
}

/** Load the optimized animation-only fRiENDSiES packs once per page. */
export function loadFriendsiesAnimationPack() {
  if (animationPackPromise) return animationPackPromise;

  animationPackPromise = loadStoryActionSources()
    .then((storySources) => Promise.allSettled(
      [...BASE_SOURCES, ...storySources].map(async (url) => {
        const gltf = await new GLTFLoader().loadAsync(url);
        return gltf.animations || [];
      }),
    ))
    .then((results) => {
      const clips = results
        .filter((result) => result.status === 'fulfilled')
        .flatMap((result) => result.value);
      if (clips.length === 0) throw new Error('No fRiENDSiES animation clips could be loaded');
      for (const result of results) {
        if (result.status === 'rejected') {
          console.warn('[FriendsiesAnimator] One optional animation file was skipped:', result.reason);
        }
      }
      return deriveFriendsiesLocomotionClips(clips);
    })
    .catch((error) => {
      animationPackPromise = null;
      throw error;
    });

  return animationPackPromise;
}

export function resetFriendsiesAnimationPackForTests() {
  animationPackPromise = null;
}
