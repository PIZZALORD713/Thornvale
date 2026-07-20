import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FAMILY_ID = 'thornvale-wayfinder-pizza-lab-v1';
const ASSET_VERSION = '1.1.0';
const CANDIDATE_RECORD = resolve(ROOT, 'output/pizza-lab/wayfinder-v1/candidate.json');
const CANDIDATE_GLB = resolve(ROOT, 'output/pizza-lab/wayfinder-v1/thornvale-wayfinder-candidate.glb');
const SOURCE_BLEND = resolve(ROOT, 'assets-src/pizza-lab/wayfinder-v1/thornvale-wayfinder-authoring.blend');
const GENERATOR = resolve(ROOT, 'scripts/build-village-dressing.py');
const BASELINE_GLB = resolve(ROOT, 'public/village/thornvale-village-dressing.glb');
const WORLD_MANIFEST = resolve(ROOT, 'assets-src/pizza-lab/world-stage/thornvale-world-stage-v1.json');
const RUNTIME_PATH = 'public/village/pilot/wayfinder/v1/thornvale-wayfinder.glb';
const RUNTIME_GLB = resolve(ROOT, RUNTIME_PATH);
const PROVENANCE = resolve(ROOT, 'public/village/pilot/wayfinder/v1/PROVENANCE.md');
const GENERATED = resolve(ROOT, 'src/content/generated/pizza-lab-wayfinder-v1.json');
const ASSET_MANIFEST = resolve(ROOT, 'assets-src/asset-manifest.json');
const SOURCE_PATH = 'assets-src/pizza-lab/wayfinder-v1/thornvale-wayfinder-authoring.blend';
const EXPECTED_MATERIALS = new Set([
  'TV_Antique_Gold',
  'TV_Blush',
  'TV_Lavender',
  'TV_Leaf_Dark',
  'TV_Leaf_Light',
  'TV_Mint',
  'TV_Stone_Light',
  'TV_Stone_Warm',
  'TV_Wood_Cocoa',
  'TV_Wood_Honey',
]);
const BOARD_IDS = ['01', '02', '03'];

function hash(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function finiteVector(value, label) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((item) => !Number.isFinite(item))) {
    throw new Error(`${label} must contain three finite numbers`);
  }
  return value.map(Number);
}

function parseGlb(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2) {
    throw new Error('Wayfinder candidate is not a glTF 2.0 binary');
  }
  if (bytes.readUInt32LE(16) !== 0x4e4f534a) {
    throw new Error('Wayfinder candidate has no leading JSON chunk');
  }
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8').trim());
}

function accessorCount(document, index, label) {
  const count = document.accessors?.[index]?.count;
  if (!Number.isInteger(count) || count <= 0) throw new Error(`${label} has an invalid accessor`);
  return count;
}

function sameSet(actual, expected) {
  return actual.size === expected.size && [...actual].every((item) => expected.has(item));
}

export function validatePizzaLabWayfinderCandidate(candidate, files) {
  if (candidate?.schemaVersion !== 1 || candidate.id !== 'thornvale-wayfinder-candidate-v1') {
    throw new Error('Unsupported Pizza Lab Wayfinder candidate');
  }
  if (candidate.family !== FAMILY_ID || candidate.root !== 'VillageWayfinder') {
    throw new Error('Wayfinder candidate family or root changed');
  }
  const exactPaths = {
    baseSource: 'public/village/thornvale-village-dressing.glb',
    generator: 'scripts/build-village-dressing.py',
    worldStage: 'assets-src/pizza-lab/world-stage/thornvale-world-stage-v1.json',
    authoringSource: SOURCE_PATH,
    candidate: 'output/pizza-lab/wayfinder-v1/thornvale-wayfinder-candidate.glb',
  };
  for (const [field, expected] of Object.entries(exactPaths)) {
    if (candidate[field]?.path !== expected) throw new Error(`Wayfinder candidate ${field} path changed`);
  }
  for (const [field, bytes] of Object.entries(files)) {
    const record = candidate[field];
    if (!record || record.sha256 !== hash(bytes)) {
      throw new Error(`Wayfinder candidate ${field} hash does not match its reviewed file`);
    }
  }
  const world = JSON.parse(files.worldStage.toString('utf8'));
  if (candidate.worldStage.layoutSha256 !== world.layoutSha256) {
    throw new Error('Wayfinder candidate layout authority changed');
  }

  if (!sameSet(new Set(Object.keys(candidate.boardOverrides || {})), new Set(BOARD_IDS))) {
    throw new Error('Wayfinder candidate must contain exactly three board overrides');
  }
  for (const id of BOARD_IDS) {
    const before = candidate.boardOverrides[id]?.before || {};
    const after = candidate.boardOverrides[id]?.after || {};
    const beforeLocation = finiteVector(before.location, `board ${id} baseline location`);
    finiteVector(before.rotationEuler, `board ${id} baseline rotation`);
    const location = finiteVector(after.location, `board ${id} location`);
    const rotation = finiteVector(after.rotationEuler, `board ${id} rotation`);
    const scale = finiteVector(after.scale, `board ${id} scale`);
    if (Math.abs(location[0] - beforeLocation[0]) > 0.75 || Math.abs(location[2] - beforeLocation[2]) > 0.75) {
      throw new Error(`board ${id} translation exceeds the reviewed envelope`);
    }
    if (Math.abs(location[1] - beforeLocation[1]) > 0.35) {
      throw new Error(`board ${id} depth translation exceeds the reviewed envelope`);
    }
    if (Math.abs(rotation[0]) > 1e-6 || Math.abs(rotation[1]) > 1e-6) {
      throw new Error(`board ${id} rotation exceeds the reviewed envelope`);
    }
    if (!(scale[0] >= 0.5 && scale[0] <= 1.75 && scale[1] >= 0.75 && scale[1] <= 1.25 && scale[2] >= 0.5 && scale[2] <= 1.75)) {
      throw new Error(`board ${id} scale exceeds the reviewed envelope`);
    }
  }

  const document = parseGlb(files.candidate);
  const sceneRoots = document.scenes?.[document.scene || 0]?.nodes || [];
  if (sceneRoots.length !== 1) throw new Error('Wayfinder GLB must have one scene root');
  const rootNode = document.nodes?.[sceneRoots[0]];
  if (rootNode?.name !== 'VillageWayfinder') throw new Error('Wayfinder GLB root changed');
  for (const [field, identity] of Object.entries({
    translation: [0, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1],
  })) {
    if (rootNode[field] && JSON.stringify(rootNode[field]) !== JSON.stringify(identity)) {
      throw new Error(`Wayfinder GLB root ${field} must be identity`);
    }
  }
  const used = new Set(document.extensionsUsed || []);
  const required = new Set(document.extensionsRequired || []);
  if (!sameSet(used, new Set(['KHR_draco_mesh_compression'])) || !sameSet(required, used)) {
    throw new Error('Wayfinder GLB must require only Draco compression');
  }
  for (const field of ['images', 'textures', 'animations', 'skins', 'cameras']) {
    if (document[field]?.length) throw new Error(`Wayfinder GLB must not contain ${field}`);
  }
  if ((document.buffers || []).some((buffer) => buffer.uri)) throw new Error('Wayfinder GLB has an external buffer');
  const materials = new Set((document.materials || []).map((material) => material.name));
  if (!sameSet(materials, EXPECTED_MATERIALS)) throw new Error('Wayfinder GLB material contract changed');
  let primitives = 0;
  let vertices = 0;
  let triangles = 0;
  for (const [meshIndex, mesh] of (document.meshes || []).entries()) {
    for (const primitive of mesh.primitives || []) {
      primitives += 1;
      if (!sameSet(new Set(Object.keys(primitive.extensions || {})), used)) {
        throw new Error(`Wayfinder GLB mesh ${meshIndex} is not Draco-compressed`);
      }
      vertices += accessorCount(document, primitive.attributes?.POSITION, `mesh ${meshIndex} POSITION`);
      triangles += accessorCount(document, primitive.indices, `mesh ${meshIndex} indices`) / 3;
    }
  }
  const metrics = {
    bytes: files.candidate.byteLength,
    nodes: document.nodes?.length || 0,
    meshes: document.meshes?.length || 0,
    primitives,
    materials: document.materials?.length || 0,
    vertices,
    triangles,
  };
  if (metrics.nodes !== 11 || metrics.meshes !== 10 || primitives !== 10 || metrics.materials !== 10 || triangles !== 1488) {
    throw new Error(`Wayfinder GLB hierarchy or geometry changed: ${JSON.stringify(metrics)}`);
  }
  if (metrics.bytes > 31_000) throw new Error(`Wayfinder GLB exceeds 31,000 bytes: ${metrics.bytes}`);
  for (const [field, value] of Object.entries(metrics)) {
    if (candidate.candidate[field] !== value) throw new Error(`Wayfinder candidate ${field} metric does not match its GLB`);
  }
  return metrics;
}

function provenance(candidate, metrics) {
  const bounds = candidate.candidate.bounds;
  return `# Pizza Lab Wayfinder v1 Provenance

\`thornvale-wayfinder.glb\` is the first bounded Blender-to-browser geometry
candidate from the Pizza Lab World Stage. It contains the project-authored
\`VillageWayfinder\` root; only the three sign-board assemblies may differ from
the deterministic baseline generator.

- Status: \`project-authored\`
- Family: \`${FAMILY_ID}\`
- Canonical generator: \`scripts/build-village-dressing.py\`
- Editable source: \`${SOURCE_PATH}\`
- Blender version: ${candidate.blender.version}
- Asset version: ${ASSET_VERSION}
- Export: binary glTF 2.0, Y-up, Draco level 6
- External textures, fonts, scans, or model inputs: none
- Runtime placement/collider authority: \`src/config/town.js\` and \`src/game/TownBuilder.js\`
- Baseline fallback: \`public/village/thornvale-village-dressing.glb#VillageWayfinder\`

## Verified candidate

- GLB size: ${metrics.bytes.toLocaleString('en-US')} bytes
- Scene nodes / meshes / primitives / materials: ${metrics.nodes} / ${metrics.meshes} / ${metrics.primitives} / ${metrics.materials}
- Vertices / triangles: ${metrics.vertices.toLocaleString('en-US')} / ${metrics.triangles.toLocaleString('en-US')}
- Runtime bounds min: ${bounds.min.join(', ')}
- Runtime bounds max: ${bounds.max.join(', ')}
- GLB SHA-256: \`${candidate.candidate.sha256}\`
- Authoring source SHA-256: \`${candidate.authoringSource.sha256}\`

The pilot changes presentation only. The browser keeps the existing Wayfinder
placement, physics collider, camera proxy, grass clearance, and interaction
contracts. Explicit \`?assets=baseline\` skips this asset, and a pilot load
failure falls back to the baseline Wayfinder without affecting other props.
`;
}

async function atomicWrite(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, contents, { flag: 'wx' });
  return temporary;
}

async function main() {
  const [candidateText, candidateBytes, sourceBytes, generatorBytes, baselineBytes, worldBytes, manifestText] = await Promise.all([
    readFile(CANDIDATE_RECORD, 'utf8'),
    readFile(CANDIDATE_GLB),
    readFile(SOURCE_BLEND),
    readFile(GENERATOR),
    readFile(BASELINE_GLB),
    readFile(WORLD_MANIFEST),
    readFile(ASSET_MANIFEST, 'utf8'),
  ]);
  const candidate = JSON.parse(candidateText);
  const files = {
    candidate: candidateBytes,
    authoringSource: sourceBytes,
    generator: generatorBytes,
    baseSource: baselineBytes,
    worldStage: worldBytes,
  };
  const metrics = validatePizzaLabWayfinderCandidate(candidate, files);
  const descriptor = {
    schemaVersion: 1,
    id: 'thornvale-wayfinder-pizza-lab-v1',
    family: FAMILY_ID,
    version: ASSET_VERSION,
    url: '/village/pilot/wayfinder/v1/thornvale-wayfinder.glb',
    root: 'VillageWayfinder',
    sha256: candidate.candidate.sha256,
    ...metrics,
    source: candidate.authoringSource,
    boardOverrides: candidate.boardOverrides,
  };

  const manifest = JSON.parse(manifestText);
  manifest.families[FAMILY_ID] = {
    creator: 'Thornvale project',
    status: 'project-authored',
    licenseOrPermission: 'No root license selected; default copyright applies; see NOTICE.md',
    sourcePage: null,
    sourceRetrievedOn: null,
    provenance: 'public/village/pilot/wayfinder/v1/PROVENANCE.md',
    rawSourceRedistribution: false,
    releaseBlocked: false,
  };
  manifest.assets = manifest.assets.filter((asset) => ![
    'thornvale-wayfinder-pizza-lab-v1-source',
    'thornvale-wayfinder-pizza-lab-v1',
  ].includes(asset.id));
  manifest.assets.push({
    id: 'thornvale-wayfinder-pizza-lab-v1-source',
    path: SOURCE_PATH,
    runtime: false,
    kind: 'source-model',
    family: FAMILY_ID,
    storage: 'git',
    intakeBatch: 'pizza-lab-wayfinder-v1',
    bytes: sourceBytes.byteLength,
    sha256: candidate.authoringSource.sha256,
    source: {
      originalFilename: 'build-village-dressing.py',
      path: 'scripts/build-village-dressing.py',
      sha256: candidate.generator.sha256,
      transform: 'Blender 4.5.9 LTS rebuild of the canonical Wayfinder with three named board assemblies and recorded transform overrides.',
    },
  });
  manifest.assets.push({
    id: 'thornvale-wayfinder-pizza-lab-v1',
    path: RUNTIME_PATH,
    runtime: true,
    kind: 'environment-model',
    family: FAMILY_ID,
    budgetGroups: ['active-town-glb'],
    bytes: metrics.bytes,
    sha256: candidate.candidate.sha256,
    source: {
      originalFilename: 'thornvale-wayfinder-authoring.blend',
      path: SOURCE_PATH,
      sha256: candidate.authoringSource.sha256,
      transform: 'Fresh canonical generator rebuild, allowlisted transforms on three sign-board assemblies, material consolidation, and Draco-compressed Blender 4.5.9 LTS GLB export.',
    },
  });

  await mkdir(dirname(RUNTIME_GLB), { recursive: true });
  const glbTemp = `${RUNTIME_GLB}.tmp-${process.pid}`;
  await copyFile(CANDIDATE_GLB, glbTemp);
  const temps = await Promise.all([
    atomicWrite(GENERATED, `${JSON.stringify(descriptor, null, 2)}\n`),
    atomicWrite(PROVENANCE, provenance(candidate, metrics)),
    atomicWrite(ASSET_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`),
  ]);
  try {
    await rename(glbTemp, RUNTIME_GLB);
    await rename(temps[0], GENERATED);
    await rename(temps[1], PROVENANCE);
    await rename(temps[2], ASSET_MANIFEST);
  } finally {
    await Promise.allSettled([glbTemp, ...temps].map((path) => unlink(path)));
  }
  const runtimeStat = await stat(RUNTIME_GLB);
  process.stdout.write(`Promoted Pizza Lab Wayfinder ${candidate.candidate.sha256} (${runtimeStat.size} bytes)\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
