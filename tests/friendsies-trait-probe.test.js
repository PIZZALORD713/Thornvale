import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  assertFriendsiesGlbUrl,
  findTraitEntry,
  inspectGlb,
  parseGlbJson,
  runProbeCli,
  selectTraitVariant,
} from '../scripts/probe-friendsies-trait.mjs';

const JSON_CHUNK_TYPE = 0x4e4f534a;
const BIN_CHUNK_TYPE = 0x004e4942;

function paddedBuffer(value, fill = 0x20) {
  const source = Buffer.isBuffer(value) ? value : Buffer.from(value);
  const padding = (4 - (source.length % 4)) % 4;
  return padding === 0 ? source : Buffer.concat([source, Buffer.alloc(padding, fill)]);
}

function makeChunk(type, payload, fill) {
  const body = paddedBuffer(payload, fill);
  const header = Buffer.alloc(8);
  header.writeUInt32LE(body.length, 0);
  header.writeUInt32LE(type, 4);
  return Buffer.concat([header, body]);
}

function makeGlb(document, binary = null) {
  const chunks = [makeChunk(JSON_CHUNK_TYPE, JSON.stringify(document), 0x20)];
  if (binary) chunks.push(makeChunk(BIN_CHUNK_TYPE, binary, 0));
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(header.length + body.length, 8);
  return Buffer.concat([header, body]);
}

function singlePrimitiveDocument(overrides = {}) {
  return {
    asset: { version: '2.0', generator: 'offline-test' },
    accessors: [{ count: 6 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    nodes: [{ mesh: 0 }],
    scenes: [{ nodes: [0] }],
    scene: 0,
    ...overrides,
  };
}

test('parseGlbJson reads a padded glTF 2.0 JSON chunk without rendering', () => {
  const document = singlePrimitiveDocument();
  const glb = makeGlb(document, Buffer.from([1, 2, 3]));
  assert.deepEqual(parseGlbJson(glb), document);
  assert.deepEqual(parseGlbJson(new Uint8Array(glb)), document);
});

test('parseGlbJson rejects invalid and truncated containers', () => {
  const valid = makeGlb(singlePrimitiveDocument());
  const badMagic = Buffer.from(valid);
  badMagic.writeUInt32LE(0, 0);
  assert.throws(() => parseGlbJson(badMagic), /magic is invalid/);

  const badVersion = Buffer.from(valid);
  badVersion.writeUInt32LE(1, 4);
  assert.throws(() => parseGlbJson(badVersion), /version 1 is unsupported/);

  assert.throws(() => parseGlbJson(valid.subarray(0, -1)), /declared length/);

  const missingJsonBody = makeChunk(BIN_CHUNK_TYPE, Buffer.from([1, 2, 3, 4]), 0);
  const missingJson = Buffer.alloc(12);
  missingJson.writeUInt32LE(0x46546c67, 0);
  missingJson.writeUInt32LE(2, 4);
  missingJson.writeUInt32LE(12 + missingJsonBody.length, 8);
  assert.throws(
    () => parseGlbJson(Buffer.concat([missingJson, missingJsonBody])),
    /does not contain an object JSON chunk/,
  );
});

test('inspectGlb reports byte, hash, geometry, rig, animation, and texture counts', () => {
  const document = {
    asset: { version: '2.0', generator: 'synthetic-suite' },
    accessors: [
      { count: 6 },
      { count: 5 },
      { count: 4 },
    ],
    meshes: [{
      primitives: [
        { indices: 0, attributes: { POSITION: 0 }, material: 0 },
        { mode: 5, attributes: { POSITION: 1 }, material: 1 },
        { mode: 6, attributes: { POSITION: 2 }, material: 1 },
      ],
    }],
    nodes: [{ mesh: 0 }],
    materials: [{}, {}],
    textures: [{ source: 0 }],
    images: [{ uri: 'data:image/png;base64,AA==' }],
    animations: [{ channels: [], samplers: [] }],
    extensionsUsed: ['KHR_draco_mesh_compression', 'KHR_draco_mesh_compression'],
  };
  const glb = makeGlb(document);
  const report = inspectGlb(glb);

  assert.equal(report.bytes, glb.length);
  assert.equal(report.sha256, createHash('sha256').update(glb).digest('hex'));
  assert.equal(report.generator, 'synthetic-suite');
  assert.deepEqual(report.counts, {
    meshes: 1,
    primitives: 3,
    triangles: 7,
    skins: 0,
    joints: 0,
    uniqueJoints: 0,
    animations: 1,
    materials: 2,
    textures: 1,
    images: 1,
    nodes: 1,
    meshNodes: 1,
    skinnedMeshNodes: 0,
    morphTargets: 0,
  });
  assert.deepEqual(report.extensionsUsed, ['KHR_draco_mesh_compression']);
  assert.equal(report.compatibility.classification, 'review');
});

test('single rigid-looking primitives are candidates, not proven rigid assets', () => {
  const unskinned = inspectGlb(makeGlb(singlePrimitiveDocument()));
  assert.equal(unskinned.compatibility.classification, 'rigid-candidate');
  assert.match(unskinned.compatibility.reasons[0], /Single unskinned primitive/);

  const skinnedDocument = singlePrimitiveDocument({
    accessors: [{ count: 6 }, { count: 6 }, { count: 6 }],
    meshes: [{ primitives: [{
      attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 },
    }] }],
    nodes: [{ mesh: 0, skin: 0 }],
    skins: [{ joints: [1, 2, 3] }],
  });
  const skinned = inspectGlb(makeGlb(skinnedDocument));
  assert.equal(skinned.counts.skins, 1);
  assert.equal(skinned.counts.joints, 3);
  assert.equal(skinned.compatibility.classification, 'rigid-candidate');
  assert.match(skinned.compatibility.reasons[0], /decoded weights must still prove/);
});

test('morph targets classify as deformable and non-triangle primitives as unsupported', () => {
  const deformableDocument = singlePrimitiveDocument({
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, targets: [{ POSITION: 1 }] }] }],
  });
  assert.equal(
    inspectGlb(makeGlb(deformableDocument)).compatibility.classification,
    'deformable',
  );

  const lineDocument = singlePrimitiveDocument({
    meshes: [{ primitives: [{ mode: 1, attributes: { POSITION: 0 } }] }],
  });
  const lines = inspectGlb(makeGlb(lineDocument));
  assert.equal(lines.counts.triangles, null);
  assert.equal(lines.compatibility.classification, 'unsupported');
});

test('exact trait and variant selection supports the flat generated index schema', () => {
  const index = {
    schemaVersion: 1,
    traits: [
      {
        id: 'sprout:Friends Key',
        traitType: 'sprout',
        value: 'Friends Key',
        variants: [
          {
            assetUrl: 'https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.glb',
            previewUrl: 'https://storage.googleapis.com/friendsies-v2-assets-d8088d/previews/one.png',
            tokenIds: [431],
          },
          {
            assetUrl: 'https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.glb',
            previewUrl: 'https://storage.googleapis.com/friendsies-v2-assets-d8088d/previews/two.png',
            tokenIds: [9000],
          },
        ],
      },
    ],
  };

  const entry = findTraitEntry(index, 'sprout', 'Friends Key');
  assert.equal(entry.key, 'sprout:Friends Key');
  assert.equal(selectTraitVariant(entry).index, 0);
  assert.equal(selectTraitVariant(entry, '1').index, 1);
  assert.equal(
    selectTraitVariant(entry, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb').index,
    1,
  );
  assert.throws(() => findTraitEntry(index, 'sprout', 'friends key'), /not found/);
  assert.throws(
    () => selectTraitVariant(entry, 'missing'),
    /available variants: a{32}, b{32}/,
  );
});

test('probe URL validation accepts only pinned fRiENDSiES GLB assets', () => {
  const accepted = assertFriendsiesGlbUrl(
    'https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/abc.glb',
  );
  assert.equal(accepted.pathname, '/friendsies-v2-assets-d8088d/assets/abc.glb');
  assert.throws(
    () => assertFriendsiesGlbUrl('https://example.com/abc.glb'),
    /outside the pinned/,
  );
  assert.throws(
    () => assertFriendsiesGlbUrl(
      'https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/face.png',
    ),
    /outside the pinned/,
  );
});

test('manual curation stays bounded, exact-keyed, semantic, and rights-gated', async () => {
  const curation = JSON.parse(await readFile(new URL(
    '../assets-src/friendsies/trait-curation.json',
    import.meta.url,
  )));
  const index = JSON.parse(await readFile(new URL(
    '../assets-src/friendsies/trait-index.json',
    import.meta.url,
  )));
  const indexedTraits = new Map(index.traits.map((entry) => [entry.id, entry]));
  const entries = Object.entries(curation.entries ?? {});
  assert.equal(curation.schemaVersion, 2);
  assert.equal(entries.length, 27);

  const allowedStatuses = new Set(['active', 'shortlist', 'hold']);
  const requiredProfileFields = [
    'surfaceMeaning',
    'counterMeaning',
    'silhouetteClass',
    'mountType',
    'readDistance',
    'paletteFamily',
    'phaseReveal',
    'affordanceRisk',
    'shotRole',
    'maximumPerShot',
    'technicalReadiness',
    'rightsCoverage',
  ];
  const profileEnums = {
    silhouetteClass: new Set([
      'stemmed-bloom', 'vertical-flame', 'closed-volume', 'crescent-staff',
      'ornate-key', 'hooked-cane', 'prism-tube', 'heart-wand', 'star-wand',
      'floating-orb', 'rebirth-emblem', 'upright-crown', 'key-crest',
      'radial-bloom', 'tree-crest', 'sleep-crest', 'horizontal-leaf',
      'cloud-crest', 'stacked-totem', 'starburst-crest', 'chef-crest',
      'shell-crest', 'eye-crest', 'fractured-heart', 'portal-crest',
      'inverted-crown',
    ]),
    mountType: new Set([
      'offering', 'sconce', 'crest', 'shelf', 'lintel', 'ground-marker',
      'held-reference', 'unassigned',
    ]),
    readDistance: new Set(['near', 'mid', 'far']),
    paletteFamily: new Set([
      'welcome-pearl', 'ritual-amber', 'record-ocean', 'night-periwinkle',
      'threshold-gold', 'civic-cocoa', 'anomaly-prism', 'approval-pink',
      'night-gold', 'anomaly-violet', 'renewal-green', 'memory-purple',
      'civic-gold', 'botanical-pink', 'botanical-green', 'domestic-green',
      'civic-coral', 'pond-blue', 'correction-berry', 'route-periwinkle',
    ]),
    phaseReveal: new Set(['arrival', 'day', 'dusk', 'post-anomaly', 'resolution', 'future']),
    affordanceRisk: new Set(['low', 'medium', 'high']),
    shotRole: new Set(['primary', 'support', 'micro']),
    technicalReadiness: new Set([
      'runtime-proven', 'metadata-probed-rigid-candidate', 'unprobed',
    ]),
    rightsCoverage: new Set([
      'project-release-authorized-thornvale-only', 'metadata-only-review-required',
    ]),
  };
  for (const [key, entry] of entries) {
    assert.equal(key, `${entry.traitType}:${entry.value}`);
    assert.ok(['hand', 'sprout'].includes(entry.traitType));
    assert.ok(allowedStatuses.has(entry.status));
    assert.ok(Array.isArray(entry.semanticTags) && entry.semanticTags.length > 0);
    assert.equal(typeof entry.environmentRole, 'string');
    assert.ok(Array.isArray(entry.storyPhase) && entry.storyPhase.length > 0);
    assert.equal(typeof entry.placementAdvice, 'string');
    assert.equal(typeof entry.rationale, 'string');
    assert.equal(
      entry.rightsStatus,
      entry.status === 'active'
        ? 'project-release-authorized'
        : 'project-use-review-required',
    );
    assert.ok(indexedTraits.has(key), `${key} is not an exact catalog entry`);

    const profile = entry.designProfile;
    assert.ok(profile && typeof profile === 'object' && !Array.isArray(profile), `${key} profile`);
    assert.deepEqual(Object.keys(profile).sort(), requiredProfileFields.slice().sort(), `${key} keys`);
    assert.ok(profile.surfaceMeaning.trim().length > 0, `${key} surfaceMeaning`);
    assert.ok(profile.counterMeaning.trim().length > 0, `${key} counterMeaning`);
    for (const [field, allowed] of Object.entries(profileEnums)) {
      assert.ok(allowed.has(profile[field]), `${key} has invalid ${field}: ${profile[field]}`);
    }
    assert.ok(Number.isInteger(profile.maximumPerShot), `${key} maximumPerShot is not integer`);
    assert.ok(
      profile.maximumPerShot >= 1 && profile.maximumPerShot <= 3,
      `${key} maximumPerShot is outside 1-3`,
    );

    if (entry.preferredVariantAssetHash) {
      const indexed = indexedTraits.get(key);
      const variant = indexed.variants.find((candidate) => (
        candidate.assetUrl.endsWith(`/${entry.preferredVariantAssetHash}.glb`)
      ));
      assert.ok(variant, `${key} preferred variant is not indexed`);
      assert.ok(
        variant.tokenIds.includes(entry.preferredTokenId),
        `${key} preferred variant does not include token #${entry.preferredTokenId}`,
      );
    }
  }

  assert.equal(curation.entries['hand:Flower White'].status, 'active');
  assert.equal(curation.entries['hand:Torch'].status, 'active');
  assert.equal(curation.entries['sprout:Crown Up'].status, 'active');
  for (const key of ['hand:Flower White', 'hand:Torch', 'sprout:Crown Up']) {
    assert.equal(curation.entries[key].rightsStatus, 'project-release-authorized');
    assert.equal(
      curation.entries[key].designProfile.rightsCoverage,
      'project-release-authorized-thornvale-only',
    );
  }
  assert.equal(curation.entries['hand:Book Of Ocean'].status, 'shortlist');
  assert.equal(curation.entries['sprout:Friends Key'].status, 'shortlist');
  assert.equal(curation.entries['hand:Orb'].status, 'hold');
  assert.equal(curation.entries['sprout:All Seeing'].status, 'hold');
});

test('local atlas exposes the schema-v2 casting controls and decision surface', async () => {
  const [html, app, styles] = await Promise.all([
    readFile(new URL('../tools/friendsies-trait-atlas/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../tools/friendsies-trait-atlas/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../tools/friendsies-trait-atlas/styles.css', import.meta.url), 'utf8'),
  ]);

  for (const id of ['mount-type', 'phase-reveal', 'affordance-risk']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
    assert.match(html, new RegExp(`for=["']${id}["']`));
  }
  for (const field of [
    'surfaceMeaning', 'counterMeaning', 'silhouetteClass', 'mountType',
    'readDistance', 'paletteFamily', 'phaseReveal', 'affordanceRisk',
    'shotRole', 'maximumPerShot', 'technicalReadiness', 'rightsCoverage',
  ]) {
    assert.match(app, new RegExp(`\\b${field}\\b`), `atlas omits ${field}`);
  }
  assert.match(app, /Casting profile/);
  assert.match(app, /elements\.mountType/);
  assert.match(app, /elements\.phaseReveal/);
  assert.match(app, /elements\.affordanceRisk/);
  assert.match(styles, /\.casting-profile/);
  assert.match(styles, /\.profile-grid/);
  assert.match(styles, /\.meaning-pair/);
});

test('the checked-in probe ledger covers the active vocabulary and next records/access pair', async () => {
  const ledger = JSON.parse(await readFile(new URL(
    '../assets-src/friendsies/trait-probes.json',
    import.meta.url,
  )));
  const probes = new Map(ledger.probes.map((probe) => [probe.key, probe]));

  assert.equal(ledger.schemaVersion, 1);
  assert.equal(ledger.sourceIndex, 'assets-src/friendsies/trait-index.json');
  assert.deepEqual([...probes.keys()].sort(), [
    'hand:Book Of Ocean',
    'hand:Flower White',
    'hand:Torch',
    'sprout:Crown Up',
    'sprout:Friends Key',
  ]);
  for (const probe of probes.values()) {
    assert.match(probe.inspection.sha256, /^[a-f\d]{64}$/);
    assert.ok(probe.inspection.bytes > 0);
    assert.ok(probe.inspection.counts.triangles > 0);
    assert.equal(probe.inspection.compatibility.classification, 'rigid-candidate');
  }
  assert.equal(probes.get('hand:Book Of Ocean').inspection.counts.triangles, 396);
  assert.equal(probes.get('sprout:Friends Key').inspection.counts.triangles, 1_768);
});

test('offline CLI downloads one selected GLB in memory and writes only the probe ledger', async () => {
  const rootDir = await mkdtemp(join(tmpdir(), 'thornvale-trait-probe-'));
  const reviewDir = join(rootDir, 'assets-src', 'friendsies');
  const assetHash = 'cccccccccccccccccccccccccccccccc';
  const assetUrl = `https://storage.googleapis.com/friendsies-v2-assets-d8088d/assets/${assetHash}.glb`;
  const glb = makeGlb(singlePrimitiveDocument());
  const calls = [];
  const originalLog = console.log;
  const originalError = console.error;

  try {
    await mkdir(reviewDir, { recursive: true });
    await writeFile(join(reviewDir, 'trait-index.json'), JSON.stringify({
      schemaVersion: 1,
      traits: [{
        id: 'hand:Torch',
        traitType: 'hand',
        value: 'Torch',
        variants: [{ assetUrl, previewUrl: null, useCount: 1, tokenIds: [8914] }],
      }],
    }));
    console.log = () => {};
    console.error = () => {};

    const record = await runProbeCli(['--type', 'hand', '--value', 'Torch'], {
      rootDir,
      now: () => new Date('2026-07-12T00:00:00.000Z'),
      fetchImpl: async (url) => {
        calls.push(String(url));
        return {
          ok: true,
          status: 200,
          url: String(url),
          headers: { get: () => String(glb.length) },
          arrayBuffer: async () => glb.buffer.slice(
            glb.byteOffset,
            glb.byteOffset + glb.byteLength,
          ),
        };
      },
    });

    assert.deepEqual(calls, [assetUrl]);
    assert.equal(record.variant.id, assetHash);
    assert.equal(record.inspection.compatibility.classification, 'rigid-candidate');
    const ledger = JSON.parse(await readFile(join(reviewDir, 'trait-probes.json'), 'utf8'));
    assert.equal(ledger.probes.length, 1);
    assert.equal(ledger.probes[0].inspection.sha256, record.inspection.sha256);
    assert.deepEqual((await readdir(reviewDir)).sort(), [
      'trait-index.json',
      'trait-probes.json',
    ]);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    await rm(rootDir, { recursive: true, force: true });
  }
});
