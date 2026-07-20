# 2026-07-19 Key-object Cues and Objective Hint v1 QA

## Scope

- Relevant conversation beats and objectives may project one labeled study of
  the Community Ledger, forest-edge camp, or Town Bell.
- Desktop `H` requests one temporary, four-second ground ribbon toward the live
  objective. It follows reviewed authored corridors and never advances story,
  changes a target, or competes with the persistent comply/alter routes.
- This v1 does not add voiceover, lip sync, cutscenes, a minimap, permanent GPS,
  navmesh pathfinding, touch hint input, or new story/save authority.

## Automated and release evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Focused feature matrix | PASS | All 20 objectives have exact target contracts; supported objectives resolve finite, cottage-clear paths and resolution objectives fail closed |
| Input and trail lifecycle | PASS | Exact-once semantic `KeyH`, one instanced draw, four-second refresh/expiry, reduced-motion stability, invalid-path closure, and idempotent disposal |
| Bell-slope clearance | PASS | 64 surface-projected markers cleared 173 tilted Bell pavers in reduced motion and at every animated trough: 22,144 deterministic OBB checks with zero intersections |
| Corner HUD contract | PASS | Status, objective, and remembered standing share one left rail; time and survival share one right rail; readable pixel floors are guarded across responsive declarations |
| StoryUI | PASS | Objective text/ARIA stays authoritative; cue advance, malformed data, missing DOM, and image errors cannot block dialogue or progression |
| Asset transform | PASS | Three deterministic 128x128 AVIFs total 4,321 bytes; sources and derivatives match their recorded SHA-256 values |
| `npm run check` | PASS | 287/287 tests, Vite production build, and development asset audit |
| `npm run assets:release` | PASS | 30 runtime media files; source batch 7,764,361 bytes; no provenance, integrity, authorization, or release blocker |
| Production payload | PASS | `dist/` 8,378,214 / 8,388,608 bytes; 10,394 bytes remain under the fixed limit; existing chunk-size warning only |

The release build identifier-mangles only its copied Draco JavaScript fallback.
Regression coverage preserves the `DracoDecoderModule` global and verifies a
real 2,800-point / 4,800-face decode against the checked-in source.

## Browser evidence

- Runtime: local Vite server in Playwright Chromium, baseline town assets,
  Trait Echo disabled, desktop controls.
- Artifacts were captured under ignored `output/playwright/`; they are not
  release artifacts or committed evidence.

| View or behavior | Result | Observation |
| --- | --- | --- |
| Conversation images | PASS | Camp and Ledger AVIFs decoded at 128x128; the Bell beat projected its labeled figure; the image changed and cleared with its beat |
| Objective image | PASS | Ledger study appeared inside the existing objective glyph while “Enter your name in the Community Ledger” remained intact |
| Desktop hint | PASS | At 1280x720, `H` projected 21 bright markers above the reclaimed pavers toward the live Ledger target and confirmed the temporary cue in the status line |
| Bell-hill projection | PASS | A native `H` press staged against the Bell objective produced one 30-marker ribbon; 16 markers followed non-flat sampled normals and remained visibly seated on the uphill pavers |
| Corner HUD geometry | PASS | At 1280x720 and 844x390, the transient status, objective, and remembered-standing surfaces had ten-pixel vertical gaps and zero intersection; time and visible survival panels also held a ten-pixel gap |
| Top-right legibility | PASS | Time uses a 10px overline and 16px phase value on desktop, with a 14px compact value; survival metadata is 10px, meter copy 11px, and supply values 12px |
| Refresh and expiry | PASS | A second press after 2.20 seconds reset elapsed time to 0.12 seconds on the same root and draw; after 4.10 more seconds it was hidden with zero instances |
| Story lifecycle | PASS | Opening the Ledger interaction hid an already-visible ribbon immediately; objective changes, recovery/focus entry, hidden-tab entry, and disposal share explicit hide paths |
| Reduced motion | PASS | Media emulation selected the reduced-motion trail; sampled marker matrices were identical across 300 ms while the cue remained active |
| Short landscape | PASS | At 844x390 the final objective panel settled at 430x54 within an 18 px left edge; the conversation cue lane retained its compact 113x33 chip and left roughly 40% of the world unobscured above the card |
| Portrait | PASS | At 390x844 the 366x48 objective began 17px below the visible survival panel; the two corners did not intersect, both qualitative meter labels fit without overflow, and the player, Lumen, and route remained visible |
| Missing image | PASS | Forced 404 made the cue image hidden with zero natural width while objective text and progression remained available |
| Clean console | PASS | A fresh, unmocked final session reported zero errors and zero warnings |

The staged Ledger and reduced-motion checks used authoritative local session
state to reach the relevant presentation quickly. They prove runtime integration,
not clean-save route comprehension or fresh-player emotional response.

## Remaining observation gate

- Walk the complete clean-save route at normal pacing and record wrong-landmark
  approaches, `H` presses, help requests, and stalls over 20 seconds.
- Ask what the images represented and who the player thought supplied the
  ribbon. Treat “helpful town” and “approved path” as intentionally compatible
  readings.
- Add another study or touch affordance only when repeated observation identifies
  the same missing landmark or recovery need.
