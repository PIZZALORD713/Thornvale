# Pond–Grove Trait Echo v1.1 QA — 2026-07-21

Status: **post-stewardship integration qualified on 2026-07-22; human
fresh-player feel and physical reference-device support remain open refinement
and support checks, not correctness blockers for this bounded visual pilot.**

## Player-facing slice

The pond–camp route now uses six exact canonical fRiENDSiES forms in fourteen
non-colliding environmental placements:

- `head:Carrot` as two rounded grove-tree silhouettes;
- `head:Earthworm` as one pond-bank mushroom landmark;
- `head:Flower Hill` as two flowered banks;
- `sprout:Blooming Tree` as one camp-grove growth endpoint;
- `sprout:Resting Green Leaf` as four pond-surface leaves; and
- `sprout:Purp Mush` as four understory details linking pond and camp.

Together with the three civic Trait Echo families, v1.1 remains nine trait
draws plus one shared civic-mount draw, twenty-one placements, and 90,968
displayed trait triangles. The six new canonical binaries total 1,037,824
bytes. They do not own gameplay, save, interaction, collision, fishing,
planting, or woodcutting state.

## Automated evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Focused asset, curation, Trait Echo, and budget suites | PASS | 48 passed, 0 failed |
| Full project tests | PASS | 364 passed, 0 failed |
| Production build | PASS with existing chunk advisory | Vite built 93 modules |
| Development and dist asset audit | PASS | 39 runtime media files / 6,071,034 B |
| Strict `assets:release` | PASS | No blocked family; Pond–Grove 1,037,824 / 1,835,008 B |
| Production package | PASS with narrow margin | 10,034,529 / 10,066,330 B; 31,801 B remain |
| Production dependency audit | PASS | 0 vulnerabilities at high-or-greater threshold |
| Whitespace integrity | PASS | `git diff --check` |

The asset tests pin every catalog key, token witness, asset hash, runtime byte
count, SHA-256, triangle count, rig count, manifest record, curated runtime URL,
source record, fallback, and standing `friendsies-project` authorization.

## Browser comparison

Production preview was inspected in headed Chromium at 1440×900 with direct
rendering (`post=off`). Temporary screenshots were kept under ignored
`output/playwright/` for local inspection only.

| Route | Result |
| --- | --- |
| `story=off&quality=high&assets=pilot&traits=v1` | PASS: all nine families loaded, no failed family, all six Pond–Grove requests returned 200, zero console errors or warnings |
| `story=off&quality=high&assets=pilot&traits=off` | PASS: Trait Echo runtime is null and the pond returns to its sparse procedural treatment, zero console errors or warnings |
| `story=off&quality=low&assets=baseline&traits=v1` with reduced motion | PASS: all nine families loaded independently of the landmark selector, no failed family, zero console errors or warnings |
| `story=off&quality=low&assets=baseline&traits=off` with reduced motion | PASS: no Trait Echo runtime root, zero console errors or warnings |

A forced failure of `head-earthworm.glb` produced the expected failed request
and one local warning, omitted only `pond-grove-mushroom-landmark`, retained the
other eight families, and completed startup. At a 390×844 touch viewport, the
real pond `CAST` control measured 118×52 px; it remained separated from the
66×66 px Jump button and 132×132 px movement zone. The close pond view retained
clear action text with the rounded tree, leaves, mushrooms, and canonical pole
visible. This is operator browser evidence, not a physical-device support claim.

## Comparative performance sample

One 180-frame `requestAnimationFrame` sample per route ran on the same local
144 Hz host after warmup:

| Route | Average frame interval | p95 interval | Sampled render |
| --- | ---: | ---: | --- |
| High / pilot / `traits=v1` | 6.939 ms | 8.400 ms | 368 calls / 184,615 triangles |
| High / pilot / `traits=off` | 6.922 ms | 8.200 ms | 467 calls / 143,219 triangles |

The measured average delta was +0.018 ms (about +0.26%) with the visual pilot
enabled. The draw-call count falls because the authored instanced treatment
replaces more expensive procedural scatter in the sampled frame; visible
triangles rise by 41,396. This is a bounded local comparison, not evidence about
thermal behavior, long-session memory, or a physical reference device.

The normalized pond view shows a decisive environment change rather than minor
asset scatter: `Earthworm` reads as a large mushroom cluster, `Carrot` as a
rounded tree, Flower Hill creates bank mass, and the leaves and small mushrooms
make the waterline feel inhabited. The matching `traits=off` view is visibly
sparser and more generic. At camp, the two tree-like canonical forms break up
the procedural orchard silhouette while repeated small mushrooms visually link
the grove back to the pond.

## Fallback and next gate

- Exact rollback: `?traits=off`; it performs zero Trait Echo requests.
- Each v1 family fails independently; procedural nature and the complete town
  remain available and startup must continue.
- Human fresh-player comprehension and a physical reference-device route remain
  phase-refinement/support checks. The operator route now covers close-camera
  scale, touch prompt clearance, rollback, and comparative frame time.
- Because only 31,801 production bytes remain, add no more runtime assets before
  either optimizing the package or deliberately revisiting its ceiling.
