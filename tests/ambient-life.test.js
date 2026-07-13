import test from 'node:test';
import assert from 'node:assert/strict';

import { Group, Scene, Vector3 } from 'three';

import { TOWN_LAYOUT } from '../src/config/town.js';
import { ASSET_VARIANTS } from '../src/config/assets.js';
import { createAmbientLife } from '../src/visuals/CozyTownKit.js';
import { KawaiiVFX } from '../src/visuals/KawaiiVFX.js';
import { WorldAnimator } from '../src/visuals/WorldAnimator.js';

test('legacy square petal drift leaves the render list before night consequences', () => {
  const animator = new WorldAnimator();
  const ambientLife = createAmbientLife(animator, TOWN_LAYOUT, {
    quality: 'low',
    reducedMotion: true,
  });
  const petals = ambientLife.root.getObjectByName('particle_floating_petals');

  assert.ok(petals?.isPoints);
  assert.equal(petals.visible, true);

  for (let index = 0; index < 80; index += 1) animator.update(0.1, true);
  assert.equal(petals.material.opacity, 0);
  assert.equal(petals.visible, false);

  for (let index = 0; index < 80; index += 1) animator.update(0.1, false);
  assert.ok(petals.material.opacity > 0.62);
  assert.equal(petals.visible, true);

  ambientLife.dispose();
});

test('ambient life owns its callbacks, root, and unique render resources', () => {
  const animator = new WorldAnimator();
  let unrelatedUpdates = 0;
  const unrelated = animator.add(() => { unrelatedUpdates += 1; });
  const ambientLife = createAmbientLife(animator, TOWN_LAYOUT, {
    quality: 'low',
    reducedMotion: true,
  });
  const parent = new Group();
  parent.add(ambientLife.root);

  const geometries = new Set();
  const materials = new Set();
  ambientLife.root.traverse((object) => {
    if (object.geometry?.dispose) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    for (const material of objectMaterials) {
      if (material?.dispose) materials.add(material);
    }
  });
  assert.ok(geometries.size > 2);
  assert.ok(materials.size > 2);

  const disposalCounts = new Map();
  for (const resource of [...geometries, ...materials]) {
    const originalDispose = resource.dispose.bind(resource);
    resource.dispose = () => {
      disposalCounts.set(resource, (disposalCounts.get(resource) || 0) + 1);
      originalDispose();
    };
  }

  assert.ok(animator.animations.length > 1);
  ambientLife.dispose();
  ambientLife.dispose();

  assert.deepEqual(animator.animations, [unrelated]);
  assert.equal(ambientLife.root.parent, null);
  assert.equal(ambientLife.root.children.length, 0);
  assert.equal(parent.children.length, 0);
  for (const resource of [...geometries, ...materials]) {
    assert.equal(disposalCounts.get(resource), 1);
  }

  animator.update(0.1, false);
  assert.equal(unrelatedUpdates, 1);
  animator.remove(unrelated);
});

test('asset rollback restores v0.3 butterflies instead of the dragonfly pilot', () => {
  const animator = new WorldAnimator();
  const ambientLife = createAmbientLife(animator, TOWN_LAYOUT, {
    assetVariant: ASSET_VARIANTS.BASELINE,
    quality: 'low',
    reducedMotion: true,
  });

  assert.equal(ambientLife.dragonflies, null);
  const butterflies = ambientLife.root.getObjectByName('particle_butterflies');
  assert.equal(
    butterflies?.userData.system,
    'v0.3-butterflies',
  );
  assert.equal(
    ambientLife.root.children.filter((child) => child.name.startsWith('particle_butterfly_')).length,
    0,
    'legacy butterflies should remain grouped under their compatibility root',
  );
  assert.equal(
    butterflies.children.length,
    6,
  );

  const sharedResources = new Set();
  butterflies.traverse((object) => {
    if (object.geometry?.dispose) sharedResources.add(object.geometry);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material?.dispose) sharedResources.add(material);
    }
  });
  const disposalCounts = new Map();
  for (const resource of sharedResources) {
    const originalDispose = resource.dispose.bind(resource);
    resource.dispose = () => {
      disposalCounts.set(resource, (disposalCounts.get(resource) || 0) + 1);
      originalDispose();
    };
  }

  ambientLife.dispose();
  ambientLife.dispose();
  assert.equal(animator.animations.length, 0);
  assert.equal(ambientLife.root.children.length, 0);
  for (const resource of sharedResources) assert.equal(disposalCounts.get(resource), 1);
});

test('pooled shader particles skip zero-opacity weather systems', () => {
  const scene = new Scene();
  const vfx = new KawaiiVFX(scene, {
    weather: 'clear',
    fireflyCount: 2,
    petalCount: 2,
    sparkleCount: 2,
    drizzleCount: 2,
  }).init();
  const playerPosition = new Vector3(0, 1, 0);

  vfx.update(1 / 60, { isNight: false, weather: 'clear', playerPosition });
  assert.equal(vfx.drizzle.targetOpacity, 0);
  assert.equal(vfx.drizzle.points.visible, false);

  vfx.update(1 / 60, { isNight: false, weather: 'drizzle', playerPosition });
  assert.ok(vfx.drizzle.targetOpacity > 0);
  assert.equal(vfx.drizzle.points.visible, true);

  for (let index = 0; index < 240; index += 1) {
    vfx.update(1 / 60, { isNight: false, weather: 'clear', playerPosition });
  }
  assert.ok(vfx.drizzle.opacity < 0.003);
  assert.equal(vfx.drizzle.points.visible, false);

  vfx.dispose();
});
