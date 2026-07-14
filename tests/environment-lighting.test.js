import assert from 'node:assert/strict';
import test from 'node:test';
import { Color, MeshStandardMaterial, Scene, Texture } from 'three';

import {
  EnvironmentLighting,
  environmentIntensityForNightMix,
} from '../src/visuals/EnvironmentLighting.js';

test('environment intensity keeps metals readable while preserving the day-night hierarchy', () => {
  const day = environmentIntensityForNightMix(0);
  const dusk = environmentIntensityForNightMix(0.58);
  const night = environmentIntensityForNightMix(1);

  assert.equal(day, 0.16);
  assert.ok(day > dusk, 'dusk reflection fill should be dimmer than day');
  assert.ok(dusk > night, 'night reflection fill should be dimmer than dusk');
  assert.equal(night, 0.08);
  assert.ok(Number.isFinite(night) && night > 0, 'night retains readable reflections');
  assert.equal(environmentIntensityForNightMix(-10), day);
  assert.equal(environmentIntensityForNightMix(10), night);
  assert.equal(environmentIntensityForNightMix(Number.NaN), day);
});

test('environment lighting bakes a PMREM without changing authored materials or the sky', () => {
  const events = [];
  const scene = new Scene();
  const background = new Color(0xaedcff);
  const texture = new Texture();
  const source = { dispose: () => events.push('source-dispose') };
  const target = {
    texture,
    dispose: () => events.push('target-dispose'),
  };
  const generator = {
    fromScene(receivedSource, sigma) {
      assert.equal(receivedSource, source);
      assert.equal(sigma, 0.04);
      events.push('bake');
      return target;
    },
    dispose: () => events.push('generator-dispose'),
  };
  const material = new MeshStandardMaterial({
    color: 0xfef33f,
    emissive: 0x000000,
    metalness: 1,
    roughness: 76 / 255,
  });
  const authored = materialSnapshot(material);
  scene.background = background;

  const lighting = new EnvironmentLighting(scene, {}, {
    createEnvironment: () => source,
    createPMREMGenerator: () => generator,
  }).init();

  assert.equal(scene.environment, texture);
  assert.equal(scene.background, background, 'the authored sky remains the background');
  assert.equal(scene.environmentIntensity, 0.16);
  assert.deepEqual(materialSnapshot(material), authored, 'authored PBR values stay intact');
  assert.deepEqual(events, ['bake', 'source-dispose', 'generator-dispose']);

  lighting.update(0.58);
  assert.equal(scene.environmentIntensity, environmentIntensityForNightMix(0.58));
  assert.ok(!events.includes('target-dispose'), 'the baked target stays alive during rendering');

  lighting.dispose();
  lighting.dispose();
  assert.equal(scene.environment, null);
  assert.deepEqual(events, [
    'bake',
    'source-dispose',
    'generator-dispose',
    'target-dispose',
  ]);

  material.dispose();
  texture.dispose();
});

test('environment lighting fails open and clears only the texture it owns', () => {
  const scene = new Scene();
  const original = new Texture();
  const replacement = new Texture();
  const baked = new Texture();
  let sourceDisposals = 0;
  let generatorDisposals = 0;
  let targetDisposals = 0;
  const warnings = [];
  scene.environment = original;
  scene.environmentIntensity = 0.41;

  const lighting = new EnvironmentLighting(scene, {}, {
    createEnvironment: () => ({ dispose: () => { sourceDisposals += 1; } }),
    createPMREMGenerator: () => ({
      fromScene: () => ({
        texture: baked,
        dispose: () => { targetDisposals += 1; },
      }),
      dispose: () => { generatorDisposals += 1; },
    }),
    warn: (...args) => warnings.push(args),
  }).init();

  assert.equal(scene.environment, baked);
  scene.environment = replacement;
  scene.environmentIntensity = 0.27;
  lighting.dispose();

  assert.equal(scene.environment, replacement, 'a later environment owner is preserved');
  assert.equal(scene.environmentIntensity, 0.27);
  assert.equal(sourceDisposals, 1);
  assert.equal(generatorDisposals, 1);
  assert.equal(targetDisposals, 1);
  assert.deepEqual(warnings, []);

  const failingScene = new Scene();
  const fallback = new Texture();
  failingScene.environment = fallback;
  new EnvironmentLighting(failingScene, {}, {
    createEnvironment: () => ({ dispose: () => { sourceDisposals += 1; } }),
    createPMREMGenerator: () => ({
      fromScene: () => { throw new Error('PMREM unavailable'); },
      dispose: () => { generatorDisposals += 1; },
    }),
    warn: (...args) => warnings.push(args),
  }).init();

  assert.equal(failingScene.environment, fallback, 'direct-light fallback remains available');
  assert.equal(warnings.length, 1);
  assert.equal(sourceDisposals, 2);
  assert.equal(generatorDisposals, 2);

  original.dispose();
  replacement.dispose();
  baked.dispose();
  fallback.dispose();
});

function materialSnapshot(material) {
  return {
    color: material.color.getHex(),
    emissive: material.emissive.getHex(),
    metalness: material.metalness,
    roughness: material.roughness,
  };
}
