import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEGACY_TOWN_LAYOUT } from '../src/config/town.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'assets-src/pizza-lab/world-stage/thornvale-world-stage-v1.json');
const GENERATED = resolve(ROOT, 'src/content/generated/thornvale-world-stage-v1.json');

const ASSETS = [
  ['cottages', 'public/town/cottages/thornvale-cottages.glb'],
  ['village-dressing', 'public/village/thornvale-village-dressing.glb'],
  ['arrival-plaza', 'public/village/pilot/v1/thornvale-arrival-plaza.glb'],
];

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

async function main() {
  if (!process.argv.includes('--acknowledge-overwrite')) {
    throw new Error('Refusing to overwrite World Stage source without --acknowledge-overwrite');
  }
  const sources = [];
  for (const [id, path] of ASSETS) {
    const bytes = await readFile(resolve(ROOT, path));
    sources.push({ id, path, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  const layout = stable(LEGACY_TOWN_LAYOUT);
  const layoutSha256 = createHash('sha256').update(JSON.stringify(layout)).digest('hex');
  const manifest = {
    schemaVersion: 1,
    id: 'thornvale-world-stage-v1',
    coordinateSpace: 'three-y-up',
    blenderSpace: 'z-up-negative-y-front',
    layoutSha256,
    sources,
    layout,
  };
  const encoded = `${JSON.stringify(manifest, null, 2)}\n`;
  await mkdir(dirname(SOURCE), { recursive: true });
  await mkdir(dirname(GENERATED), { recursive: true });
  await writeFile(SOURCE, encoded);
  await writeFile(GENERATED, encoded);
  process.stdout.write(`Bootstrapped ${manifest.id} from the current TOWN_LAYOUT\n`);
}

await main();
