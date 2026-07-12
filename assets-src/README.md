# Source Assets

This directory is the workspace for editable, high-fidelity, or intermediate
art and audio inputs. It is not served by Vite and must never be referenced by
runtime URLs.

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

Existing runtime animation and character assets remain in `public/` with their
current provenance records. They are not moved here merely to satisfy the new
layout.
