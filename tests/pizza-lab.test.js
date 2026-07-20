import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { callTool, TOOL_DEFINITIONS, validateToolArguments } from '../tools/pizza-lab/mcp/server.mjs';
import { validatePizzaLabCandidate } from '../scripts/promote-pizza-lab-stage.mjs';
import { validatePizzaLabWayfinderCandidate } from '../scripts/promote-pizza-lab-wayfinder.mjs';
import { TOWN_LAYOUT } from '../src/config/town.js';

test('Pizza Lab exposes only the bounded v0.4 command surface', () => {
  assert.deepEqual(TOOL_DEFINITIONS.map((tool) => tool.name), [
    'pizza_scene_inspect',
    'pizza_scene_validate',
    'pizza_object_transform',
    'pizza_transaction_undo',
    'pizza_terrain_contract',
    'pizza_stage_load',
    'pizza_stage_publish',
    'pizza_world_stage_load',
    'pizza_wayfinder_candidate_export',
  ]);
  assert.equal(TOOL_DEFINITIONS.some((tool) => /python|delete|create/i.test(tool.name)), false);
});

test('transform schema requires stable IDs and finite vectors', () => {
  assert.throws(() => validateToolArguments('pizza_object_transform', {}), /gameId is required/);
  assert.throws(() => validateToolArguments('pizza_object_transform', {
    gameId: 'bell', location: [0, Number.NaN, 1],
  }), /finite numbers/);
  assert.throws(() => validateToolArguments('pizza_object_transform', {
    gameId: 'bell', arbitraryPython: 'import os',
  }), /Unknown argument/);
  assert.deepEqual(validateToolArguments('pizza_object_transform', {
    gameId: 'bell', location: [1, 2, 3], apply: false,
  }), { gameId: 'bell', location: [1, 2, 3], apply: false });
});

test('interactive bridge is localhost-only, authenticated, bounded, and main-thread queued', async () => {
  const source = await readFile(new URL('../tools/pizza-lab/blender_addon/pizza_lab/bridge.py', import.meta.url), 'utf8');
  assert.match(source, /\("127\.0\.0\.1", self\.port\)/);
  assert.match(source, /hmac\.compare_digest/);
  assert.match(source, /MAX_REQUEST_BYTES/);
  assert.match(source, /bpy\.app\.timers\.register/);
  assert.match(source, /bridge\.jobs\.put/);
});

test('ThornVale adapter preserves current axes and terrain authority', async () => {
  const adapter = JSON.parse(await readFile(new URL('../tools/pizza-lab/adapters/thornvale.json', import.meta.url), 'utf8'));
  assert.equal(adapter.blender.units, 'meters');
  assert.equal(adapter.blender.upAxis, '+Z');
  assert.equal(adapter.blender.authoredFront, '-Y');
  assert.equal(adapter.runtime.upAxis, '+Y');
  assert.match(adapter.terrain.authority, /src\/config\/town\.js/);
});

test('headless v0.4 rejects mutations that cannot be durably saved', async () => {
  const previous = process.env.PIZZA_LAB_MODE;
  process.env.PIZZA_LAB_MODE = 'headless';
  try {
    await assert.rejects(callTool('pizza_object_transform', {
      gameId: 'fixture-prop', location: [1, 2, 3], apply: true,
    }), /headless mode is read-only/);
    await assert.rejects(callTool('pizza_transaction_undo', { undoToken: 'token' }), /headless mode is read-only/);
    await assert.rejects(callTool('pizza_stage_load', { replace: true }), /headless mode is read-only/);
    await assert.rejects(callTool('pizza_stage_publish', {}), /headless mode is read-only/);
    await assert.rejects(callTool('pizza_world_stage_load', { replace: true }), /headless mode is read-only/);
  } finally {
    if (previous === undefined) delete process.env.PIZZA_LAB_MODE;
    else process.env.PIZZA_LAB_MODE = previous;
  }
});

test('stage promotion accepts only the hashed, grounded wayfinder contract', async () => {
  const candidate = JSON.parse(await readFile(new URL(
    '../assets-src/pizza-lab/staging/thornvale-town-v1.json', import.meta.url,
  ), 'utf8'));
  const placement = validatePizzaLabCandidate(candidate, candidate.source.sha256, TOWN_LAYOUT);
  assert.deepEqual(placement, {
    asset: 'VillageWayfinder', x: 0, y: 0, z: -6.4, rotationY: 0,
  });
  assert.throws(() => validatePizzaLabCandidate({
    ...candidate,
    placements: { ...candidate.placements, wayfinder: { ...candidate.placements.wayfinder, y: 1 } },
  }, candidate.source.sha256), /grounded/);
  assert.throws(() => validatePizzaLabCandidate(candidate, 'wrong-hash'), /source hash/);
  assert.throws(() => validatePizzaLabCandidate({
    ...candidate,
    placements: {
      ...candidate.placements,
      wayfinder: { ...candidate.placements.wayfinder, x: 14, z: -11 },
    },
  }, candidate.source.sha256, TOWN_LAYOUT), /berry-bakery clearance/);
});

test('Wayfinder promotion revalidates hashes, Draco geometry, and board envelopes', async () => {
  const read = (path) => readFile(new URL(path, import.meta.url));
  const [candidateBytes, authoringSource, generator, baseSource, worldStage, generatedText] = await Promise.all([
    read('../public/village/pilot/wayfinder/v1/thornvale-wayfinder.glb'),
    read('../assets-src/pizza-lab/wayfinder-v1/thornvale-wayfinder-authoring.blend'),
    read('../scripts/build-village-dressing.py'),
    read('../public/village/thornvale-village-dressing.glb'),
    read('../assets-src/pizza-lab/world-stage/thornvale-world-stage-v1.json'),
    readFile(new URL('../src/content/generated/pizza-lab-wayfinder-v1.json', import.meta.url), 'utf8'),
  ]);
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const generated = JSON.parse(generatedText);
  const world = JSON.parse(worldStage.toString('utf8'));
  const candidate = {
    schemaVersion: 1,
    id: 'thornvale-wayfinder-candidate-v1',
    family: 'thornvale-wayfinder-pizza-lab-v1',
    root: 'VillageWayfinder',
    baseSource: { path: 'public/village/thornvale-village-dressing.glb', sha256: digest(baseSource) },
    generator: { path: 'scripts/build-village-dressing.py', sha256: digest(generator) },
    worldStage: {
      path: 'assets-src/pizza-lab/world-stage/thornvale-world-stage-v1.json',
      sha256: digest(worldStage),
      layoutSha256: world.layoutSha256,
    },
    authoringSource: {
      path: 'assets-src/pizza-lab/wayfinder-v1/thornvale-wayfinder-authoring.blend',
      sha256: digest(authoringSource),
    },
    candidate: {
      path: 'output/pizza-lab/wayfinder-v1/thornvale-wayfinder-candidate.glb',
      sha256: digest(candidateBytes),
      bytes: generated.bytes,
      nodes: generated.nodes,
      meshes: generated.meshes,
      primitives: generated.primitives,
      materials: generated.materials,
      vertices: generated.vertices,
      triangles: generated.triangles,
    },
    boardOverrides: generated.boardOverrides,
  };
  const files = { candidate: candidateBytes, authoringSource, generator, baseSource, worldStage };
  assert.equal(validatePizzaLabWayfinderCandidate(candidate, files).triangles, 1488);
  const invalid = structuredClone(candidate);
  invalid.boardOverrides['01'].after.scale = [2, 1, 1];
  assert.throws(() => validatePizzaLabWayfinderCandidate(invalid, files), /scale exceeds/);
});
