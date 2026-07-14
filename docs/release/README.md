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
   applicable authorization or license, transform, and raw or standalone
   redistribution boundary recorded in its adjacent `PROVENANCE.md`.
6. Confirm every external runtime dependency still matches its pinned catalog,
   token scope, approved asset origins, fallback, and declared runtime behavior.
   Canonical fRiENDSiES assets and metadata inherit the standing
   `friendsies-project` authorization for any integrated Thornvale use; these
   checks verify source and runtime integrity rather than reopening permission.
   Standalone packs, bulk raw mirrors or dumps, sublicensing, and outside-project
   reuse remain excluded. Keep `friendsies-animations` on its separate Mixamo
   provenance contract.
7. Confirm `dist/` is generated from the candidate rather than treated as source.
8. Update [`../../wiki/Changelog.md`](../../wiki/Changelog.md) with player-visible
   changes and known limitations.
9. Deploy the static Vite output and smoke-check the production URL, including a
   direct route load and the default offline asset path.

For a noteworthy candidate, add `YYYY-MM-DD-version.md` here with the commit,
environment, commands run, manual routes checked, known issues, and deployment
URL. Do not record credentials, private preview tokens, or machine-specific
secrets.
