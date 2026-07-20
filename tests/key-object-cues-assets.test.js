import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { KEY_OBJECT_CUES_V1 } from '../src/content/key-object-cues-v1.js';

const MANIFEST_URL = new URL('../assets-src/asset-manifest.json', import.meta.url);
const FAMILY_ID = 'thornvale-key-object-cues-v1';

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

test('key-object cue family keeps generated sources and tiny local AVIF derivatives aligned', async () => {
  const manifest = JSON.parse(await readFile(MANIFEST_URL, 'utf8'));
  const family = manifest.families[FAMILY_ID];
  assert.equal(family.status, 'project-authored');
  assert.equal(family.releaseBlocked, false);
  assert.match(family.fallbackContract, /text.+cannot block/i);

  const runtime = manifest.assets.filter((asset) => asset.family === FAMILY_ID && asset.runtime);
  const sources = manifest.assets.filter((asset) => asset.family === FAMILY_ID && !asset.runtime);
  assert.equal(runtime.length, 3);
  assert.equal(sources.length, 3);
  assert.ok(runtime.reduce((total, asset) => total + asset.bytes, 0) <= 12 * 1024);
  assert.ok(sources.reduce((total, asset) => total + asset.bytes, 0) <= 25 * 1024 * 1024);

  const catalogPaths = new Set(Object.values(KEY_OBJECT_CUES_V1).map((cue) => cue.src));
  for (const asset of runtime) {
    const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(sha256(bytes), asset.sha256);
    assert.equal(bytes.subarray(4, 12).toString('ascii'), 'ftypavif');
    assert.deepEqual(asset.dimensions, { width: 128, height: 128 });
    assert.ok(asset.bytes <= 4 * 1024);
    assert.ok(catalogPaths.has(asset.path.replace(/^public/, '')));
  }

  for (const asset of sources) {
    const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(sha256(bytes), asset.sha256);
    assert.equal(asset.storage, 'git');
    assert.equal(asset.intakeBatch, '2026-07-19-key-object-cues-v1');
    assert.ok(asset.bytes <= manifest.policy.budgets.sourceBinaryMaxBytes);
  }

  await readFile(new URL('../assets-src/ui/key-object-cues-v1/SOURCE.md', import.meta.url));
  await readFile(new URL('../public/ui/key-object-cues/v1/PROVENANCE.md', import.meta.url));
  await readFile(new URL('../scripts/build-key-object-cues-v1.mjs', import.meta.url));
});
