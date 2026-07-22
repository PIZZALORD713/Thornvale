# fRiENDSiES trait research

This folder is the source-only collection intelligence layer for Thornvale. It
is not served by Vite and does not make any trait a runtime or release asset.

- `trait-index.json` deterministically groups the pinned 10,000-token metadata
  into exact named traits and distinct preview/asset variants.
- `trait-curation.json` records the bounded, human-reviewed environmental
  vocabulary: active, shortlist, and hold.
- `trait-probes.json` records metadata-only GLB inspections for selected
  candidates. The downloaded GLBs are held in memory and are never written.

```bash
npm run friendsies:index
npm run friendsies:atlas
npm run friendsies:probe -- --type hand --value "Book Of Ocean"
npm run friendsies:probe -- --type head --value "Carrot"
```

Follow the [environmental trait workflow](../../docs/friendsies-trait-workflow.md)
before promoting any candidate. Index presence, a successful probe, or an
attractive preview does not establish design fit or technical readiness.
Canonical fRiENDSiES material already inherits the standing
`friendsies-project` authorization in ADR 0004; exact source identity, variant,
hash, transform, budget, fallback, and QA evidence still gate runtime promotion.
