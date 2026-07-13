# 2026-07-12 fRiENDSiES head emission QA

## Scope and decision gate

- Worktree: `codex/asset-overhaul-test`, dirty with unrelated in-progress work.
- Player-facing beat: selected fRiENDSiES retain their authored head colors.
- Baseline: every loaded head was overwritten to white emission at `0.22`.
- Candidate: ordinary heads receive no material override; exact `Grey Cloud`
  and curated White Elephant remain explicit soft-white exceptions.
- Rollback: remove a trait's `presentation.headEmission` declaration or exact
  exception entry; bundled player and remote-load fallbacks are unchanged.
- Gate: token `#8` must preserve its dark-brown `Ye` texture without regressing
  the reviewed Grey Cloud or Steward Lumen presentations.

## Environment

- Browser: Chrome 150 through Playwright CLI.
- OS/renderer: macOS, WebKit WebGL.
- Viewport: 1200 × 919 CSS pixels; device pixel ratio 1.
- Quality: low and high; day and night; story off for isolated player checks.

## Automated evidence

| Command | Result | Notes |
| --- | --- | --- |
| `node --test tests/friendsies-cast.test.js tests/friendsies-metadata-range.test.js` | Pass, 10 tests | Covers default no-op, exact Grey Cloud, explicit disable, White Elephant, and remote metadata. |
| `npm run check` | Pass, 142 tests | Includes production build and passing asset audit. |
| `git diff --check` | Pass | No whitespace errors. |

## Browser matrix

| Character | Day/night | Quality | Material result | Console | Result |
| --- | --- | --- | --- | --- | --- |
| Remote `#8` / `Ye` | Day | Low, high | No forced white emission; authored dark-brown texture and facial detail restored. | 0 errors, 0 warnings | Pass |
| Remote `#8` / `Ye` | Night | Low | No forced emission; character remains on the normal night-lighting path. | 0 errors, 0 warnings | Pass |
| Remote `#1` / `Grey Cloud` | Day | Low | Exact exception remains white `0.22`, metalness `0.02`, roughness `0.92`; emissive map retained. | 0 errors, 0 warnings | Pass |
| Bundled `#6602` / `Deli` | Day | Low | Zero forced white-emission materials. | 0 errors, 0 warnings | Pass |
| Bundled `#8914` / `White Elephant` | Day | Low | Curated declaration remains white `0.22`, metalness `0.02`, roughness `0.92`. | 0 errors, 0 warnings | Pass |

## Comparison and decision

- Production reproduction on `?friend=8` showed `Ye` forcibly set to emissive
  `#ffffff` at `0.22`; disabling that override in-session immediately restored
  the dark-brown texture.
- No runtime URL, request, draw, geometry, binary, manifest, or payload changed.
- Gameplay anchors, colliders, interactions, saves, animation, and fallbacks
  are unaffected; this is a head-material projection fix in CharacterLoader.
- Decision: make default-no-emission behavior the runtime default. Grow the
  exception list only after exact head assets receive visual review.
