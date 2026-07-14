---
name: thornvale-ship-asset-family
description: Ship or change ThornVale creative asset families through the repository's permission, provenance, transformation, runtime, performance, rollback, test, QA, and release gates. Use when Codex adds, replaces, optimizes, rebakes, exports, or repurposes models, Blender sources, images or textures, animation GLBs, audio, CC0 or public-domain material, fRiENDSiES character traits, or the loaders, manifests, fallbacks, selectors, and records that control those assets.
---

# Ship a ThornVale Asset Family

Treat an asset as a chain of evidence and behavior, not as a binary to copy:

`authorization -> source record -> deterministic transform -> runtime output -> manifest -> loader and fallback -> tests -> browser comparison -> release decision`

Keep the change as a bounded, reversible pilot until the evidence supports making it the default. Never weaken the audit, relabel a permission status, or remove a release blocker merely to make a command pass.

## Establish the live contract

1. Confirm the repository root and inspect `git status --short --branch`. Preserve unrelated work.
2. Read `wiki/Plan-2.0.md`, `assets-src/README.md`, and the live `assets-src/asset-manifest.json`.
3. Read `wiki/Asset-Overhaul-Plan.md` when changing the opening-route pilot, CC0 intake, or fRiENDSiES trait treatment.
4. Read ADR 0005 when changing animation policy or release claims. Inspect `scripts/check-asset-budgets.mjs`, `package.json`, `docs/qa/README.md`, and `docs/release/README.md` before changing policy, budgets, or release claims.
5. Read only the closest existing example:
   - Project-authored Blender family: `assets-src/village-dressing/SOURCE.md`, `assets-src/village-dressing/EXPORT.md`, and `public/village/pilot/v1/PROVENANCE.md`.
   - fRiENDSiES character or trait family: `public/friendsies/8914/PROVENANCE.md` and `src/content/friendsies-cast.js`.
   - Animation derivative: `public/animations/PROVENANCE.md`.
6. Read [asset-family-checklists.md](references/asset-family-checklists.md) for the relevant media type. Read [records-and-handoff-templates.md](references/records-and-handoff-templates.md) before writing source, provenance, QA, or handoff records.

Use the live manifest and audit implementation for current statuses, fields, extensions, and budgets. Do not copy their values into a second policy source.

## Define one family and one gate

State before editing:

- the family ID and asset kind;
- the player-facing beat and milestone exit criterion it supports;
- the source inputs and intended runtime outputs;
- the exact loader, runtime URL, and stable gameplay contracts involved;
- the current baseline, proposed pilot selector, and failure fallback;
- the tests and browser routes that can prove equivalence or improvement; and
- whether the requested outcome is internal evaluation or a release candidate.

Prefer a versioned asset family or one bounded route over a whole-town replacement. Keep gameplay coordinates, interactable IDs, colliders, story state, and save data authoritative outside the visual asset unless the task explicitly changes those contracts.

## Resolve authorization before intake

Classify the family from evidence before adding a binary:

| Evidence | Action |
| --- | --- |
| Entirely authored for ThornVale with external inputs accounted for | Use the live project-authored status and record the generator, authoring inputs, and repository terms. |
| Exact hashed runtime files have an explicit owner or licensor grant for bundled ThornVale releases, while standalone or raw-source redistribution remains excluded | Use the live project-release-authorized status, record the runtime distribution scope, and keep raw-source redistribution false. |
| Exact item is verifiably dedicated under CC0 1.0 or an accepted public-domain grant | Record the item page, creator, exact grant, retrieval date, original file, direct URL, hashes, and raw-source redistribution rule before admitting it. |
| The owner requested project use but formal redistribution or adaptation terms remain unresolved | Use only the audit's explicit development exception, set `releaseBlocked: true` with the truthful reason, and describe the result as internal or development-evaluable. |
| License, ownership, source item, or permission is unknown | Keep the binary out of `public/` and the current tree. Retain only a text tombstone when hash or history is useful. |
| Terms prohibit the intended use or redistribution | Reject the asset and record the decision without importing it. |

Do not infer rights from public availability, a free download, a collection-level label, repository ownership, or access to the file. For CC0/public-domain intake, verify the exact item rather than only the hosting site or pack. For audio, account for recording, performance, and composition rights as applicable.

Canonical fRiENDSiES assets and metadata are the standing exception to per-item
permission review. ADR 0004 authorizes current and future canonical collection
revisions for any integrated ThornVale use under the `friendsies-project`
family, including characters, detached traits, hand items, sprouts, backpieces,
tools, equipment, props, environments, UI, documentation, testing, promotional
captures, streaming, local bundling or caching, optimization, transformation,
and derivative runtime assets. Do not ask for or block on a new permission
decision because a token, asset, role, context, transform, delivery method, or
canonical revision changes.

For that material, still identify the exact token or trait when applicable,
canonical source asset and metadata revision, selected URL, and hashes. These
records prove source identity and reproducibility, not a new rights grant.
Distinguish an unchanged canonical trait, a binary derivative, and a
ThornVale-authored arrangement so transforms and runtime behavior remain
auditable. The standing authorization excludes standalone packs, bulk raw
mirrors or dumps, sublicensing, and reuse outside ThornVale.

All current and future animation sources and derivatives that the Thornvale
project owner controls or may lawfully use inherit the standing animation
authorization in ADR 0005 for any integrated Thornvale use. Do not ask for or
block on another project-owner permission decision because a file, clip, pack,
rig, role, context, transform, delivery method, or revision changes. This does
not establish or broaden upstream rights: verify the exact source and every
applicable motion, performance, character, mesh, material, texture, audio,
repository, and product-use term. Unknown or incompatible upstream rights remain
valid blockers. Raw-source redistribution, standalone animation or motion packs,
sublicensing, and outside-Thornvale use remain excluded.

Keep animation provenance separate from canonical fRiENDSiES provenance.
`friendsies-animations`, `friendsies-story-actions-v1`, and future animation
families use ADR 0005 for project-owner authorization while retaining their own
Mixamo, repository, or other upstream source and license records. An animated
fRiENDSiES character may rely on both ADR 0004 and ADR 0005 without merging the
two provenance families.

If required upstream or unrelated third-party authority cannot be verified,
continue with metadata, placeholders, procedural fallbacks, or a non-runtime
evaluation plan. Do not manufacture permission evidence or request another
project-owner grant for animation already covered by ADR 0005.

## Preserve baseline and rollback

1. Record the current path, payload, draw or primitive counts, and same-route browser behavior before replacing anything.
2. Preserve stable `public/` URLs. If a pilot needs a new path, version it and update loader code, manifest entries, tests, and provenance together.
3. Keep the known-good procedural or previous-version fallback. Make the baseline the default until the pilot passes its gate.
4. Make loader failure local and recoverable. A missing optional asset must not block startup or the complete story route.
5. Add no startup-blocking network dependency. Bundle an approved local fallback.
6. Reuse the existing selectors when applicable: `?assets=baseline|pilot` for environment art and `?traits=off|v1` for Trait Echo. Do not invent a new selector when a loader fallback is sufficient.

## Create source and runtime records

Place editable, high-fidelity, and intermediate inputs in `assets-src/<family>/`. Place only optimized deployment outputs in `public/<family>/`. Never point runtime code at `assets-src/`.

Create or update:

- `assets-src/<family>/SOURCE.md` for creator, source item, authorization or license, acquisition, editable inputs, tool versions, rebuild command, and transforms;
- an `EXPORT.md` only when the family has a substantial, repeatable export contract;
- `public/<family>/PROVENANCE.md` for runtime filenames, hashes, transformations, dimensions or geometry, loader contract, redistribution constraints, and release status;
- `assets-src/asset-manifest.json` for every managed runtime file and any tracked source binary; and
- `CREDITS.md` or `NOTICE.md` only when the project-level attribution or legal surface actually changes.

Choose `git`, `git-lfs`, or an approved external archive for source binaries according to the live manifest thresholds. Decide storage before importing an oversized file or intake batch.

Use the templates in [records-and-handoff-templates.md](references/records-and-handoff-templates.md), but omit irrelevant fields and replace every placeholder with evidence.

## Make transforms reproducible

Prefer an existing repository generator or exporter. Add or extend a repository script only when the transformation is repeatable and materially safer than manual export; do not add a duplicate audit script to this skill.

Record:

- original filename, source URL or repository commit, original SHA-256, and acquisition date;
- tool and version, generator version, deterministic seed, and exact command;
- units, up/front axes, origin, root names, pivots, hierarchy, clip names, and material or texture policy;
- optimization, recoloring, rebaking, trimming, compression, mesh removal, and export flags; and
- final bytes, SHA-256, dimensions, duration, geometry counts, and runtime path as applicable.

Regenerate from a clean scene or input when possible. Validate a Blender or glTF output through clean re-import and inspect named roots and pivots. Treat generated `.blend` or preview files according to the family's documented source-of-truth rule rather than hand-editing generated artifacts.

Compute hashes and byte counts only after the runtime output is final. Keep `source.sha256` tied to the canonical input or generator declared by the manifest, not to a convenient later file.

## Wire runtime behavior without moving authority

Keep selection policy in `src/config/`, curated cast data in `src/content/`, and loading or projection in `src/visuals/`. Let visuals and audio consume authoritative story state; do not make an asset loader the source of gameplay truth.

Preserve the runtime contract:

- exact root, bone, clip, material-role, and trait names;
- authored scale, axis, origin, and placement normalization;
- gameplay anchors, interaction ranges, colliders, and story IDs;
- independent failure and fallback per optional family or root;
- disposal of GPU, audio, and event resources; and
- reduced-motion, quality-mode, and offline behavior.

Keep backlog-only or technically unapproved fRiENDSiES traits data-only: no
runtime URL, preload, request, or bundled binary until their design role,
variant selection, performance, and fallback are ready. This is a curation and
engineering boundary, not a rights boundary. Keep curated local characters
independent of a full remote metadata index.

## Add contract tests

Add focused deterministic coverage that fails when the asset contract breaks. Test the applicable seams:

- manifest schema, hashes, byte counts, dimensions, storage, statuses, and budget groups;
- expected GLB roots, hierarchy, pivots, clip names, skeleton compatibility, geometry, and payload limits;
- stable runtime paths and config parsing;
- baseline/pilot selection, unknown selector fallback, denied or missing request fallback, and per-root recovery;
- no request for excluded or backlog-only traits;
- audio/image/model loader failure without startup or story-route failure; and
- preservation of interactables, colliders, saves, and both endings when presentation changes.

Keep tests offline and deterministic. Extend the existing audit or focused test owner only when the live contract needs new enforcement; do not reproduce `scripts/check-asset-budgets.mjs` elsewhere.

## Verify in escalating order

Run focused tests and the development audit while iterating:

```bash
npm run test -- tests/<relevant-test>.test.js
npm run assets:audit
```

Interpret `Asset audit passed for development; release blockers remain` literally. It proves manifest and budget integrity for a development build, not redistribution readiness.

Before handing off a cross-cutting asset change, run:

```bash
npm run check
```

Then complete the targeted browser smoke pass from `docs/qa/README.md`. Compare baseline and pilot on the same route, browser, quality mode, viewport, and reference device. Exercise day and night, reduced motion, failed asset requests or offline startup, the complete Core Hook route, save/reset, and both endings when relevant. Record readability, console or network failures, payload and draw/geometry deltas, and same-device frame-time evidence.

For a release candidate only, follow `docs/release/README.md` and run the strict gate against a freshly built `dist/`:

```bash
npm run assets:release
```

Do not bypass an expected permission failure for unrelated third-party material,
delete a blocked family from the manifest while it remains in runtime, or call
a candidate release-ready until this command passes. Canonical fRiENDSiES work
must inherit `friendsies-project`; a per-use permission blocker for that family
is policy drift to fix, not a new grant to litigate. Covered animation work must
inherit ADR 0005; a repeated Thornvale-owner permission blocker is likewise
policy drift, while an unresolved upstream license or source remains a valid
release blocker.

## Hand off truthfully

Distinguish these states:

- **Internal or development-evaluable:** the asset and manifest may pass the development audit, but at least one permission, provenance, browser, performance, or player-learning gate remains.
- **Cross-cutting verified:** `npm run check` passes and the recorded browser matrix passes, but strict release blockers may remain.
- **Release-ready candidate:** the intended commit is known, all relevant browser and release checks pass, and `npm run assets:release` passes with no unresolved family.

Report the player-visible effect, family and paths changed, source and
authorization or license reference, transforms and hashes, payload or
performance delta, selector/default/fallback behavior, automated and browser
evidence, unresolved blockers, and safest next gate. State whether the work is
committed, on `main`, opt-in, or only local. Use the handoff template in
[records-and-handoff-templates.md](references/records-and-handoff-templates.md).
