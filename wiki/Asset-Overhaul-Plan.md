# Thornvale Asset Overhaul Test Plan

> Improve the first five minutes without widening the game.

| Field | Value |
| --- | --- |
| Status | Landmark Pilot v1 and Trait Echo v1 implemented and locally verified; asset authorization cleared; fresh-player and reference-device validation pending |
| Baseline | `origin/main` at `5e28cd6644921be78cb4c7b53b5735c3594eb965` |
| Integration branch | `codex/integrate-aesthetic-v1` |
| Primary surface | Spawn, welcome gate, Ledger/Bell plaza, and Steward Lumen |
| Default behavior | Authored pilot + Trait Echo v1; existing v0.3 presentation remains the explicit fallback |
| Expansion gate | Asset, performance, provenance, and five-player validation |

## Build snapshot — 2026-07-12

- `?assets=baseline|pilot` is implemented with the authored pilot as the local
  development default and baseline as the explicit/unknown-value rollback.
  Baseline restores the v0.3 procedural landmarks, 64 static grass tufts, and
  six legacy butterflies while skipping the pilot-plaza request and the new
  breathing-grass/dragonfly owners.
- `?traits=off|v1` is implemented independently with `v1` as the local default, so
  either landmark treatment can be evaluated with or without trait echoes.
- The versioned Welcome Gate, Community Ledger, and Town Bell pilot is built,
  independently fallible, and covered by asset/runtime contract tests.
- The current Second Witness refinement of Trait Echo v1 reuses three Flower
  White, three Torch, and one Crown Up placements from the already bundled
  `#0001` and `#8914` GLBs. It adds zero asset bytes, three trait draw families,
  and 26,544 displayed trait triangles. One shared code-native civic-mount draw
  grounds the offerings, sconces, and crest. A successful real flower load
  replaces 56 central procedural placeholders.
- Breathing grass adds organic meadow motion in one instanced draw. Low,
  medium, and high quality use 192, 432, and 800 deterministic placements;
  authored clearances protect paths, story routes, buildings, landmarks, the
  pond, and props, while reduced-motion mode keeps the grass static.
- A pinned source-only index covers all 10,000 tokens, 1,077 named traits, and
  1,447 distinct asset/preview variants; the local atlas, curation sidecar, and
  per-candidate GLB probe turn that metadata into a reusable casting workflow.
- The curated local cast uses `#6602` as the bundled default player and `#8914`
  as Steward Lumen. Only `#0001` Flower White remains as a Trait Echo source;
  its superseded player-only files were removed. Newly proposed Book/Friends
  Key, All Seeing, and Orb traits remain excluded from Trait Echo/environmental
  requests and bundled release assets even though the source-only atlas can
  catalog and compare them. Bounded remote player selection is a separate,
  manifest-declared external dependency and may stream those traits only when
  they are components of a selected in-game player token.
- Dormant, unknown-license EXR/PNG references have been removed from the current
  tree, with a text-only hash/history tombstone retained. Production `dist/`
  dropped from about 18.2 MiB to 7.73 MiB.
- The asset manifest, credits/notice, budget audit, and CI-facing `npm run check`
  gate are implemented.
- The exact local `#0001`, `#6602`, and `#8914` runtime families and documented
  Trait Echo v1 uses are project-release-authorized for bundled Thornvale builds.
  Raw/standalone redistribution remains prohibited. The separate arbitrary-
  token remote-streaming family is project-release-authorized only for the
  pinned `1..10000` player range and recorded component origin inside published
  Thornvale builds.
- No external CC0 runtime assets have been admitted yet. Five fresh-player
  comparisons and a same-device frame-time profile still gate expansion.

## 1. Decision

Run the overhaul as a reversible pilot around the opening route. Do not replace
the whole village or add new gameplay systems until the pilot proves that the
new asset language improves readability, story tone, and production speed.

The pilot has three jobs:

1. turn fRiENDSiES hand and accessory traits into authored story signals;
2. prove a safe intake path for project-authored and CC0 support assets; and
3. reduce deployment weight while preserving the complete v0.3 fallback.

## 2. Why this is the right scope

The current release already has a complete first-run story, authored cottages,
village dressing, local character fallbacks, and 39 passing tests. The next
product gate is five fresh-player sessions, not a larger feature list.

The opening route is the best asset test surface because it includes:

- the first character and environment impression;
- both the Community Ledger and Town Bell interactions;
- Steward Lumen's friendly and corrective roles;
- day, dusk, and night lighting;
- camera, collision, and wayfinding pressure; and
- the comply/alter split without requiring another system.

## 3. Guardrails

### In scope

- A baseline/pilot selector such as `?assets=baseline|pilot`.
- A small, versioned arrival/plaza art kit with procedural fallbacks.
- A curated fRiENDSiES cast and trait manifest.
- Story-driven presentation for a small number of hand/accessory traits.
- At most twelve CC0 supporting assets in the first intake batch.
- An asset manifest, automated budget check, and adjacent provenance records.
- Before/after screenshots, frame measurements, and fresh-player observations.

### Out of scope

- A full-town replacement.
- New villagers, quests, inventory, crafting, combat, or multiplayer.
- Bundling the full fRiENDSiES collection or fetching its full metadata index for
  a curated cast.
- Replacing the current cottages, sky, particles, or character skeleton.
- Photoreal materials that bypass Thornvale's palette and material treatment.
- CC BY-NC, unclear “free,” ripped, or item-level unverified assets.
- Shipping newly selected fRiENDSiES traits before their exact redistribution
  permission is recorded.

## 4. Current baseline

Record the baseline again at implementation start, but use these figures as the
initial comparison:

| Surface | Current reference |
| --- | ---: |
| Production `dist/` | about 18.2 MiB |
| Unreferenced EXR + cloud PNG in `public/` | 11,625,584 bytes |
| Cottage + village runtime GLBs | 970,068 bytes |
| Cottage + village geometry | about 40,336 triangles / 71 primitives |
| Bundled Steward `#8914` parts | about 1.61 MiB / 43,344 triangles |
| Automated checks | 39 tests plus production build |

The EXR and cloud PNG were not requested by runtime code, but Vite copied them
into every deployment. Their current-tree copies are now removed because their
source and redistribution terms could not be verified; only a text tombstone
under `assets-src/references/` remains.

## 5. Pilot design: “The Courtesy Kit”

### 5.1 Arrival and plaza art

Author or refine only three recognizable roots:

- `WelcomeGate`: makes the first route and threshold legible;
- `CommunityLedger`: reads as the town's institutional center; and
- `TownBell`: reads at dusk and remains identifiable during the anomaly.

Export these in a new versioned GLB. Keep all gameplay coordinates,
interactable IDs, interaction radii, Rapier colliders, camera proxies, and story
state unchanged. Existing procedural factories remain the per-root fallback.

### 5.2 Trait-driven story signal — v1 implemented

Trait Echo v1 formalizes the first semantic rule: sprouts communicate identity
or office; hand items communicate intent. It uses only traits already bundled
for the local cast:

| Trait family | Placement strategy | Meaning |
| --- | --- | --- |
| Three `#0001` Flower White hand items | One private arrival offering and a paired set of Ledger witnesses | Offered and witnessed kindness |
| Three `#8914` Torch hand items | Paired mounted Gate sconces and one Bell ritual sconce | Civic guidance becoming dusk ritual and authority |
| One `#8914` Crown Up sprout | Above the Community Ledger | Civic identity and office |

Each trait has one semantic job. Paired objects express the town's shared
account; the single arrival flower remains private. This **Second Witness**
rule gives the collection a repeatable civic grammar without scattering traits
as generic decoration.

The runtime selector is `?traits=v1`; `?traits=off` is the explicit rollback.
It is deliberately independent of `?assets=baseline|pilot`, creating a clean
four-way comparison between landmark art and trait treatment. Missing values
use `v1`; explicit `off` and unknown values use the safe rollback.

The presentation reacts to durable story state without changing gameplay:

- Arrival begins with one private offering, restrained Ledger witnesses, and
  independently flickering Gate sconces; meeting Lumen completes the welcome
  arrangement.
- Signing the Ledger raises the Bell Torch as a dusk guide. Its light settles
  after the first ring.
- The impossible second bell breaks agreement in the Ledger witness pair,
  tilts the Crown, synchronizes the Gate sconces into impossible stillness, and
  removes the Bell's guiding light.
- The false-record intervention closes the Ledger witnesses toward the record,
  tilts the Crown farther, and nearly extinguishes the Torches.
- Comply restores perfect mirrored agreement and a warmer shared guide state.
  Alter preserves one dissenting witness, the strongest Crown tilt, and an
  asymmetric cold Gate treatment.
- Reduced-motion mode keeps those semantic state changes but removes ambient
  flower sway and Torch flicker.

The first same-day proof used nine placements—four Flower, four Torch, and one
Crown—and displayed 34,720 trait triangles. The Second Witness refinement
removed the duplicate arrival flower and freestanding arrival Torch. The
current seven placements are decorative, independently fallible by trait
family, and reuse the local source GLBs by baking their rigid frame-zero poses
in memory. They add zero new asset bytes, render through three trait
`InstancedMesh` draws, and display 26,544 trait triangles: 14,436 Flower,
10,092 Torch, and 2,016 Crown. One additional shared, code-native civic-mount
draw physically grounds all seven placements without adding a trait binary.

This is a Thornvale-authored arrangement, not a canonical token composition.
Runtime and provenance data preserve the source token and trait for every
family. The exact manifested `friendsies-0001` and `friendsies-8914` files and
this documented Trait Echo v1 use are project-release-authorized for integrated
bundled Thornvale builds. Raw-source, standalone asset-pack, collection-wide,
and outside-project redistribution remain prohibited. `?traits=off` is the
exact independent rollback.

That statement is scoped to Trait Echo. Shareable non-bundled player links can
stream any selected token's character components, including its hand and sprout
traits, from the pinned collection catalog. The manifest records that path as
the separate `friendsies-remote-player-streaming` dependency. It is authorized
for published Thornvale builds only under the pinned catalog, `1..10000` token
range, `https://storage.googleapis.com` component origin, and integrated player-
avatar role. That grant does not approve environmental use, bundling, raw
copying, mirroring, standalone packs, sublicensing, or outside-project use.

The following extension points are indexed and curatable but intentionally
have no Trait Echo/environmental runtime URL in v1:

- `Book Of Ocean` and `Friends Key` from token `#431`: records and access,
  cataloged and metadata-probed but pending decoded-rig, permission, provenance,
  and budget review.
- `All Seeing` and `Orb`: uncanny observation, cataloged as anomaly-only holds
  pending exact variant selection, permission, provenance, and budget review.

Candidate full tokens such as `#431`, `#1161`, `#54`, `#669`, and `#974` may be
previewed during internal casting, but they are not automatically approved for
bundling or release.

### 5.3 CC0 support batch

The first intake batch is capped at twelve runtime assets:

| Category | Maximum | Intended use |
| --- | ---: | --- |
| Stylized 3D props | 4 | Garden, domestic, or plaza detail |
| Audio one-shots | 4 | Bell, paper/ink, knock, footsteps, cloth, or hedge wind |
| Botanical/ritual images | 2 | Ledger ornament or cottage/plaza ephemera |
| Input/UI assets | 2 | Clear interaction guidance |

Preferred sources:

- Quaternius CC0 packs for stylized nature, interiors, and small props:
  <https://quaternius.com/packs/ultimatestylizednature.html>
- Kenney CC0 input prompts and interface sounds:
  <https://www.kenney.nl/assets/input-prompts>
- Poly Haven or ambientCG CC0 materials used as low-resolution authoring inputs,
  then rebaked into Thornvale's palette: <https://polyhaven.com/license> and
  <https://ambientcg.com/>
- Freesound items explicitly marked CC0, with the individual upload page and
  license snapshot retained: <https://freesound.org/help/faq/>
- Smithsonian or The Met items explicitly marked CC0 for botanical and ritual
  reference: <https://www.si.edu/openaccess> and
  <https://www.metmuseum.org/hubs/open-access>

External assets are supporting ingredients. Hero forms and the final material
treatment remain Thornvale-authored.

## 6. Provenance and storage gate

Every candidate receives one of these statuses:

- `project-authored`
- `cc0-1.0-verified`
- `project-release-authorized`
- `project-use-recorded`
- `internal-evaluation-only`
- `blocked`

`project-authored`, `cc0-1.0-verified`, and `project-release-authorized` are
release-approved. The last status applies only to exact hashed runtime files
with a recorded owner or licensor grant for bundled Thornvale builds, an
explicit runtime-distribution scope, and raw-source redistribution disabled. It
does not grant general or standalone asset reuse.
`project-use-recorded` may remain in a development build only as an explicit
release-blocked exception while formal terms are pending. The other statuses
may not enter runtime. For every imported file, record:

- source page and direct download URL;
- creator or owning project;
- exact license or permission text and retrieval date;
- original filename and SHA-256;
- modifications, Blender/export settings, and optimization steps;
- runtime filename and SHA-256; and
- whether raw-source redistribution is allowed.

Use the repository's existing flow:

```text
assets-src/<asset-family>/SOURCE.md
  -> authored or optimized output
  -> public/<asset-family>/PROVENANCE.md
```

Add a machine-readable manifest used by the asset audit. It covers both managed
local files and external runtime asset dependencies. A missing or unresolved
entry blocks the pilot from becoming the default, and a release-blocked external
family fails the strict audit even when it owns no local file.

There is currently no Git LFS policy. Before importing any single source binary
over 10 MiB, or more than 25 MiB of new source binaries in one phase, decide
whether the source belongs in LFS or an approved external archive. Runtime files
remain versioned with the code when they meet the budgets below.

The repository also needs explicit root usage terms or a proprietary notice;
“the same terms as the repository” is not sufficient while no root license
exists.

## 7. Performance and visual budgets

| Surface | Pilot limit |
| --- | ---: |
| Production `dist/` | 8 MiB or less after dormant-file cleanup |
| Active cottage + village GLB payload | 1.5 MiB or less |
| Versioned arrival/plaza pilot GLB | 800 KiB / 22k triangles / 50 primitives |
| Assembled fRiENDSiES character | 1.75 MiB / 50k triangles / 6 primitives |
| New CC0 runtime payload | 2 MiB maximum total |
| Added visible draw calls on opening route | 12 maximum |
| Trait Echo v1 runtime payload | zero new bytes (reuses bundled local GLBs) |
| Trait Echo v1 rendering | 3 trait `InstancedMesh` draws + 1 shared code-native civic-mount draw / 26,544 displayed trait triangles |
| Breathing grass | 1 instanced draw / 192 low, 432 medium, or 800 high placements |
| Frame-time regression on the same reference device | 10% median maximum |
| p95 frame time | 25 ms maximum |
| Environment textures | 1024 px and 512 KiB each maximum |
| New compressed audio | 500 KiB maximum total |
| New startup-blocking network dependencies on the bundled/default route | zero |
| Added asset provenance coverage | 100% |

The pilot must remain readable in high and low quality, day and night, and with
reduced motion enabled. A visually attractive asset that breaks the palette,
silhouette hierarchy, or interaction clarity does not pass.

## 8. Implementation phases

### Phase 0 — Baseline and rollback

- Capture clean day/night screenshots of the opening route.
- Record `dist/`, GLB, triangle, primitive, request, and frame-time baselines.
- Add the baseline/pilot selector with an explicit baseline rollback.
- Prove that a failed pilot-asset request falls back per root.

### Phase 1 — Intake and cleanup

- Remove the unused, unknown-license EXR and cloud PNG from the current tree and
  retain only their text tombstone.
- Add the machine-readable asset manifest and audit script.
- Add repository usage terms/notice and a human-readable credits file.
- Decide the large-source storage policy before importing a pack.

### Phase 2 — Authored arrival/plaza kit

- Extend the village-dressing Blender generator with the three pilot roots.
- Export to a new versioned GLB; do not overwrite the known-good asset.
- Preserve procedural visuals and all gameplay/collision contracts.
- Add hierarchy, size, geometry, and fallback tests.

### Phase 3 — Curated cast and traits

- Move bundled character definitions out of `CharacterLoader.js` into a small
  cast manifest.
- Add role, story-use, permission, and presentation behavior data.
- Keep the full remote collection index off the curated runtime path.
- Implement the reversible three-Flower/three-Torch/one-Crown Second Witness
  refinement using only the already bundled local traits.
- Build a pinned collection index, visual atlas, curation sidecar, and
  one-candidate-at-a-time technical probe for the complete trait library.
- Keep Book/Friends Key, All Seeing, and Orb out of Trait Echo/environmental
  runtime requests until their exact permission, provenance, and budgets are
  approved. Remote full-token player streaming remains a separate
  release-blocked development contract.

### Phase 4 — CC0 support batch

- Intake no more than the twelve approved assets above.
- Recolor, simplify, merge, or bake them into the Thornvale art language.
- Reject assets that require a second rendering/material pipeline.

### Phase 5 — Validation and decision

- Run automated checks, asset audit, and browser smoke coverage.
- Compare baseline and pilot on identical routes and hardware.
- Run five fresh-player sessions.
- Expand to one cottage district only after every gate passes.

## 9. File-specific implementation map

| File or area | Planned responsibility |
| --- | --- |
| `src/config/assets.js` | Parse baseline/pilot selection and expose immutable asset policy. |
| `src/config/trait-echoes.js` | Define v1 semantics, placements, budgets, and non-runtime backlog entries. |
| `src/config/town.js` | Add pilot IDs and placements without moving gameplay anchors. |
| `src/content/friendsies-cast.js` | Curated tokens, traits, roles, story uses, and permission status. |
| `src/visuals/TownAssetLoader.js` | Load versioned pilot roots with per-root fallback. |
| `src/visuals/FriendsiesTraitEchoes.js` | Bake, instance, animate, and dispose environmental trait families. |
| `src/visuals/BreathingGrass.js` | Generate one deterministic, quality-scaled meadow draw with authored clearances and static reduced-motion behavior. |
| `src/visuals/CharacterLoader.js` | Consume the cast manifest and data-driven trait behavior. |
| `src/game/TownBuilder.js` | Select authored visuals and independent trait echoes while retaining interactables and colliders. |
| `src/visuals/CozyTownKit.js` | Preserve procedural fallback factories. |
| `scripts/build-village-dressing.py` | Generate and validate the arrival/plaza roots. |
| `scripts/check-asset-budgets.mjs` | Enforce local/external manifest, size, and allowed-permission rules. |
| `assets-src/<family>/SOURCE.md` | Record original source, permission, and transforms. |
| `public/<family>/PROVENANCE.md` | Record runtime hashes and redistribution constraints. |
| `tests/town-assets.test.js` | Verify roots, hierarchy, geometry, size, and fallback contracts. |
| `tests/friendsies-cast.test.js` and Trait Echo tests | Verify exact trait resolution, excluded backlog, placement budgets, instancing, and story projection. |
| `docs/qa/` | Retain baseline/pilot evidence and reference-device results. |
| `package.json` / CI | Run `assets:audit` with the standard verification suite. |

## 10. Acceptance gates

### Technical

- `npm run check` and the new asset audit pass.
- The browser smoke test boots baseline and pilot without console errors or 404s.
- All four `assets`/`traits` selector combinations boot independently, and
  `?traits=off` creates no Trait Echo scene root or requests.
- Trait Echo v1 uses seven placements, three trait instanced draws plus one
  shared code-native civic-mount draw, 26,544 displayed trait triangles, and no
  newly bundled asset bytes.
- The story-state projections and reduced-motion behavior match the semantic
  contract in section 5.2 without changing saves or interactions.
- Book/Friends Key, All Seeing, and Orb remain absent from Trait
  Echo/environmental requests and bundled release assets. Arbitrary-token
  player streaming is tracked separately and is release-authorized only for
  integrated player-avatar assembly under its pinned manifest contract.
- Blocking the pilot GLB still leaves a completable v0.3 route.
- No curated cast member requires the full remote metadata index at runtime.
- Both story endings, save restore, reset, collisions, and camera behavior remain
  unchanged.

### Player-facing

- At least four of five fresh testers reach the Ledger and Bell without help.
- At least four of five identify Lumen as both guide and authority before the
  intervention explains it.
- At least three of five notice a meaningful visual change when Lumen's role
  changes, without being told to inspect the trait.
- At least four of five describe the pilot assets as belonging to the same world.
- No tester mistakes decorative CC0 dressing for an interactable objective.

### Release and ownership

- Every added runtime file and external asset dependency has a verified manifest
  entry and adjacent provenance or decision record.
- No `internal-evaluation-only` or `blocked` file appears in the release build.
- Repository usage terms and credits are explicit.
- Baseline landmarks, grass, ambient insects, and `traits=off` remain the
  explicit immediate rollback;
  the authored treatment stays blocked from release until all release gates pass.

## 11. Rollback and commit strategy

- Keep baseline and pilot on different versioned asset URLs.
- Keep `?assets=baseline` as an immediate landmark, grass, and ambient-insect
  runtime rollback.
- Keep `?traits=off` as an independent immediate Trait Echo rollback.
- Never delete the procedural factories during the pilot.
- Do not move story anchors, colliders, or save-state fields for visual work.
- Commit separately: documentation/budgets, dormant-file cleanup, pilot GLB,
  runtime selector/fallback, trait catalog, then CC0 support batch.
- If a phase fails, revert that phase without unwinding the v0.3 core hook.

## 12. Go / no-go decision

Proceed beyond the opening route only when the pilot:

- meets every performance and provenance budget;
- improves wayfinding or role readability in observed play;
- preserves the cozy-with-teeth art direction;
- reduces repeat asset-production effort; and
- remains fully reversible.

If it does not, retain the catalog, provenance audit, and deployment cleanup,
then discard the visual pilot without expanding it.
