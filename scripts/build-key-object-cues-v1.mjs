#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = resolve(ROOT, 'assets-src/ui/key-object-cues-v1');
const OUTPUT_DIR = resolve(ROOT, 'public/ui/key-object-cues/v1');
const SIZE = 128;
const MAX_RUNTIME_BYTES = 4 * 1024;
const VERIFY_ONLY = process.argv.includes('--verify');

const CUES = Object.freeze([
  Object.freeze({ id: 'community-ledger', source: 'community-ledger-source.png' }),
  Object.freeze({ id: 'forest-edge-camp', source: 'forest-edge-camp-source.png' }),
  Object.freeze({ id: 'town-bell', source: 'town-bell-source.png' }),
]);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result.stdout.trim();
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

if (!VERIFY_ONLY) {
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const cue of CUES) {
    run('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-i', resolve(SOURCE_DIR, cue.source),
      '-vf', `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=increase:flags=lanczos,crop=${SIZE}:${SIZE},format=yuv420p`,
      '-c:v', 'libsvtav1',
      '-crf', '42',
      '-preset', '8',
      '-svtav1-params', 'tune=0:enable-qm=1:qm-min=0:qm-max=15',
      '-frames:v', '1',
      '-map_metadata', '-1',
      '-an',
      '-f', 'avif',
      resolve(OUTPUT_DIR, `${cue.id}.avif`),
    ]);
  }
}

const results = [];
for (const cue of CUES) {
  const sourcePath = resolve(SOURCE_DIR, cue.source);
  const outputPath = resolve(OUTPUT_DIR, `${cue.id}.avif`);
  const metadata = JSON.parse(run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,codec_name',
    '-of', 'json',
    outputPath,
  ]));
  const stream = metadata.streams?.[0];
  if (stream?.codec_name !== 'av1' || stream?.width !== SIZE || stream?.height !== SIZE) {
    throw new Error(`${cue.id} must be a ${SIZE}x${SIZE} AVIF`);
  }

  const outputStat = await stat(outputPath);
  if (outputStat.size > MAX_RUNTIME_BYTES) {
    throw new Error(`${cue.id} is ${outputStat.size} B; limit is ${MAX_RUNTIME_BYTES} B`);
  }

  results.push({
    id: cue.id,
    sourceBytes: (await stat(sourcePath)).size,
    sourceSha256: await sha256(sourcePath),
    runtimeBytes: outputStat.size,
    runtimeSha256: await sha256(outputPath),
  });
}

console.log(VERIFY_ONLY ? 'Key-object cue verification passed' : 'Key-object cues built');
for (const result of results) {
  console.log(
    `  ${result.id}: ${result.runtimeBytes} B ${result.runtimeSha256} `
      + `(source ${result.sourceBytes} B ${result.sourceSha256})`,
  );
}
