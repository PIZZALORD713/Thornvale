import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { PropertyBinding } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { parseGlbJson } from '../scripts/probe-friendsies-trait.mjs';
import { STORY_ACTIONS_V1 } from '../src/content/story-actions-v1.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = resolve(ROOT, 'assets-src/friendsies-animations/story-actions-v1');
const RUNTIME_DIR = resolve(ROOT, 'public/animations/story-actions-v1');

function hash(data) {
  return createHash('sha256').update(data).digest('hex');
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function assertConstantTrack(track, label) {
  const stride = track.getValueSize();
  const baseline = Array.from(track.values.slice(0, stride));
  assert.equal(track.times.length, 2, `${label} should be optimized to two keys`);
  for (let offset = stride; offset < track.values.length; offset += stride) {
    const sample = Array.from(track.values.slice(offset, offset + stride));
    sample.forEach((value, index) => assert.ok(Math.abs(value - baseline[index]) <= 1e-6));
  }
}

function quaternionAngle(left, right) {
  const dot = Math.abs(left.reduce((sum, value, index) => sum + value * right[index], 0));
  const leftLength = Math.hypot(...left);
  const rightLength = Math.hypot(...right);
  const cosine = Math.min(1, Math.max(-1, dot / (leftLength * rightLength)));
  return 2 * Math.acos(cosine);
}

test('story-actions-v1 catalog, build report, and semantic content stay aligned', async () => {
  const source = JSON.parse(await readFile(resolve(SOURCE_DIR, 'clips.json'), 'utf8'));
  const report = JSON.parse(await readFile(resolve(SOURCE_DIR, 'build-report.json'), 'utf8'));
  const pack = JSON.parse(await readFile(resolve(RUNTIME_DIR, 'pack.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'assets-src/asset-manifest.json'), 'utf8'));

  assert.equal(source.id, STORY_ACTIONS_V1.id);
  assert.equal(report.id, STORY_ACTIONS_V1.id);
  assert.equal(pack.id, STORY_ACTIONS_V1.id);
  assert.equal(pack.rootMotionPolicy, 'strip-wrapper-translation-bake-bounded-root-rotation');
  assert.equal(pack.clips.length, 6);
  assert.equal(report.clips.length, 6);
  assert.equal(new Set(pack.clips.map((clip) => clip.id)).size, 6);
  assert.equal(new Set(pack.clips.map((clip) => clip.url)).size, 6);
  assert.deepEqual(
    sorted(pack.clips.map((clip) => clip.clipName)),
    sorted([
      ...Object.values(STORY_ACTIONS_V1.lumen),
      ...Object.values(STORY_ACTIONS_V1.dayOne).map((action) => action.clipName),
    ]),
  );

  for (const action of Object.values(STORY_ACTIONS_V1.dayOne)) {
    const entry = pack.clips.find((clip) => clip.id === action.id);
    assert.equal(entry.playback.durationSeconds, action.duration);
    assert.equal(entry.playback.commitSeconds, action.commitTime);
    assert.equal(entry.reducedMotion, action.reducedMotion);
  }

  for (const [key, pin] of Object.entries(report.toolchain.files)) {
    assert.equal(hash(await readFile(resolve(ROOT, pin.path))), pin.sha256, key);
  }
  assert.equal(report.toolchain.blenderVersion, '4.5.9 LTS');

  for (const sourceClip of source.clips) {
    const entry = pack.clips.find((clip) => clip.id === sourceClip.id);
    const build = report.clips.find((clip) => clip.id === sourceClip.id);
    const asset = manifest.assets.find((candidate) => (
      candidate.path === `public${sourceClip.runtime.url}`
    ));
    assert.ok(entry, sourceClip.id);
    assert.ok(build, sourceClip.id);
    assert.ok(asset, sourceClip.id);
    assert.equal(entry.clipName, sourceClip.clipName);
    assert.equal(entry.actor, sourceClip.actor);
    assert.equal(entry.url, sourceClip.runtime.url);
    assert.equal(entry.sha256, build.output.sha256);
    assert.equal(entry.sha256, build.deterministicRebuildSha256);
    assert.equal(entry.sha256, asset.sha256);
    assert.equal(entry.bytes, build.output.bytes);
    assert.equal(entry.bytes, asset.bytes);
    assert.equal(build.source.member, sourceClip.source.member);
    assert.equal(build.source.sha256, sourceClip.source.sha256);
    assert.equal(asset.source.sha256, sourceClip.source.sha256);
  }
});

test('all six outputs are deterministic animation-only clips for the canonical body', async () => {
  const pack = JSON.parse(await readFile(resolve(RUNTIME_DIR, 'pack.json'), 'utf8'));
  const body = parseGlbJson(await readFile(resolve(ROOT, 'public/friendsies/6602/body.glb')));
  const bodyTargets = new Set(body.skins[0].joints.map((index) => (
    PropertyBinding.sanitizeNodeName(body.nodes[index].name)
  )));
  assert.equal(bodyTargets.size, 20);

  for (const entry of pack.clips) {
    const data = await readFile(resolve(ROOT, `public${entry.url}`));
    assert.equal(data.length, entry.bytes, entry.id);
    assert.equal(hash(data), entry.sha256, entry.id);
    assert.equal(entry.sampleRate, 30);
    assert.equal(entry.sourceSampleRate, 60);

    const document = parseGlbJson(data);
    for (const field of ['meshes', 'materials', 'textures', 'images', 'skins', 'cameras']) {
      assert.equal(document[field]?.length || 0, 0, `${entry.id} must not ship ${field}`);
    }
    assert.equal(document.animations[0].channels.length, 60, entry.id);
    assert.equal(document.animations[0].samplers.length, 60, entry.id);
    assert.equal(
      document.nodes.some((node) => node.extensions?.KHR_lights_punctual),
      false,
      `${entry.id} must not ship light nodes`,
    );
    assert.deepEqual(document.animations.map((animation) => animation.name), [entry.clipName]);
    const targetNames = new Set(document.animations[0].channels.map((channel) => (
      PropertyBinding.sanitizeNodeName(document.nodes[channel.target.node].name)
    )));
    assert.deepEqual(sorted(targetNames), sorted(bodyTargets), entry.id);

    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const runtime = await new GLTFLoader().parseAsync(buffer, '');
    assert.deepEqual(runtime.animations.map((clip) => clip.name), [entry.clipName]);
    const tracks = runtime.animations[0].tracks;
    assert.equal(tracks.length, 60, entry.id);
    assert.deepEqual(
      sorted(tracks.map((track) => track.name)),
      sorted([...bodyTargets].flatMap((bone) => [
        `${bone}.position`,
        `${bone}.quaternion`,
        `${bone}.scale`,
      ])),
      entry.id,
    );
    for (const track of tracks) {
      assert.equal([...track.times, ...track.values].every(Number.isFinite), true, track.name);
      if (track.times.length <= 2) continue;
      for (let index = 1; index < track.times.length; index += 1) {
        const sampleIntervals = (track.times[index] - track.times[index - 1]) * 30;
        assert.ok(
          Math.abs(sampleIntervals - Math.round(sampleIntervals)) <= 1e-4,
          `${entry.id}/${track.name} left the 30 Hz sample grid`,
        );
      }
    }
    const rootTracks = tracks.filter((track) => track.name.startsWith('Root.'));
    assert.deepEqual(
      sorted(rootTracks.map((track) => track.name)),
      ['Root.position', 'Root.quaternion', 'Root.scale'],
    );
    assertConstantTrack(
      rootTracks.find((track) => track.name === 'Root.position'),
      `${entry.id}/Root.position`,
    );
    assertConstantTrack(
      rootTracks.find((track) => track.name === 'Root.scale'),
      `${entry.id}/Root.scale`,
    );
    const rotation = rootTracks.find((track) => track.name === 'Root.quaternion');
    const baseline = Array.from(rotation.values.slice(0, 4));
    let maximumAngle = 0;
    for (let offset = 0; offset < rotation.values.length; offset += 4) {
      maximumAngle = Math.max(
        maximumAngle,
        quaternionAngle(baseline, Array.from(rotation.values.slice(offset, offset + 4))),
      );
    }
    assert.ok(maximumAngle <= (75 * Math.PI / 180) + 1e-4, `${entry.id} root rotation escaped its bound`);
    assert.ok(
      quaternionAngle(baseline, Array.from(rotation.values.slice(-4))) <= 5e-4,
      `${entry.id} root rotation must return before the one-shot ends`,
    );
  }
});
