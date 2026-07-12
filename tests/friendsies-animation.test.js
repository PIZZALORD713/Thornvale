import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AnimationClip,
  Group,
  NumberKeyframeTrack,
  Object3D,
  VectorKeyframeTrack,
} from 'three';

import { FriendsiesAnimator } from '../src/visuals/FriendsiesAnimator.js';
import { PlayerAnimator } from '../src/visuals/PlayerAnimator.js';
import { deriveFriendsiesLocomotionClips } from '../src/visuals/loadFriendsiesAnimationPack.js';

function positionClip(name, duration = 1) {
  return new AnimationClip(name, duration, [
    new VectorKeyframeTrack(
      'Root.position',
      [0, duration],
      [0, 0, 0, 0, 0.001, 0],
    ),
  ]);
}

function makeAnimator(options = {}) {
  const character = new Group();
  character.add(new Object3D());
  character.children[0].name = 'Root';

  const clips = [
    positionClip('Idle Float.001', 1.6667),
    positionClip('walk-low-arms', 1.3333),
    positionClip('friendsies-jump-ascent', 0.6667),
    positionClip('friendsies-fall', 0.3333),
    positionClip('friendsies-land', 0.7),
    positionClip('Joy-Jumper', 1.9),
  ];

  return new FriendsiesAnimator(character, {
    clips,
    fadeDuration: 0,
    oneShotFadeDuration: 0,
    airFadeDuration: 0,
    landingFadeDuration: 0,
    cadenceSharpness: 1000,
    ...options,
  });
}

function consumeAllFootsteps(animator) {
  let count = 0;
  while (animator.consumeFootstep()) count += 1;
  return count;
}

test('Joy-Jumper is preserved and split into ascent, fall, and landing clips', () => {
  const times = Array.from({ length: 58 }, (_, index) => index / 30);
  const values = times.map((time) => Math.sin(time * Math.PI));
  const joy = new AnimationClip('Joy-Jumper', 1.9, [
    new NumberKeyframeTrack('Root.position[y]', times, values),
  ]);

  const clips = deriveFriendsiesLocomotionClips([joy]);
  const byName = new Map(clips.map((clip) => [clip.name, clip]));

  assert.equal(byName.get('Joy-Jumper'), joy);
  assert.ok(byName.get('friendsies-jump-ascent'));
  assert.ok(byName.get('friendsies-fall'));
  assert.ok(byName.get('friendsies-land'));
  assert.ok(Math.abs(byName.get('friendsies-jump-ascent').duration - (20 / 30)) < 0.001);
  assert.ok(Math.abs(byName.get('friendsies-fall').duration - (10 / 30)) < 0.001);
  assert.ok(Math.abs(byName.get('friendsies-land').duration - (21 / 30)) < 0.001);

  const derivedAgain = deriveFriendsiesLocomotionClips(clips);
  assert.equal(derivedAgain.length, clips.length, 'phase derivation is idempotent');
});

test('walk cadence follows travel speed and uses hysteresis around rest', () => {
  const animator = makeAnimator();

  animator.updateLocomotion({ phase: 'grounded', grounded: true, horizontalSpeed: 4.2 }, 1 / 60);
  animator.update(1 / 60);
  assert.equal(animator.locomotionState, 'walk');
  assert.equal(animator.loopRole, 'walk');
  assert.ok(Math.abs(animator.walkTargetTimeScale - 1) < 0.001);
  assert.ok(Math.abs(animator.walkTimeScale - 1) < 0.001);

  animator.updateLocomotion({ phase: 'grounded', grounded: true, horizontalSpeed: 5.6 }, 1 / 60);
  animator.update(1 / 60);
  assert.ok(Math.abs(animator.walkTargetTimeScale - (4 / 3)) < 0.001);
  assert.ok(Math.abs(animator.walkTimeScale - (4 / 3)) < 0.001);

  animator.updateLocomotion({ phase: 'grounded', grounded: true, horizontalSpeed: 0.24 }, 1 / 60);
  assert.equal(animator.locomotionState, 'walk', 'does not chatter below the start threshold');

  animator.updateLocomotion({ phase: 'grounded', grounded: true, horizontalSpeed: 0.1 }, 1 / 60);
  assert.equal(animator.locomotionState, 'idle');
  animator.dispose();
});

test('walk contact events stay phase-locked at normal and sprint cadence', () => {
  const animator = makeAnimator();

  animator.updateLocomotion({ phase: 'grounded', grounded: true, horizontalSpeed: 4.2 }, 1 / 60);
  for (let index = 0; index < 80; index += 1) animator.update(1 / 60);
  assert.equal(consumeAllFootsteps(animator), 2, 'two contacts fire during one 1.33s walk cycle');
  assert.equal(animator.consumeFootstep(), false, 'consumption clears each queued contact');

  animator.updateLocomotion({ phase: 'grounded', grounded: true, horizontalSpeed: 0 }, 1 / 60);
  animator.update(1 / 60);
  animator.updateLocomotion({ phase: 'grounded', grounded: true, horizontalSpeed: 5.6 }, 1 / 60);
  for (let index = 0; index < 60; index += 1) animator.update(1 / 60);
  assert.equal(consumeAllFootsteps(animator), 2, 'two contacts fire during one 1.0s sprint cycle');
  animator.dispose();
});

test('footstep tracking clears stale events when walk is interrupted or resumed', () => {
  const animator = makeAnimator();

  animator.updateLocomotion({ phase: 'grounded', grounded: true, horizontalSpeed: 4.2 }, 1 / 60);
  for (let index = 0; index < 25; index += 1) animator.update(1 / 60);

  animator.updateLocomotion({ phase: 'grounded', grounded: true, horizontalSpeed: 0 }, 1 / 60);
  assert.equal(animator.consumeFootstep(), false, 'idle transition drops an unconsumed contact');

  animator.updateLocomotion({ phase: 'grounded', grounded: true, horizontalSpeed: 4.2 }, 1 / 60);
  for (let index = 0; index < 15; index += 1) animator.update(1 / 60);
  assert.equal(animator.consumeFootstep(), false, 'resumed walk does not replay a stale contact');
  for (let index = 0; index < 6; index += 1) animator.update(1 / 60);
  assert.equal(animator.consumeFootstep(), true, 'the next genuine contact still fires');

  for (let index = 0; index < 40; index += 1) animator.update(1 / 60);
  animator.updateLocomotion({
    phase: 'rising',
    grounded: false,
    justJumped: true,
    horizontalSpeed: 4.2,
  }, 1 / 60);
  assert.equal(animator.consumeFootstep(), false, 'takeoff clears any queued ground contact');
  animator.dispose();
});

test('physical locomotion drives jump, fall, visible land, then resumes walk', () => {
  const animator = makeAnimator();
  animator.updateLocomotion({ phase: 'grounded', grounded: true, horizontalSpeed: 4.2 }, 1 / 60);

  animator.updateLocomotion({
    phase: 'rising',
    grounded: false,
    justJumped: true,
    horizontalSpeed: 4.2,
  }, 1 / 60);
  assert.equal(animator.locomotionState, 'jump');
  assert.equal(animator.airRole, 'jump');
  assert.equal(animator.airAction.getClip().name, 'friendsies-jump-ascent');

  animator.updateLocomotion({
    phase: 'falling',
    grounded: false,
    horizontalSpeed: 4.2,
  }, 1 / 60);
  assert.equal(animator.locomotionState, 'fall');
  assert.equal(animator.airRole, 'fall');
  assert.equal(animator.airAction.getClip().name, 'friendsies-fall');

  animator.updateLocomotion({
    phase: 'landing',
    grounded: true,
    justLanded: true,
    landingSpeed: 8,
    horizontalSpeed: 4.2,
  }, 1 / 60);
  assert.equal(animator.locomotionState, 'land');
  assert.equal(animator.oneShotRole, 'land');
  assert.equal(animator.oneShotAction.getClip().name, 'friendsies-land');
  assert.equal(animator.isPlayingOneShot, true);

  for (let index = 0; index < 8; index += 1) animator.update(0.1);
  assert.equal(animator.isPlayingOneShot, false);
  assert.equal(animator.locomotionState, 'walk');
  assert.equal(animator.loopRole, 'walk');
  animator.dispose();
});

test('physical locomotion resumes idle after landing without movement', () => {
  const animator = makeAnimator();
  animator.updateLocomotion({ phase: 'rising', grounded: false, justJumped: true }, 1 / 60);
  animator.updateLocomotion({ phase: 'falling', grounded: false }, 1 / 60);
  animator.updateLocomotion({ phase: 'landing', grounded: true, justLanded: true }, 1 / 60);

  for (let index = 0; index < 8; index += 1) animator.update(0.1);
  assert.equal(animator.locomotionState, 'idle');
  assert.equal(animator.loopRole, 'idle');
  animator.dispose();
});

test('PlayerAnimator keeps procedural cadence in sync through sprint and exposes air phases', () => {
  const visual = new Object3D();
  const animator = new PlayerAnimator({ visual }, {
    maxSpeed: 4.2,
    speedSharpness: 1000,
    moveBlendSharpness: 1000,
    reducedMotion: false,
  });

  for (let index = 0; index < 80; index += 1) {
    animator.update(1 / 60, {
      velocity: { x: 4.2, y: 0, z: 0 },
      horizontalSpeed: 4.2,
      phase: 'grounded',
      grounded: true,
    });
  }
  assert.ok(Math.abs(animator._cadenceRatio - 1) < 0.001);
  const walkStride = animator._stride;

  animator.update(1 / 60, {
    velocity: { x: 5.6, y: 0, z: 0 },
    horizontalSpeed: 5.6,
    phase: 'grounded',
    grounded: true,
  });
  assert.ok(Math.abs(animator._cadenceRatio - (4 / 3)) < 0.001);
  assert.ok(animator._stride - walkStride > animator.settings.strideFrequency / 60);

  animator.update(1 / 60, {
    velocity: { x: 4.2, y: 7, z: 0 },
    phase: 'rising',
    grounded: false,
  });
  assert.equal(animator.motionState, 'jump');

  animator.update(1 / 60, {
    velocity: { x: 4.2, y: -4, z: 0 },
    phase: 'falling',
    grounded: false,
  });
  assert.equal(animator.motionState, 'fall');

  animator.update(1 / 60, {
    velocity: { x: 4.2, y: 0, z: 0 },
    phase: 'landing',
    grounded: true,
    justLanded: true,
    landingSpeed: 7,
  });
  assert.equal(animator.motionState, 'land');
  assert.ok(animator._landing < 0);
  animator.dispose();
});
