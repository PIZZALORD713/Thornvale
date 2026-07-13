import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  inspectGlb,
  parseGlbJson,
} from '../scripts/probe-friendsies-trait.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FAMILY_DIR = resolve(ROOT, 'public/friendsies/6602');
const MODELS = Object.freeze({
  'backpiece-ghostin.glb': 2_518,
  'body.glb': 4_800,
  'hand-staffv.glb': 814,
  'head-deli.glb': 672,
  'shoes-high-boots-red.glb': 2_464,
  'sprout-totem.glb': 1_088,
});

test('fRiENDSiES #6602 keeps one compatible 20-joint rig across every part', async () => {
  let expectedJoints = null;
  let totalTriangles = 0;

  for (const [filename, triangles] of Object.entries(MODELS)) {
    const data = await readFile(resolve(FAMILY_DIR, filename));
    const report = inspectGlb(data);
    const document = parseGlbJson(data);
    const skin = document.skins?.[0];
    const joints = skin?.joints?.map((nodeIndex) => document.nodes?.[nodeIndex]?.name);

    assert.equal(report.format, 'glTF 2.0 binary', filename);
    assert.equal(report.counts.meshes, 1, filename);
    assert.equal(report.counts.primitives, 1, filename);
    assert.equal(report.counts.triangles, triangles, filename);
    assert.equal(report.counts.skins, 1, filename);
    assert.equal(report.counts.uniqueJoints, 20, filename);
    assert.deepEqual(report.extensionsRequired, ['EXT_texture_webp'], filename);
    assert.equal(joints.length, 20, filename);
    assert.ok(joints.includes('Root'), filename);
    assert.ok(joints.includes('Head'), filename);
    assert.ok(joints.includes('Attachment.L'), filename);
    assert.ok(joints.includes('Attachment.R'), filename);

    expectedJoints ??= joints;
    assert.deepEqual(joints, expectedJoints, `${filename} must match the body skeleton`);
    totalTriangles += triangles;
  }

  assert.equal(totalTriangles, 12_356);
});

test('the #6602 body retains its authored idle clip', async () => {
  const document = parseGlbJson(await readFile(resolve(FAMILY_DIR, 'body.glb')));
  assert.deepEqual(document.animations?.map((clip) => clip.name), ['Idle Float.001']);
});

test('startup stays fRiENDSiES-first and reserves the code-native avatar for total load failure', async () => {
  const [main, safeAvatar] = await Promise.all([
    readFile(resolve(ROOT, 'src/main.js'), 'utf8'),
    readFile(resolve(ROOT, 'src/visuals/KawaiiAvatar.js'), 'utf8'),
  ]);

  assert.match(main, /DEFAULT_PLAYER_FRIENDSIES_TOKEN_ID/);
  assert.match(main, /recoverMissingCharacterVisuals/);
  assert.match(main, /createKawaiiAvatar/);
  assert.doesNotMatch(main, /avatar=local/);

  const bundledFallbackAttempts = main.indexOf(
    'for (const fallbackTokenId of PLAYER_FRIENDSIES_FALLBACK_TOKEN_IDS)',
  );
  const stewardResolution = main.indexOf('let stewardVisual = await stewardPromise;');
  const safetyRecovery = main.indexOf('recoverMissingCharacterVisuals({');
  assert.ok(bundledFallbackAttempts >= 0);
  assert.ok(stewardResolution > bundledFallbackAttempts);
  assert.ok(safetyRecovery > stewardResolution);

  assert.doesNotMatch(
    safeAvatar,
    /GLTFLoader|DRACOLoader|TextureLoader|fetch\s*\(/,
    'the final safety visual must not share model, decoder, texture, or network loading',
  );
});
