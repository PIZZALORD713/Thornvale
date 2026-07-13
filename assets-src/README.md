# Source Assets

This directory is the workspace for editable, high-fidelity, or intermediate
art and audio inputs. It is not served by Vite and must never be referenced by
runtime URLs.

The machine-readable [`asset-manifest.json`](asset-manifest.json) is the source
of truth for shipped creative media, reference-only files, permission status,
exact hashes, and byte budgets. Run `npm run assets:audit` after any asset
change; run it with `-- --dist` after a production build to enforce the complete
8 MiB deployment cap.

## Source-to-runtime flow

```text
assets-src/<asset-family>/
  -> documented export or optimization
  -> public/<asset-family>/
  -> copied unchanged into dist/ by Vite
```

- Add a real asset-family subdirectory only when source files arrive.
- Include source URL or creator, license/permission, acquisition date, and export
  settings in a `SOURCE.md` beside the editable inputs.
- Add large binary sources only when repository storage is intentional; use an
  approved external store or Git LFS when normal Git is not appropriate.
- Do not assume that possessing a source file grants redistribution rights.
- Record runtime filenames, transforms, hashes where useful, and redistribution
  constraints in `public/<asset-family>/PROVENANCE.md`.
- Preserve stable `public/` paths unless the loading code and release checks are
  updated together.
- Do not retain unknown-license binaries in the current tree. Keep a text-only
  tombstone under `references/` when hashes or repository history are useful,
  and do not restore the binary until its source and permission are verified.

Existing runtime animation and character assets remain in `public/` with their
current provenance records. They are not moved here merely to satisfy the new
layout.

Trait Echo v1 reuses three of those character GLBs in memory without creating
derived binaries. Their manifest entries retain the character budget groups
and add `environment:trait-echo-v1:*` runtime contexts so reuse remains visible
without double-counting the same deployed bytes.

## fRiENDSiES collection intelligence

[`friendsies/trait-index.json`](friendsies/trait-index.json) is a deterministic,
source-only catalog generated from the exact metadata revision used by the
character loader. It records every named trait, distinct visual variant,
frequency, source URL, preview URL, and associated token ID. It is intentionally
outside `public/`, so the 2.7 MB developer index is not copied into the game.

Regenerate it with `npm run friendsies:index`, browse it with
`npm run friendsies:atlas`, and inspect shortlisted GLBs one at a time with
`npm run friendsies:probe`. Indexing or probing is research, not approval:
runtime promotion still requires curation, provenance, rights, performance,
placement, and visual QA.

See the [folder guide](friendsies/README.md) for the index, curation, and probe
artifacts as one workflow.
