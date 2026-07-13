# Release Operations

This directory holds repeatable release procedures and release-specific evidence.
The wiki's [`Release Checklist`](../../wiki/Release-Checklist.md) defines the
player-facing quality bar; this page defines the repository handoff.

## Candidate procedure

1. Confirm the intended commit and review unrelated worktree changes.
2. Run `npm run check` from a clean dependency installation when practical.
3. Complete the browser smoke pass in [`../qa`](../qa/README.md).
4. Run `npm run assets:release`; resolve every release-blocked asset family.
5. Confirm every shipped third-party or transformed asset has its source,
   product-use scope, and raw or standalone redistribution boundary recorded in
   its adjacent `PROVENANCE.md`.
6. Confirm every external runtime dependency still matches its authorized
   pinned catalog, token scope, asset origins, and in-game role. The current
   fRiENDSiES grant covers integrated remote player avatars in published
   Thornvale builds only; it does not cover catalog mirroring, local collection
   bundling, environmental reuse, or outside-project delivery.
7. Confirm `dist/` is generated from the candidate rather than treated as source.
8. Update [`../../wiki/Changelog.md`](../../wiki/Changelog.md) with player-visible
   changes and known limitations.
9. Deploy the static Vite output and smoke-check the production URL, including a
   direct route load and the default offline asset path.

For a noteworthy candidate, add `YYYY-MM-DD-version.md` here with the commit,
environment, commands run, manual routes checked, known issues, and deployment
URL. Do not record credentials, private preview tokens, or machine-specific
secrets.
