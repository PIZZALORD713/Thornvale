import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PropertyBinding } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { parseGlbJson } from '../scripts/probe-friendsies-trait.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ANIMATION_DIR = resolve(ROOT, 'public/animations');
const BODY_PATH = resolve(ROOT, 'public/friendsies/6602/body.glb');

const SHIPPED_CLIPS = Object.freeze({
  'friendsies-walk.glb': Object.freeze([
    Object.freeze({ name: 'walk-high-arms', duration: 85 / 60 }),
    Object.freeze({ name: 'walk-low-arms', duration: 80 / 60 }),
  ]),
  'friendsies-joy-jump.glb': Object.freeze([
    Object.freeze({ name: 'Joy-Jumper', duration: 114 / 60 }),
  ]),
  'friendsies-dance-rumba.glb': Object.freeze([
    Object.freeze({ name: 'Dance_Rumba', duration: 144 / 60 }),
  ]),
});

const inspections = new Map();

async function inspectAnimationGlb(filename) {
  if (!inspections.has(filename)) {
    inspections.set(filename, (async () => {
      const data = await readFile(resolve(ANIMATION_DIR, filename));
      const document = parseGlbJson(data);
      const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const runtime = await new GLTFLoader().parseAsync(arrayBuffer, '');
      return { document, runtime };
    })());
  }
  return inspections.get(filename);
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function animationTargetNames(document, animation) {
  return new Set((animation.channels || []).map((channel) => (
    document.nodes?.[channel.target?.node]?.name
  )).filter(Boolean));
}

function assertConstantTrack(track, message) {
  const stride = track.getValueSize();
  const baseline = Array.from(track.values.slice(0, stride));
  assert.equal(track.times.length, 2, `${message} must retain its two-key root track`);
  for (let offset = stride; offset < track.values.length; offset += stride) {
    const sample = Array.from(track.values.slice(offset, offset + stride));
    sample.forEach((value, index) => {
      assert.ok(
        Math.abs(value - baseline[index]) <= 1e-6,
        `${message} root sample ${offset / stride} component ${index} moved`,
      );
    });
  }
}

test('the shipped animation GLBs retain their exact animation-only clip contract', async () => {
  for (const [filename, expectedClips] of Object.entries(SHIPPED_CLIPS)) {
    const { document, runtime } = await inspectAnimationGlb(filename);

    assert.equal(document.asset?.version, '2.0', filename);
    for (const field of ['meshes', 'materials', 'textures', 'images', 'skins']) {
      assert.equal(document[field]?.length || 0, 0, `${filename} must not ship ${field}`);
    }
    assert.deepEqual(
      document.animations?.map((clip) => clip.name),
      expectedClips.map((clip) => clip.name),
      filename,
    );
    assert.deepEqual(
      runtime.animations.map((clip) => clip.name),
      expectedClips.map((clip) => clip.name),
      `${filename} GLTFLoader clip names`,
    );

    expectedClips.forEach((expected, index) => {
      assert.ok(
        Math.abs(runtime.animations[index].duration - expected.duration) <= 1e-5,
        `${filename}/${expected.name} duration ${runtime.animations[index].duration}`,
      );
    });
  }
});

test('every shipped clip targets the bundled body skeleton and carries no root displacement', async () => {
  const body = parseGlbJson(await readFile(BODY_PATH));
  const bodySkin = body.skins?.[0];
  const bodyTargets = new Set((bodySkin?.joints || []).map((nodeIndex) => (
    PropertyBinding.sanitizeNodeName(body.nodes?.[nodeIndex]?.name || '')
  )).filter(Boolean));
  assert.equal(bodyTargets.size, 20, 'the bundled player body must expose the canonical 20 joints');

  for (const [filename] of Object.entries(SHIPPED_CLIPS)) {
    const { document, runtime } = await inspectAnimationGlb(filename);

    for (const animation of document.animations || []) {
      const targets = new Set([...animationTargetNames(document, animation)].map((name) => (
        PropertyBinding.sanitizeNodeName(name)
      )));
      assert.deepEqual(
        sorted(targets),
        sorted(bodyTargets),
        `${filename}/${animation.name} must target the bundled body's normalized joints`,
      );
    }

    for (const clip of runtime.animations) {
      const rootTracks = clip.tracks.filter((track) => track.name.startsWith('Root.'));
      assert.deepEqual(
        sorted(rootTracks.map((track) => track.name)),
        ['Root.position', 'Root.quaternion', 'Root.scale'],
        `${filename}/${clip.name} root channels`,
      );
      rootTracks.forEach((track) => assertConstantTrack(track, `${filename}/${clip.name}`));
    }
  }
});
