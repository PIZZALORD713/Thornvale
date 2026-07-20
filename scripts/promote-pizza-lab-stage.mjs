import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATE = resolve(ROOT, 'assets-src/pizza-lab/staging/thornvale-town-v1.json');
const OUTPUT = resolve(ROOT, 'src/content/generated/pizza-lab-town-stage-v1.json');
const SOURCE_ASSET = resolve(ROOT, 'public/village/thornvale-village-dressing.glb');
const ALLOWED = Object.freeze({ wayfinder: 'VillageWayfinder' });

function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return Object.is(value, -0) ? 0 : Number(value.toFixed(6));
}

export function validatePizzaLabCandidate(candidate, sourceHash, layout = null) {
  if (candidate?.schemaVersion !== 1 || candidate.adapter !== 'thornvale') throw new Error('Unsupported Pizza Lab candidate');
  if (candidate.coordinateSpace !== 'three-y-up') throw new Error('Candidate coordinate space must be three-y-up');
  if (candidate.source?.path !== 'public/village/thornvale-village-dressing.glb') throw new Error('Candidate source path changed');
  if (candidate.source.sha256 !== sourceHash) throw new Error('Candidate source hash does not match the runtime GLB');
  const ids = Object.keys(candidate.placements || {}).filter((id) => candidate.placements[id]?.editable);
  if (ids.length !== 1 || ids[0] !== 'wayfinder') throw new Error('Only wayfinder may be published in the v1 trial');
  const placement = candidate.placements.wayfinder;
  if (placement.asset !== ALLOWED.wayfinder) throw new Error('Wayfinder asset root changed');
  const result = {
    asset: placement.asset,
    x: finite(placement.x, 'wayfinder.x'),
    y: finite(placement.y, 'wayfinder.y'),
    z: finite(placement.z, 'wayfinder.z'),
    rotationY: finite(placement.rotationY, 'wayfinder.rotationY'),
  };
  if (Math.abs(result.y) > 1e-6) throw new Error('Wayfinder must remain grounded at runtime y=0');
  if (Math.hypot(result.x, result.z) > 55) throw new Error('Wayfinder must remain inside the authored meadow staging radius');
  if (layout) {
    for (const building of layout.buildings || []) {
      const margin = 1.6;
      if (
        Math.abs(result.x - building.position.x) <= building.size.x * 0.5 + margin
        && Math.abs(result.z - building.position.z) <= building.size.z * 0.5 + margin
      ) {
        throw new Error(`Wayfinder overlaps ${building.id} clearance`);
      }
    }
    const protectedAnchors = [
      ['gate', layout.gate, 3],
      ['ledger', layout.landmarks?.ledger, 3],
      ['bell', layout.landmarks?.bell, 3],
    ];
    for (const [id, anchor, radius] of protectedAnchors) {
      if (anchor && Math.hypot(result.x - anchor.x, result.z - anchor.z) < radius) {
        throw new Error(`Wayfinder overlaps protected ${id} clearance`);
      }
    }
  }
  return result;
}

async function main() {
  const [candidateText, sourceBytes] = await Promise.all([readFile(CANDIDATE, 'utf8'), readFile(SOURCE_ASSET)]);
  const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
  const { TOWN_LAYOUT } = await import('../src/config/town.js');
  const placement = validatePizzaLabCandidate(JSON.parse(candidateText), sourceHash, TOWN_LAYOUT);
  const generated = {
    schemaVersion: 1,
    source: 'assets-src/pizza-lab/staging/thornvale-town-v1.json',
    placements: { wayfinder: placement },
  };
  const temporary = `${OUTPUT}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(generated, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, OUTPUT);
  process.stdout.write(`Promoted Pizza Lab wayfinder placement to ${OUTPUT}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
