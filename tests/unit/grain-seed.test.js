import test from 'node:test';
import assert from 'node:assert/strict';

import { Scene } from 'three';
import { KawaiiSky } from '../../src/visuals/KawaiiSky.js';
import {
  KAWAII_FINISH_SHADER,
  PostProcessing,
} from '../../src/visuals/PostProcessing.js';
import {
  advanceGrainSeed,
  GRAIN_SEED_PERIOD,
} from '../../src/visuals/grainSeed.js';

function assertNear(actual, expected, tolerance = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );
}

test('grain seeds wrap inside the hash period', () => {
  assertNear(advanceGrainSeed(99, 0.1, 31.7), 2.17);
  assertNear(advanceGrainSeed(1, -0.1, 31.7), 97.83);
  assert.equal(advanceGrainSeed(Number.NaN, 1, 100), 0);
});

test('post-processing keeps its animated grain seed precision-safe', () => {
  const post = new PostProcessing(null, null, null);
  post.finishPass = {
    uniforms: {
      uGrainSeed: { value: 0 },
      uNightMix: { value: 0 },
    },
  };
  post.bloomPass = { strength: 0 };

  for (let frame = 0; frame < 60 * 60 * 12; frame += 1) {
    post.update(1 / 60);
  }

  assert.ok(post._grainSeed >= 0);
  assert.ok(post._grainSeed < GRAIN_SEED_PERIOD);
  assert.equal(post.finishPass.uniforms.uGrainSeed.value, post._grainSeed);
  assert.ok('uGrainSeed' in KAWAII_FINISH_SHADER.uniforms);
  assert.ok(!('uTime' in KAWAII_FINISH_SHADER.uniforms));
});

test('sky wraps only grain while preserving the continuous animation clock', () => {
  const sky = new KawaiiSky(new Scene()).init();
  sky.material.uniforms.uTime.value = 599.9;
  sky._grainSeed = 99.5;

  sky.update(0.2, 1);

  assertNear(sky.material.uniforms.uTime.value, 600.1);
  assertNear(sky.material.uniforms.uGrainSeed.value, 0.5);

  sky.dispose();
});
