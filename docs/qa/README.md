# Quality Assurance

QA has three layers: deterministic Node tests, a production build, and focused
browser playthroughs for behavior that depends on rendering, input, audio, or
camera feel.

## Standard verification

```bash
npm test
npm run build
```

`npm run check` runs both in that order. Test categories and change obligations
are documented in [`../../tests/README.md`](../../tests/README.md).

## Browser smoke pass

For a shareable build, verify at minimum:

1. A clean first load reaches the welcome screen without console errors.
2. Pointer lock, WASD, sprint, jump, interaction, and Escape behave as documented.
3. The player can complete the Core Hook route from letter to an ending.
4. Save restoration and `?story=reset` both work.
5. The default bundled character and steward load without a network dependency.
6. Camera framing, collisions, and ground contact remain stable at terrain and
   structure edges.
7. High and low quality modes remain playable; reduced-motion behavior is sane.
8. `?assets=baseline` and `?assets=pilot` both boot cleanly; the pilot preserves
   story interactions and its gate, Ledger, and Bell remain readable by day and
   night.
9. `?traits=off` and `?traits=v1` both boot with each `assets` variant. Trait
   Echo v1 preserves story behavior, reacts from arrival through both endings,
   and makes no request for its excluded backlog traits.
10. `?friend=8448`, `?token=8448`, a full generator URL in `friend`, and
    `/fren/8448` all select the same player on navigation. Malformed, missing,
    or failed remote selections recover to bundled `#6602`, then `#8914`.
    Only a total local GLTF or Draco failure may render the independent
    code-native Thornvale safety avatar; successful fRiENDSiES routes must not
    construct or flash it first.

Use a targeted checklist for the changed surface in addition to this smoke pass.
The bounded first-afternoon survival, camp, save/reload, and pass-out checks are
recorded in [`2026-07-13-day-one-proof.md`](2026-07-13-day-one-proof.md).
The six-clip fRiENDSiES conversion, Lumen gesture, plant/water contact,
reduced-motion, failure-fallback, and release-gate matrix is recorded in
[`2026-07-13-story-actions-v1.md`](2026-07-13-story-actions-v1.md).
The Trait Echo v1 checklist and pending results record is
[`2026-07-12-trait-echo-v1.md`](2026-07-12-trait-echo-v1.md).
The coordinated Courtesy/Correction shell, consequence grammar, trait-casting
atlas, and breathing-grass evidence is recorded in
[`2026-07-12-aesthetic-system-v1.md`](2026-07-12-aesthetic-system-v1.md).
The fRiENDSiES deep-link and remote-fallback evidence is recorded in
[`2026-07-12-friendsies-url-selection.md`](2026-07-12-friendsies-url-selection.md).
Do not commit generated `dist/`, screenshots, traces, or `output/` artifacts by
default. When evidence is needed for a release or regression, store a concise
Markdown record here named `YYYY-MM-DD-short-topic.md` and link any deliberately
retained artifact.

The broader player-facing gates remain in
[`../../wiki/Release-Checklist.md`](../../wiki/Release-Checklist.md).
