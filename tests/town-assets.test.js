import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readGlbDocument(path) {
  const buffer = await readFile(new URL(path, import.meta.url));
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, `${path} is not a glTF binary`);
  assert.equal(buffer.readUInt32LE(4), 2, `${path} must use glTF 2.0`);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, `${path} has no JSON chunk`);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

test('the Blender cottage kit preserves every runtime placement root', async () => {
  const document = await readGlbDocument('../public/town/cottages/thornvale-cottages.glb');
  const names = new Set((document.nodes || []).map((node) => node.name));
  for (const name of [
    'Cottage_berry_bakery',
    'Cottage_lavender_library',
    'Cottage_mint_tea_house',
    'Cottage_rose_post_office',
  ]) {
    assert.ok(names.has(name), `missing authored cottage root ${name}`);
  }
  assert.equal(document.images?.length || 0, 0, 'cottage kit should remain texture-free');
});

test('the Blender village kit preserves each reusable landmark root', async () => {
  const document = await readGlbDocument('../public/village/thornvale-village-dressing.glb');
  const names = new Set((document.nodes || []).map((node) => node.name));
  for (const name of ['VillageWayfinder', 'GardenArch', 'StoneWell']) {
    assert.ok(names.has(name), `missing authored village prop root ${name}`);
  }
  assert.equal(document.images?.length || 0, 0, 'village kit should remain texture-free');
});
