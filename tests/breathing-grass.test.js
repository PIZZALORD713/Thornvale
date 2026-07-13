import test from 'node:test';
import assert from 'node:assert/strict';

import { Color, Group, InstancedMesh } from 'three';
import { TOWN_LAYOUT } from '../src/config/town.js';
import { ASSET_VARIANTS } from '../src/config/assets.js';
import { createGroundDressing } from '../src/visuals/CozyTownKit.js';
import {
  BreathingGrass,
  GRASS_QUALITY_COUNTS,
  GRASS_TIME_WRAP_SECONDS,
  generateGrassPlacements,
  injectBreathingGrassShader,
  isGrassPlacementAllowed,
  normalizeGrassQuality,
  wrapGrassTime,
} from '../src/visuals/BreathingGrass.js';
import { WorldAnimator } from '../src/visuals/WorldAnimator.js';

function connectedComponentSizes(placements, threshold = 0.62) {
  const thresholdSquared = threshold * threshold;
  const remaining = new Set(placements.map((_, index) => index));
  const sizes = [];

  while (remaining.size > 0) {
    const [first] = remaining;
    remaining.delete(first);
    const queue = [first];
    let size = 0;

    while (queue.length > 0) {
      const index = queue.pop();
      const origin = placements[index];
      size += 1;
      for (const candidate of [...remaining]) {
        const other = placements[candidate];
        const dx = origin.x - other.x;
        const dz = origin.z - other.z;
        if (dx * dx + dz * dz > thresholdSquared) continue;
        remaining.delete(candidate);
        queue.push(candidate);
      }
    }
    sizes.push(size);
  }

  return sizes.sort((left, right) => left - right);
}

test('quality tiers stay deterministic and inside their draw budgets', () => {
  assert.deepEqual(GRASS_QUALITY_COUNTS, {
    low: 192,
    medium: 432,
    high: 800,
  });
  assert.equal(normalizeGrassQuality('LOW'), 'low');
  assert.equal(normalizeGrassQuality('medium'), 'medium');
  assert.equal(normalizeGrassQuality('cinematic'), 'high');

  for (const [quality, count] of Object.entries(GRASS_QUALITY_COUNTS)) {
    const placements = generateGrassPlacements(TOWN_LAYOUT, { count, seed: 260712 });
    assert.equal(placements.length, count, quality);
    assert.ok(placements.every(({ x, z }) => isGrassPlacementAllowed(x, z, TOWN_LAYOUT)));
  }
});

test('placement generation is repeatable for one seed and varies for another', () => {
  const first = generateGrassPlacements(TOWN_LAYOUT, { count: 80, seed: 77 });
  const repeated = generateGrassPlacements(TOWN_LAYOUT, { count: 80, seed: 77 });
  const changed = generateGrassPlacements(TOWN_LAYOUT, { count: 80, seed: 78 });
  assert.deepEqual(repeated, first);
  assert.notDeepEqual(changed, first);
});

test('every supported quality resolves its exact count across representative seeds', () => {
  for (const seed of [0, 1, 77, 260712, 0xffffffff]) {
    for (const count of Object.values(GRASS_QUALITY_COUNTS)) {
      const placements = generateGrassPlacements(TOWN_LAYOUT, { count, seed });
      assert.equal(placements.length, count, `seed ${seed}, count ${count}`);
      assert.ok(placements.every(({ x, z }) => isGrassPlacementAllowed(x, z, TOWN_LAYOUT)));
    }
  }
});

test('the meadow spends its fixed budget on 4-7 tuft clusters plus restrained scatter', () => {
  for (const [quality, count] of Object.entries(GRASS_QUALITY_COUNTS)) {
    const placements = generateGrassPlacements(TOWN_LAYOUT, { count, seed: 260712 });
    const components = connectedComponentSizes(placements);
    const solitaryCount = components.filter((size) => size === 1).length;
    const clusterSizes = components.filter((size) => size > 1);
    const solitaryRatio = solitaryCount / count;

    assert.ok(
      solitaryRatio >= 0.20 && solitaryRatio <= 0.25,
      `${quality} solitary ratio ${solitaryRatio.toFixed(3)} left the 20-25% contract`,
    );
    assert.ok(clusterSizes.length > 0, `${quality} should contain authored clusters`);
    assert.ok(
      clusterSizes.every((size) => size >= 4 && size <= 7),
      `${quality} component sizes: ${components.join(', ')}`,
    );
  }
});

test('the meadow mask protects paths, plaza, cottages, pond, and interaction landmarks', () => {
  assert.equal(isGrassPlacementAllowed(TOWN_LAYOUT.plaza.x, TOWN_LAYOUT.plaza.z), false);
  assert.equal(isGrassPlacementAllowed(TOWN_LAYOUT.pond.x, TOWN_LAYOUT.pond.z), false);
  for (const building of TOWN_LAYOUT.buildings) {
    assert.equal(
      isGrassPlacementAllowed(building.position.x, building.position.z),
      false,
      building.id,
    );
  }
  for (const landmark of Object.values(TOWN_LAYOUT.landmarks)) {
    assert.equal(isGrassPlacementAllowed(landmark.x, landmark.z), false);
  }
  for (const path of TOWN_LAYOUT.paths) {
    for (const point of path.points) {
      assert.equal(isGrassPlacementAllowed(point[0], point[1]), false, path.id);
    }
  }
  for (const [routeId, points] of Object.entries(TOWN_LAYOUT.storyRoutes)) {
    for (const point of points) {
      assert.equal(isGrassPlacementAllowed(point[0], point[2]), false, routeId);
    }
  }
  assert.equal(isGrassPlacementAllowed(-28, 20, TOWN_LAYOUT), true);
});

test('one low-poly instanced mesh owns all blades and matrices remain static per frame', () => {
  const animator = new WorldAnimator();
  const grass = new BreathingGrass({
    animator,
    layout: TOWN_LAYOUT,
    quality: 'medium',
    seed: 11,
  });

  assert.ok(grass.mesh instanceof InstancedMesh);
  assert.equal(grass.mesh.count, GRASS_QUALITY_COUNTS.medium);
  assert.equal(grass.drawCallCount, 1);
  assert.equal(grass.mesh.userData.cameraCollision, false);
  assert.equal(grass.mesh.userData.physicsCollision, false);
  assert.ok(grass.mesh.geometry.getAttribute('position').count <= 24);
  assert.ok(grass.mesh.geometry.getIndex().count / 3 <= 18);
  assert.ok(grass.mesh.geometry.boundingBox.max.y >= 0.44);
  assert.ok(grass.mesh.geometry.boundingBox.max.y <= 0.46);
  const positions = grass.mesh.geometry.getAttribute('position');
  const baseWidths = [0, 5, 10].map((index) => Math.hypot(
    positions.getX(index + 1) - positions.getX(index),
    positions.getZ(index + 1) - positions.getZ(index),
  ));
  assert.deepEqual(baseWidths.map((width) => Number(width.toFixed(3))), [
    0.083,
    0.074,
    0.078,
  ]);
  assert.equal(grass.mesh.geometry.getAttribute('color'), undefined);
  assert.equal(grass.mesh.material.vertexColors, false);
  assert.equal(grass.mesh.material.color.getHex(), 0xffffff);
  assert.ok(grass.mesh.instanceColor, 'instance colors should supply the tuft palette');
  const observedColors = new Set();
  const color = new Color();
  for (let index = 0; index < grass.mesh.count; index += 1) {
    grass.mesh.getColorAt(index, color);
    observedColors.add(color.getHex());
  }
  assert.deepEqual([...observedColors].sort((left, right) => left - right), [
    0x66845f,
    0x78966c,
    0x8ba47a,
  ]);
  assert.equal(animator.animations.length, 1);
  assert.deepEqual(Object.keys(grass.uniforms).sort(), ['uGrassMotion', 'uGrassTime']);

  const matrixVersion = grass.mesh.instanceMatrix.version;
  const beforeTime = grass.uniforms.uGrassTime.value;
  animator.update(0.1, false);
  assert.notEqual(grass.uniforms.uGrassTime.value, beforeTime);
  assert.equal(grass.mesh.instanceMatrix.version, matrixVersion);
  grass.dispose();
});

test('shader injection bends tips then suppresses near-camera grass occlusion', () => {
  const uniforms = {
    uGrassTime: { value: 0 },
    uGrassMotion: { value: 1 },
  };
  const shader = {
    uniforms: {},
    vertexShader: '#include <common>\nvoid main() {\n#include <begin_vertex>\n}',
  };
  injectBreathingGrassShader(shader, uniforms);

  assert.equal(shader.uniforms.uGrassTime, uniforms.uGrassTime);
  assert.equal(shader.uniforms.uGrassMotion, uniforms.uGrassMotion);
  assert.match(shader.vertexShader, /grassWorldOrigin/);
  assert.match(shader.vertexShader, /grassWaveA/);
  assert.match(shader.vertexShader, /grassWaveB/);
  assert.match(shader.vertexShader, /grassTip \* grassTip/);
  assert.match(shader.vertexShader, /uGrassMotion/);
  assert.match(
    shader.vertexShader,
    /transformed\.x \+= \(grassWaveA \* 0\.038 \+ grassWaveB \* 0\.016\)/,
  );
  assert.match(
    shader.vertexShader,
    /transformed\.z \+= \(grassWaveA \* 0\.016 - grassWaveB \* 0\.018\)/,
  );
  assert.match(
    shader.vertexShader,
    /length\(\(viewMatrix \* grassWorldOrigin\)\.xyz\)/,
  );
  assert.match(
    shader.vertexShader,
    /smoothstep\(3\.0, 7\.0, grassCameraDistance\)/,
  );
  assert.match(shader.vertexShader, /transformed \*= grassNearScale/);
  const lastBend = shader.vertexShader.indexOf('transformed.y +=');
  const cameraDistance = shader.vertexShader.indexOf('float grassCameraDistance');
  const nearScale = shader.vertexShader.indexOf('float grassNearScale');
  const scaleApplication = shader.vertexShader.indexOf('transformed *= grassNearScale');
  assert.ok(lastBend >= 0 && lastBend < cameraDistance);
  assert.ok(cameraDistance < nearScale && nearScale < scaleApplication);
  assert.doesNotMatch(shader.vertexShader, /instanceMatrix\s*=/);
});

test('wrapped shader time stays finite and periodic through a simulated six-hour clock', () => {
  const sixHours = 6 * 60 * 60;
  const wrapped = wrapGrassTime(sixHours);
  assert.ok(Number.isFinite(wrapped));
  assert.ok(wrapped >= 0 && wrapped < GRASS_TIME_WRAP_SECONDS);
  assert.ok(Math.abs(wrapGrassTime(GRASS_TIME_WRAP_SECONDS)) < 1e-10);
  assert.ok(Math.abs(wrapGrassTime(GRASS_TIME_WRAP_SECONDS * 2 + 0.75) - 0.75) < 1e-10);
  assert.equal(wrapGrassTime(Number.POSITIVE_INFINITY), 0);

  const grass = new BreathingGrass({ quality: 'low' });
  grass.setTime(sixHours);
  assert.equal(grass.uniforms.uGrassTime.value, wrapped);
  assert.ok(Number.isFinite(grass.uniforms.uGrassTime.value));
  grass.dispose();
});

test('reduced motion is static and disposal unregisters the shared updater', () => {
  const animator = new WorldAnimator();
  const parent = new Group();
  const grass = new BreathingGrass({ animator, reducedMotion: true, quality: 'low' });
  parent.add(grass.mesh);
  const matrixVersion = grass.mesh.instanceMatrix.version;

  assert.equal(grass.uniforms.uGrassMotion.value, 0);
  assert.equal(animator.animations.length, 0);
  grass.setTime(120);
  animator.update(0.1, false);
  assert.equal(grass.uniforms.uGrassTime.value, 0);
  assert.equal(grass.mesh.instanceMatrix.version, matrixVersion);

  let geometryDisposed = 0;
  let materialDisposed = 0;
  grass.mesh.geometry.dispose = () => { geometryDisposed += 1; };
  grass.mesh.material.dispose = () => { materialDisposed += 1; };
  grass.dispose();
  grass.dispose();
  assert.equal(geometryDisposed, 1);
  assert.equal(materialDisposed, 1);
  assert.equal(grass.mesh.parent, null);

  const moving = new BreathingGrass({ animator, reducedMotion: false, quality: 'low' });
  assert.equal(animator.animations.length, 1);
  moving.dispose();
  assert.equal(animator.animations.length, 0);
});

test('asset rollback restores the bounded v0.3 grass tufts', () => {
  const animator = new WorldAnimator();
  const terrain = createGroundDressing(animator, TOWN_LAYOUT, {
    assetVariant: ASSET_VARIANTS.BASELINE,
    quality: 'high',
  });
  const legacyTufts = terrain.getObjectByName('particle_grass_tufts');

  assert.equal(terrain.breathingGrass, null);
  assert.ok(legacyTufts instanceof InstancedMesh);
  assert.equal(legacyTufts.count, 64);
  assert.equal(animator.animations.length, 0);
});
