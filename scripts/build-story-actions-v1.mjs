#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import {
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CATALOG = resolve(
  ROOT,
  'assets-src/friendsies-animations/story-actions-v1/clips.json',
);
const DEFAULT_BLENDER = '/Applications/Blender-4.5-LTS.app/Contents/MacOS/Blender';
const OUTPUT_DIR = resolve(ROOT, 'public/animations/story-actions-v1');
const ASSET_MANIFEST = resolve(ROOT, 'assets-src/asset-manifest.json');
const CONVERTER = resolve(ROOT, 'scripts/convert-friendsies-animation.py');
const ORCHESTRATOR = fileURLToPath(import.meta.url);
const PRESERVED_RUNTIME_RECORDS = ['PROVENANCE.md'];
const BUILD_REPORT = resolve(
  ROOT,
  'assets-src/friendsies-animations/story-actions-v1/build-report.json',
);

function parseArgs(argv) {
  const options = {
    catalog: DEFAULT_CATALOG,
    sourceRoot: process.env.FRIENDSIES_MIXAMO_SOURCE_DIR || null,
    blender: process.env.BLENDER_BIN || DEFAULT_BLENDER,
    verify: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--catalog') options.catalog = resolve(argv[++index]);
    else if (value === '--source-root') options.sourceRoot = resolve(argv[++index]);
    else if (value === '--blender') options.blender = resolve(argv[++index]);
    else if (value === '--verify') options.verify = true;
    else throw new TypeError(`Unknown argument: ${value}`);
  }
  return options;
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

async function fileSha256(path) {
  return sha256(await readFile(path));
}

function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertContract(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function filePin(path) {
  return {
    path: relative(ROOT, path),
    sha256: await fileSha256(path),
  };
}

async function toolchainRecord(catalogPath, rigProfilePath, results = []) {
  const blenderVersions = [...new Set(results.map((result) => result.blenderVersion).filter(Boolean))];
  if (blenderVersions.length > 1) {
    throw new Error(`Mixed Blender versions in one generation: ${blenderVersions.join(', ')}`);
  }
  return {
    nodeVersion: process.version,
    blenderVersion: blenderVersions[0] || null,
    files: {
      catalog: await filePin(catalogPath),
      rigProfile: await filePin(rigProfilePath),
      orchestrator: await filePin(ORCHESTRATOR),
      converter: await filePin(CONVERTER),
    },
  };
}

async function assertFile(path, expected, label) {
  const info = await stat(path);
  if (Number.isInteger(expected.bytes) && info.size !== expected.bytes) {
    throw new Error(`${label} bytes mismatch: expected ${expected.bytes}, got ${info.size}`);
  }
  const hash = await fileSha256(path);
  if (hash !== expected.sha256) {
    throw new Error(`${label} hash mismatch: expected ${expected.sha256}, got ${hash}`);
  }
  return { bytes: info.size, sha256: hash };
}

async function extractMember(archivePath, member, outputPath) {
  const { stdout } = await execFileAsync('unzip', ['-p', archivePath, member], {
    encoding: 'buffer',
    maxBuffer: 16 * 1024 * 1024,
  });
  await writeFile(outputPath, stdout);
  return stdout;
}

async function runConverter({ blender, input, output, clipName, rigProfile, report }) {
  const { stdout, stderr } = await execFileAsync(blender, [
    '--background',
    '--factory-startup',
    '--python',
    CONVERTER,
    '--',
    '--input', input,
    '--output', output,
    '--clip-name', clipName,
    '--rig-profile', rigProfile,
    '--report', report,
  ], {
    cwd: ROOT,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (stderr.trim()) process.stderr.write(stderr);
  const resultLine = stdout.split('\n').find((line) => line.startsWith('STORY_ACTION_RESULT='));
  if (!resultLine) throw new Error(`Blender converter did not emit a result for ${clipName}`);
  return JSON.parse(resultLine.slice('STORY_ACTION_RESULT='.length));
}

function runtimePack(catalog, results) {
  const byName = new Map(results.map((result) => [result.clipName, result]));
  return {
    schemaVersion: 'friendsies-motion-runtime-pack-v1',
    id: catalog.id,
    label: catalog.label,
    rigProfile: 'friendsies-humanoid-v1',
    rootMotionPolicy: catalog.rootMotionPolicy,
    clips: catalog.clips.map((clip) => {
      const result = byName.get(clip.clipName);
      return {
        id: clip.id,
        actor: clip.actor,
        intent: clip.intent,
        clipName: clip.clipName,
        url: clip.runtime.url,
        bytes: result.output.bytes,
        sha256: result.output.sha256,
        sourceDurationSeconds: result.source.durationSeconds,
        durationSeconds: result.output.durationSeconds,
        sourceSampleRate: result.source.sampleRate,
        sampleRate: result.output.sampleRate,
        loop: clip.loop,
        rootMotionPolicy: catalog.rootMotionPolicy,
        playback: clip.playback || null,
        reducedMotion: clip.reducedMotion,
      };
    }),
  };
}

async function verifyOutputs(catalog, {
  catalogPath = DEFAULT_CATALOG,
  outputDir = OUTPUT_DIR,
  reportPath = BUILD_REPORT,
  checkManifest = true,
} = {}) {
  const rigProfilePath = resolve(dirname(catalogPath), catalog.rigProfile);
  const packPath = resolve(outputDir, 'pack.json');
  const pack = JSON.parse(await readFile(packPath, 'utf8'));
  const report = JSON.parse(await readFile(reportPath, 'utf8'));
  const manifest = checkManifest
    ? JSON.parse(await readFile(ASSET_MANIFEST, 'utf8'))
    : null;
  const currentTools = await toolchainRecord(catalogPath, rigProfilePath);

  assertContract(pack.id === catalog.id, `Unexpected runtime pack id: ${pack.id}`);
  assertContract(report.id === catalog.id, `Unexpected build report id: ${report.id}`);
  assertContract(pack.rootMotionPolicy === catalog.rootMotionPolicy, 'Pack root policy drifted');
  assertContract(report.rootMotionPolicy === catalog.rootMotionPolicy, 'Report root policy drifted');
  assertContract(pack.clips.length === catalog.clips.length, 'Pack clip count drifted');
  assertContract(report.clips.length === catalog.clips.length, 'Build report clip count drifted');
  assertContract(
    same(report.toolchain?.files, currentTools.files),
    'Catalog, rig profile, orchestrator, or converter changed after the recorded build',
  );
  assertContract(Boolean(report.toolchain?.blenderVersion), 'Build report is missing Blender version');
  assertContract(Boolean(report.toolchain?.nodeVersion), 'Build report is missing Node version');

  const expectedFiles = catalog.clips.map((clip) => clip.runtime.filename).sort();
  const actualFiles = (await readdir(outputDir)).filter((name) => name.endsWith('.glb')).sort();
  assertContract(same(actualFiles, expectedFiles), 'Runtime GLB generation contains missing or extra files');

  for (const sourceClip of catalog.clips) {
    const clip = pack.clips.find((entry) => entry.id === sourceClip.id);
    const build = report.clips.find((entry) => entry.id === sourceClip.id);
    assertContract(Boolean(clip), `${sourceClip.id} is missing from pack.json`);
    assertContract(Boolean(build), `${sourceClip.id} is missing from build-report.json`);
    assertContract(clip.clipName === sourceClip.clipName, `${sourceClip.id} clip name drifted`);
    assertContract(clip.actor === sourceClip.actor, `${sourceClip.id} actor drifted`);
    assertContract(clip.intent === sourceClip.intent, `${sourceClip.id} intent drifted`);
    assertContract(clip.url === sourceClip.runtime.url, `${sourceClip.id} URL drifted`);
    assertContract(clip.loop === sourceClip.loop, `${sourceClip.id} loop policy drifted`);
    assertContract(clip.reducedMotion === sourceClip.reducedMotion, `${sourceClip.id} reduced-motion policy drifted`);
    assertContract(same(clip.playback, sourceClip.playback || null), `${sourceClip.id} playback markers drifted`);

    const archive = catalog.archives[sourceClip.archive];
    assertContract(build.archive === sourceClip.archive, `${sourceClip.id} archive id drifted`);
    assertContract(build.source.archive === archive.filename, `${sourceClip.id} archive filename drifted`);
    assertContract(build.source.archiveSha256 === archive.sha256, `${sourceClip.id} archive hash drifted`);
    assertContract(build.source.member === sourceClip.source.member, `${sourceClip.id} archive member drifted`);
    assertContract(build.source.sha256 === sourceClip.source.sha256, `${sourceClip.id} source hash drifted`);
    assertContract(build.output.filename === sourceClip.runtime.filename, `${sourceClip.id} output filename drifted`);
    assertContract(build.output.url === sourceClip.runtime.url, `${sourceClip.id} output URL drifted`);
    assertContract(build.output.sha256 === clip.sha256, `${sourceClip.id} report/pack hash drifted`);
    assertContract(build.output.bytes === clip.bytes, `${sourceClip.id} report/pack bytes drifted`);
    assertContract(
      build.deterministicRebuildSha256 === clip.sha256,
      `${sourceClip.id} cold-build hash drifted`,
    );

    const outputPath = resolve(outputDir, sourceClip.runtime.filename);
    await assertFile(outputPath, clip, sourceClip.id);

    if (manifest) {
      const runtimePath = `public${sourceClip.runtime.url}`;
      const asset = manifest.assets.find((entry) => entry.path === runtimePath);
      assertContract(Boolean(asset), `${sourceClip.id} is missing from asset-manifest.json`);
      assertContract(asset.family === 'friendsies-story-actions-v1', `${sourceClip.id} manifest family drifted`);
      assertContract(asset.bytes === clip.bytes, `${sourceClip.id} manifest bytes drifted`);
      assertContract(asset.sha256 === clip.sha256, `${sourceClip.id} manifest hash drifted`);
      assertContract(asset.source?.sha256 === sourceClip.source.sha256, `${sourceClip.id} manifest source drifted`);
    }
  }
  console.log(`Verified ${pack.clips.length} story-actions-v1 runtime clips.`);
}

async function publishGeneration(stagedOutputDir, stagedReportPath) {
  const suffix = `${process.pid}-${Date.now()}`;
  const outputBackup = resolve(dirname(OUTPUT_DIR), `.story-actions-v1-backup-${suffix}`);
  const reportBackup = resolve(dirname(BUILD_REPORT), `.build-report-backup-${suffix}.json`);
  const hadOutput = await exists(OUTPUT_DIR);
  const hadReport = await exists(BUILD_REPORT);

  try {
    if (hadOutput) await rename(OUTPUT_DIR, outputBackup);
    if (hadReport) await rename(BUILD_REPORT, reportBackup);
    await rename(stagedOutputDir, OUTPUT_DIR);
    await rename(stagedReportPath, BUILD_REPORT);
    await rm(outputBackup, { recursive: true, force: true });
    await rm(reportBackup, { force: true });
  } catch (error) {
    await rm(OUTPUT_DIR, { recursive: true, force: true });
    await rm(BUILD_REPORT, { force: true });
    if (hadOutput && await exists(outputBackup)) await rename(outputBackup, OUTPUT_DIR);
    if (hadReport && await exists(reportBackup)) await rename(reportBackup, BUILD_REPORT);
    throw error;
  }
}

async function build(options, catalog) {
  if (!options.sourceRoot) {
    throw new Error('Pass --source-root or set FRIENDSIES_MIXAMO_SOURCE_DIR');
  }
  const rigProfile = resolve(dirname(options.catalog), catalog.rigProfile);
  const scratch = await mkdtemp(resolve(tmpdir(), 'thornvale-story-actions-v1-'));
  const publishSuffix = `${process.pid}-${Date.now()}`;
  const stagedOutput = resolve(dirname(OUTPUT_DIR), `.story-actions-v1-stage-${publishSuffix}`);
  const stagedReport = resolve(dirname(BUILD_REPORT), `.build-report-stage-${publishSuffix}.json`);
  const results = [];
  try {
    await rm(stagedOutput, { recursive: true, force: true });
    await mkdir(stagedOutput, { recursive: true });
    for (const filename of PRESERVED_RUNTIME_RECORDS) {
      const source = resolve(OUTPUT_DIR, filename);
      if (await exists(source)) await copyFile(source, resolve(stagedOutput, filename));
    }
    for (const [archiveId, archive] of Object.entries(catalog.archives)) {
      await assertFile(
        resolve(options.sourceRoot, archive.filename),
        archive,
        `archive ${archiveId}`,
      );
    }

    for (const clip of catalog.clips) {
      const archive = catalog.archives[clip.archive];
      if (!archive) throw new Error(`${clip.id} references unknown archive ${clip.archive}`);
      const archivePath = resolve(options.sourceRoot, archive.filename);
      const inputPath = resolve(scratch, `${clip.id.replaceAll('.', '-')}.fbx`);
      const source = await extractMember(archivePath, clip.source.member, inputPath);
      if (source.length !== clip.source.bytes || sha256(source) !== clip.source.sha256) {
        throw new Error(`${clip.id} extracted source does not match its catalog contract`);
      }

      const runA = resolve(scratch, `${clip.id}.a.glb`);
      const runB = resolve(scratch, `${clip.id}.b.glb`);
      const reportA = resolve(scratch, `${clip.id}.a.json`);
      const reportB = resolve(scratch, `${clip.id}.b.json`);
      const first = await runConverter({
        blender: options.blender,
        input: inputPath,
        output: runA,
        clipName: clip.clipName,
        rigProfile,
        report: reportA,
      });
      const second = await runConverter({
        blender: options.blender,
        input: inputPath,
        output: runB,
        clipName: clip.clipName,
        rigProfile,
        report: reportB,
      });
      if (first.output.sha256 !== second.output.sha256) {
        throw new Error(`${clip.id} is not deterministic across clean Blender runs`);
      }

      await copyFile(runA, resolve(stagedOutput, clip.runtime.filename));
      const finalResult = {
        ...first,
        id: clip.id,
        archive: clip.archive,
        source: {
          ...first.source,
          archive: archive.filename,
          archiveSha256: archive.sha256,
          member: clip.source.member,
        },
        output: {
          ...first.output,
          filename: clip.runtime.filename,
          url: clip.runtime.url,
        },
        deterministicRebuildSha256: second.output.sha256,
      };
      results.push(finalResult);
      console.log(`Built ${clip.id}: ${finalResult.output.bytes} bytes ${finalResult.output.sha256}`);
    }

    const pack = runtimePack(catalog, results);
    await writeFile(resolve(stagedOutput, 'pack.json'), `${JSON.stringify(pack, null, 2)}\n`);
    const report = {
      schemaVersion: 'friendsies-motion-pack-build-result-v1',
      id: catalog.id,
      converter: 'scripts/convert-friendsies-animation.py',
      catalog: 'assets-src/friendsies-animations/story-actions-v1/clips.json',
      rootMotionPolicy: catalog.rootMotionPolicy,
      toolchain: await toolchainRecord(options.catalog, rigProfile, results),
      clips: results,
    };
    await writeFile(stagedReport, `${JSON.stringify(report, null, 2)}\n`);
    await verifyOutputs(catalog, {
      catalogPath: options.catalog,
      outputDir: stagedOutput,
      reportPath: stagedReport,
      checkManifest: false,
    });
    await publishGeneration(stagedOutput, stagedReport);
    await verifyOutputs(catalog, { catalogPath: options.catalog, checkManifest: false });
  } finally {
    await rm(scratch, { recursive: true, force: true });
    await rm(stagedOutput, { recursive: true, force: true });
    await rm(stagedReport, { force: true });
  }
}

const options = parseArgs(process.argv.slice(2));
const catalog = JSON.parse(await readFile(options.catalog, 'utf8'));
if (options.verify) await verifyOutputs(catalog, { catalogPath: options.catalog });
else await build(options, catalog);
