# Records and handoff templates

Copy only the relevant template sections. Replace every placeholder with verified evidence. Treat `assets-src/asset-manifest.json` and `scripts/check-asset-budgets.mjs` as authoritative if these examples ever drift.

## Contents

- [`SOURCE.md`](#sourcemd)
- [`PROVENANCE.md`](#provenancemd)
- [Manifest family entry](#manifest-family-entry)
- [Runtime asset entry](#runtime-asset-entry)
- [Tracked source-binary entry](#tracked-source-binary-entry)
- [Focused QA record](#focused-qa-record)
- [Final handoff](#final-handoff)

## `SOURCE.md`

````markdown
# <Asset family> source

## Ownership and permission

- Manifest family ID: `<family-id>`
- Creator or owning project: `<name>`
- Intended status: `<status accepted by the live audit>`
- Authorization family or license: `<family ID, ADR, or exact license>`
- Source item page: `<URL or none for wholly project-authored work>`
- Direct source URL or repository commit: `<URL/commit or none>`
- Retrieved or authored: `<YYYY-MM-DD>`
- License or permission evidence: `<exact grant and where it is recorded>`
- Raw-source redistribution allowed: `<true/false plus constraint>`
- Release blocker: `<none or exact unresolved fact>`

Do not replace missing evidence with “free,” “online,” or “owned by the repo.”

## Canonical inputs

| Input | Original filename | SHA-256 | Storage | Role |
| --- | --- | --- | --- | --- |
| `<path or URL>` | `<name>` | `<64 lowercase hex>` | `<git/git-lfs/external-archive>` | `<source/generator/reference>` |

- Intake batch: `<batch ID when source-binary batching applies>`
- External meshes, textures, fonts, HDRIs, scans, recordings, or samples: `<complete list or none>`

## Rebuild or transform

- Canonical source of truth: `<generator, editable file, or original download>`
- Tool and version: `<tool/version>`
- Generator version and deterministic seed: `<value or not applicable>`
- Units and axes: `<source and runtime conventions>`
- Transform summary: `<ordered edits and optimization>`
- Exact command:

  ```bash
  <rebuild/export command>
  ```

- Expected outputs: `<runtime paths and review-only artifacts>`
- Clean validation: `<re-import, hierarchy, duration, or media inspection>`
````

## `PROVENANCE.md`

```markdown
# <Asset family> runtime provenance

## Permission status

- Manifest family ID: `<family-id>`
- Creator: `<name>`
- Authorization family or license: `<family ID, ADR, or evidence summary>`
- Release blocked: `<yes/no>`
- Block reason: `<exact reason or none>`
- Raw-source redistribution: `<allowed/prohibited/unknown>`

## Runtime contract

| Runtime file | Source input | Transform | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| `<public/...>` | `<source path/URL>` | `<concise reproducible transform>` | `<bytes>` | `<64 lowercase hex>` |

- Runtime URL: `</path-under-public>`
- Format and version: `<format>`
- Dimensions, duration, or geometry: `<type-relevant measurements>`
- Units, up/front axes, origin: `<model fields when relevant>`
- Required roots, pivots, bones, clips, materials, or traits: `<names>`
- Loader and placement owner: `<config/visual module>`
- Default, selector, and fallback: `<baseline/pilot behavior>`
- Known constraints: `<quality, reduced motion, attribution, or adaptation limits>`

## Verification

- Deterministic validation: `<tests or re-import evidence>`
- Browser routes and modes: `<matrix>`
- Performance delta: `<same-device result>`
```

## Manifest family entry

Use the exact schema already present in the live manifest:

```json
"<family-id>": {
  "creator": "<creator>",
  "status": "<status accepted by the live audit>",
  "licenseOrPermission": "<evidence summary>",
  "sourcePage": "<exact item page or null for project-authored work>",
  "sourceRetrievedOn": "<YYYY-MM-DD or null for project-authored work>",
  "provenance": "public/<family>/PROVENANCE.md",
  "runtimeDistributionScope": "<required for project-release-authorized families>",
  "rawSourceRedistribution": false,
  "releaseBlocked": true,
  "releaseBlockReason": "<required truthful reason when blocked>"
}
```

Set `releaseBlocked` to `false` and omit `releaseBlockReason` only when the evidence supports it. Never change the status or blocker solely to pass strict release mode.

For canonical fRiENDSiES material, reference `friendsies-project` and ADR 0004
instead of creating per-token, per-trait, per-role, per-transform, or
per-revision permission language. Continue to record the exact source, hash,
transform, runtime scope, budgets, fallback, and QA evidence. Keep
`friendsies-animations` separate because its Mixamo source chain is governed by
its own family record.

## Runtime asset entry

```json
{
  "id": "<stable-id>",
  "path": "public/<family>/<runtime-file>",
  "runtime": true,
  "kind": "<kind consumed by the live audit>",
  "family": "<family-id>",
  "budgetGroups": ["<applicable-live-budget-group>"],
  "bytes": 0,
  "sha256": "<final-runtime-sha256>",
  "dimensions": { "width": 0, "height": 0 },
  "source": {
    "originalFilename": "<canonical-input-name>",
    "path": "<repository source or generator path>",
    "sha256": "<canonical-input-sha256>",
    "transform": "<reproducible source-to-runtime summary>"
  }
}
```

Use `source.url` instead of `source.path` for an external canonical input. Include `dimensions` only where the audit requires or the media contract benefits from it. Replace the placeholder byte and dimension values with measured integers after the final export.

## Tracked source-binary entry

Use only when a source binary belongs in the manifest and compare the result with the current audit schema:

```json
{
  "id": "<stable-source-id>",
  "path": "assets-src/<family>/<source-file>",
  "runtime": false,
  "kind": "<source-kind>",
  "family": "<family-id>",
  "storage": "<git/git-lfs/external-archive>",
  "intakeBatch": "<batch-id>",
  "bytes": 0,
  "sha256": "<tracked-file-sha256>",
  "source": {
    "originalFilename": "<original-name>",
    "url": "<direct-source-url>",
    "sha256": "<original-source-sha256>",
    "transform": "<downloaded unchanged or source-file transform>"
  }
}
```

## Focused QA record

```markdown
# <YYYY-MM-DD> <asset family> <pilot/release> QA

## Scope and decision gate

- Commit or worktree: `<commit and dirty/clean state>`
- Player-facing beat: `<beat>`
- Baseline/default: `<mode and paths>`
- Candidate: `<mode and paths>`
- Rollback: `<selector or fallback>`
- Gate: `<what must be learned or pass>`

## Environment

- Browser and version: `<value>`
- OS/device/GPU: `<value>`
- Viewport and quality: `<value>`
- Reduced motion/audio state: `<value>`

## Automated evidence

| Command | Result | Notes |
| --- | --- | --- |
| `npm run assets:audit` | `<pass/fail>` | `<development blockers>` |
| `npm run check` | `<pass/fail>` | `<tests/build/dist audit>` |
| `npm run assets:release` | `<pass/fail/not run>` | `<strict blocker>` |

## Browser matrix

| Mode | Day/night | Complete route | Offline/failed request | Console/network | Result |
| --- | --- | --- | --- | --- | --- |
| `<baseline>` | `<result>` | `<result>` | `<result>` | `<result>` | `<pass/fail>` |
| `<pilot>` | `<result>` | `<result>` | `<result>` | `<result>` | `<pass/fail>` |

## Comparison

- Readability and story tone: `<evidence>`
- Payload, requests, draws, geometry: `<baseline -> candidate>`
- Same-device median/p95 frame time: `<baseline -> candidate>`
- Gameplay contracts preserved: `<anchors, colliders, interactions, saves, endings>`

## Permission and release status

- Family status: `<manifest status>`
- Unresolved provenance or permission: `<none or exact blocker>`
- Decision: `<keep opt-in/make default/reject/needs player sessions>`
- Safest next gate: `<one action>`
```

## Final handoff

```markdown
Player-visible result: <one sentence>

- State: <local/opt-in/on main; internal/cross-cutting verified/release-ready candidate>
- Family and paths: <source, runtime, manifest, loader>
- Authorization or license: <family/ADR or evidence and status>
- Transform: <tool/version/command; source and runtime hashes>
- Budget delta: <bytes, dimensions/geometry/duration, deployment and frame-time impact>
- Default and rollback: <selector/fallback behavior>
- Automated evidence: <exact commands and outcomes>
- Browser evidence: <routes, modes, device, outcomes>
- Blockers: <none or exact unresolved facts>
- Next gate: <single safest next action>
```
