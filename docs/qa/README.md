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

Use a targeted checklist for the changed surface in addition to this smoke pass.
Do not commit generated `dist/`, screenshots, traces, or `output/` artifacts by
default. When evidence is needed for a release or regression, store a concise
Markdown record here named `YYYY-MM-DD-short-topic.md` and link any deliberately
retained artifact.

The broader player-facing gates remain in
[`../../wiki/Release-Checklist.md`](../../wiki/Release-Checklist.md).
