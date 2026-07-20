import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { callTool, TOOL_DEFINITIONS, validateToolArguments } from '../tools/pizza-lab/mcp/server.mjs';
import { validatePizzaLabCandidate } from '../scripts/promote-pizza-lab-stage.mjs';
import { TOWN_LAYOUT } from '../src/config/town.js';

test('Pizza Lab exposes only the bounded v0.3 command surface', () => {
  assert.deepEqual(TOOL_DEFINITIONS.map((tool) => tool.name), [
    'pizza_scene_inspect',
    'pizza_scene_validate',
    'pizza_object_transform',
    'pizza_transaction_undo',
    'pizza_terrain_contract',
    'pizza_stage_load',
    'pizza_stage_publish',
    'pizza_world_stage_load',
  ]);
  assert.equal(TOOL_DEFINITIONS.some((tool) => /python|delete|export|create/i.test(tool.name)), false);
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

test('headless v0.3 rejects mutations that cannot be durably saved', async () => {
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
