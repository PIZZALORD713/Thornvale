import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

import { minifyDracoDecoderSource } from '../vite.config.js';

async function extractDracoBytes(path) {
  const glb = await readFile(path);
  const jsonLength = glb.readUInt32LE(12);
  const jsonStart = 20;
  const json = JSON.parse(glb.subarray(jsonStart, jsonStart + jsonLength).toString('utf8'));
  const binHeader = jsonStart + jsonLength;
  const binLength = glb.readUInt32LE(binHeader);
  const binStart = binHeader + 8;
  const compressedView = json.bufferViews.find(
    (view) => view.extensions?.KHR_draco_mesh_compression,
  );

  // Three.js-generated GLBs store the Draco payload on the primitive extension,
  // while its bufferView points at the compressed binary range.
  const primitive = json.meshes
    .flatMap((mesh) => mesh.primitives)
    .find((entry) => entry.extensions?.KHR_draco_mesh_compression);
  const bufferViewIndex =
    compressedView?.extensions?.KHR_draco_mesh_compression?.bufferView
    ?? primitive?.extensions?.KHR_draco_mesh_compression?.bufferView;
  assert.notEqual(bufferViewIndex, undefined, 'fixture should contain a Draco buffer view');

  const view = json.bufferViews[bufferViewIndex];
  assert.ok(view, 'Draco buffer view should resolve');
  assert.ok(view.byteOffset + view.byteLength <= binLength, 'Draco payload should fit the GLB binary chunk');
  return glb.subarray(binStart + (view.byteOffset || 0), binStart + (view.byteOffset || 0) + view.byteLength);
}

async function decodeDraco(code, bytes) {
  const context = vm.createContext({
    console,
    setTimeout,
    clearInterval,
    TextDecoder,
  });
  vm.runInContext(code, context, { timeout: 5_000 });
  const createDecoder = vm.runInContext('DracoDecoderModule', context);
  assert.equal(typeof createDecoder, 'function', 'DracoDecoderModule must remain a global factory');
  const module = await createDecoder({});
  const buffer = new module.DecoderBuffer();
  const decoder = new module.Decoder();
  const mesh = new module.Mesh();

  try {
    buffer.Init(new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), bytes.byteLength);
    const status = decoder.DecodeBufferToMesh(buffer, mesh);
    const result = {
      ok: status.ok(),
      points: mesh.num_points(),
      faces: mesh.num_faces(),
    };
    module.destroy(status);
    return result;
  } finally {
    module.destroy(mesh);
    module.destroy(decoder);
    module.destroy(buffer);
  }
}

test('identifier-mangled production Draco preserves its global factory and fallback decoding', { timeout: 15_000 }, async () => {
  const original = await readFile(
    new URL('../public/draco/draco_decoder.js', import.meta.url),
    'utf8',
  );
  const unmangled = await minifyDracoDecoderSource(original, { mangleIdentifiers: false });
  const minified = await minifyDracoDecoderSource(original);
  const bytes = await extractDracoBytes(
    new URL('../public/friendsies/8914/body.glb', import.meta.url),
  );

  assert.ok(
    Buffer.byteLength(original) - Buffer.byteLength(minified) >= 60 * 1024,
    'production transform should recover at least 60 KiB without changing the source asset',
  );
  assert.ok(
    Buffer.byteLength(unmangled) - Buffer.byteLength(minified) >= 38 * 1024,
    'identifier mangling should recover at least 38 KiB beyond compression alone',
  );
  assert.match(minified, /DracoDecoderModule/);

  const baseline = await decodeDraco(original, bytes);
  const candidate = await decodeDraco(minified, bytes);
  assert.deepEqual(candidate, baseline);
  assert.deepEqual(candidate, { ok: true, points: 2_800, faces: 4_800 });
});
