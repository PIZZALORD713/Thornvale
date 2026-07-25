# Changelog

## Unreleased

* Expanded the standalone Story Archive into a Friend 6602 character workshop.
  Each verified trait now opens exact asset and provenance details plus an
  automatically fitted isolated 3D view, while Full Friend restores the
  complete assembly. An explicit desktop Chromium file picker exposes only
  eight Markdown story-authoring sections and conflict-checks the latest local
  Obsidian card before Save; verified identity, traits, rig, actions, and
  sources remain protected. Preview resizing now refreshes the capped device
  pixel ratio so moving the tab between standard and Retina displays stays
  sharp without a reload.
* Added the Pond–Grove Trait Echo v1.1 environment pass: canonical `Carrot` and
  `Earthworm` heads now read as rounded trees and a mushroom landmark, while
  `Flower Hill`, `Blooming Tree`, `Resting Green Leaf`, and `Purp Mush` create
  flowered banks, a grove endpoint, pond leaves, and fungal understory across
  fourteen non-colliding placements. The family is exact-variant pinned,
  locally bundled, provenance recorded, independently fallible, and reversible
  with `?traits=off`; gameplay anchors, saves, fishing, planting, and
  woodcutting authority are unchanged.
* Replaced the provisional one-press wood and pond rewards with the first
  stewardship slice. A canonical provenance-pinned fRiENDSiES axe can be found,
  owned, and equipped; each of three mature trees takes three strikes, falls to
  a persistent stump, grants six usable wood plus one replacement seed exactly
  once, and can be followed by a persistent seedling at the marked grove patch.
  The simple rod now runs a deterministic cast, false-nibble, true-bite, hook,
  tension-management, and landing sequence with desktop and touch hold input.
  Canonical fRiENDSiES `hand:Guess` now presents that simple-rod tier with its
  original gold grip, coiled line, and lure; its rigid frame-zero pose is baked
  in memory under the unchanged pond anchor, with the procedural rod retained
  as a local non-blocking fallback.
  A persistent four-step fishing guide teaches that rhythm on the first cast,
  distinguishes the decoy nibble from the true plunge, changes the live reel
  cue from hold to release before dangerous tension, and explains the exact
  missed rule after an escape. Read-heavy windows are more forgiving and use
  keyboard- or touch-specific control names.
  Successful catches persist as individual fish specimens. Inventory, tools,
  equipment, trees, activities, camp, garden, and chapter accounting now share
  one clean global `GameSession` contract; development saves from older shapes
  reset because no player migration is required. Tree strikes retain the
  established labor cost and pass-out recovery, invalid lifecycle saves reset,
  restored stumps no longer replay their fall, and completed Day One accounts
  remain historical while lifetime stewardship totals continue.
* Raised the audited production artifact ceiling by 20%, from 8,388,608 to
  10,066,330 bytes (9.6 MiB), so the integrated object-cue and Pizza Lab release
  has measurable headroom. All family-specific asset caps remain unchanged. The
  production build also minifies the copied Draco WASM wrapper with decoded
  geometry equivalence coverage while leaving its checked-in source untouched.
* Added three compact, provenance-recorded visual studies for the Community
  Ledger, forest-edge camp, and Town Bell to relevant dialogue beats and
  objectives, with text-first and failed-image fallbacks. Desktop players can
  press `H` for one four-second windborne point cloud toward the live objective.
  It gathers at the grounded player's feet, clears fixed town colliders while
  joining a reviewed corridor, rises to chest height, decays before arrival,
  and yields to the existing persistent comply/alter routes without changing
  progression.
* Added Pizza Lab v0.4 Wayfinder geometry promotion. The full Blender World
  Stage now loads an editable project source with three named sign-board
  assemblies; the add-on and MCP can export their bounded transforms through a
  clean Blender rebuild into a Draco candidate. Independent promotion gates
  source hashes, hierarchy, materials, triangles, bounds, provenance, and size,
  while the existing pilot/baseline selector and per-root fallback preserve the
  game-owned placement, collider, camera, grass, and interaction contracts. The
  first v1.1.0 art revision uses full directional yaw to point the three boards
  independently while keeping X/Y tilt and non-board geometry locked.
* Extended Pizza Lab to a complete bounded Blender-to-browser placement loop.
  Blender can stage the existing village-dressing GLB at current runtime
  coordinates, expose only the Wayfinder as editable, and atomically publish a
  placement candidate. A separate validator checks the exact source hash,
  grounding, meadow bounds, cottage clearance, and protected anchors before
  promoting the placement into `TOWN_LAYOUT`; the Wayfinder visual, collider,
  camera proxy, and grass clearance therefore update together on browser reload.
* Added the bounded Pizza Lab v0.1 production-tool pilot: a typed MCP server,
  authenticated localhost Blender add-on, and shared Blender 4.5.9 headless
  command core can inspect and validate scenes, preview or explicitly apply an
  object transform by stable game ID, and undo that transform. ThornVale axes,
  write roots, and terrain authority live in a project adapter; arbitrary Python,
  creation, deletion, publishing, and terrain mutation remain unavailable until
  later gates. The add-on is installed only in a separate Pizza Lab profile.
* Moved Community Ledger enrollment directly after Lumen’s welcome. Day One
  chores now unlock after signing, update a readable truthful Ledger account,
  and advance to dusk only when the account is complete. After the first Bell,
  the player returns toward Lumen; the impossible second ring now interrupts
  that journey with a bounded camera reveal instead of firing beside the Bell.
  Reloading between rings resumes on the Bell-side return route, the anomaly is
  saved on its visible reveal frame, and cancelled fly-ins cannot save a ring
  the player never heard.
* Corrected the Day One cooking spit so the center rod and fish roll around
  their horizontal axis while both support stakes remain planted.
* Made Day One exhaustion recovery legible as camp progression: pass-outs now
  return to the front gate until the provisional shelter is repaired, then use
  camp as the durable wake point. The unfinished tent is a low collapsed bundle
  rather than an already-standing A-frame; the repair erects it and gives a
  one-time update that future recovery happens there.
* Added a premium touch-control presentation as the default within the bounded
  touch pilot: a calmer idle stick, vertical right-thumb action arc, themed
  inline glyphs, aligned
  movement/Jump centers, contextual interaction placement, and an invisible
  action moat that prevents near-miss camera drags. Movement, sprint, Jump, and
  interaction availability project visible held state without changing input
  authority. Reduced-motion, increased-contrast, and forced-color variants are
  covered, while `?controlsStyle=classic` provides an immediate presentation
  rollback through the unchanged semantic input path.
* Added an automatic coarse-touch controls pilot with independent analog move
  and drag-look regions, outer-band sprint, Jump, and a contextual action
  button. Touch entry avoids pointer lock, story cards and lifecycle
  interruptions clear input, and `?controls=touch|desktop|auto` keeps QA and
  rollback deterministic. Desktop keyboard/mouse remains unchanged. Automated
  release gates pass; the feature remains a pilot until a full Core Hook run and
  performance measurements are completed on a representative phone.
* Added an honest iPhone Safari app-mode path instead of treating rotation as
  automatic fullscreen. A standalone web manifest and Apple web-app metadata
  support Home Screen launch; eligible browser-tab sessions show a compact
  entry instruction and one dismissible first-rotation reminder, deferred while
  story UI is blocking and suppressed in standalone mode. Dynamic viewport
  height plus coalesced `window` and `visualViewport` resizing keeps the canvas
  and dependent presentation aligned with Safari's available viewport. The
  physical gate removes any old shortcut, reinstalls through Share > Add to Home
  Screen, enables Open as Web App when offered, and launches from the icon;
  standalone storage may be separate from the Safari-tab save.
* Compressed only the production copy of the bundled Draco JavaScript fallback
  without identifier mangling, preserving the checked-in Three.js source,
  stable `/draco/` runtime contract, and WASM decoder. A decode-equivalence
  regression protects the fallback while keeping the production artifact under
  the fixed 8 MiB cap.
* Fixed malformed mint tea-house roof topology that produced stretched,
  flickering planes near the pawn. Curled eaves now export as closed,
  outward-wound solids with concave-safe triangulation and modeled separation
  between the main roof and veranda canopy; deterministic geometry regressions
  protect the runtime cottage asset.
* Added ADR 0005's standing Thornvale animation authorization. All current and
  future animation sources and derivatives the project owner controls or may
  lawfully use may serve any integrated Thornvale role without another owner
  approval per file, clip, pack, rig, role, context, transform, delivery method,
  or revision. Exact upstream source and license evidence, hashes, transforms,
  budgets, fallbacks, and QA remain release gates. Raw sources, standalone
  animation or motion packs, sublicensing, and outside-Thornvale use remain
  excluded, and animation provenance stays separate from canonical fRiENDSiES.
* Replaced fRiENDSiES per-file, per-token, and per-role release grants with the
  standing project-wide authorization in ADR 0004. All present and future
  canonical fRiENDSiES assets may be streamed, bundled, cached, transformed,
  recombined, and used in any integrated Thornvale character, item, equipment,
  prop, environment, UI, documentation, testing, or promotional role without a
  new permission decision. The manifest now uses one `friendsies-project`
  family; per-trait rights fields and runtime legal metadata were removed.
  Catalog pins, exact canonical URL prefixes, hashes, transforms, budgets,
  fallbacks, and QA remain enforced. Standalone packs, bulk raw mirrors,
  sublicensing, and outside-project reuse remain excluded; animation families
  inherit ADR 0005 while retaining their independent Mixamo or other upstream
  rights and provenance records.
* Added the bounded Day One Proof after Community Ledger enrollment and before
  the dusk Bell: gather wood, fish the pond, light a fire, cook and eat,
  plant and water one seed bed, and brace a provisional forest-edge shelter.
  Nourishment, working energy, a small saved inventory, camp/garden projection,
  and recoverable pass-out with a clinic fee or debt now form one testable loop;
  broader recipes, economy, crop growth, and freeform building remain deferred.
* Added the release-authorized `story-actions-v1` conversion family: six
  deterministic animation-only GLBs totaling 270,232 bytes provide four
  semantic Lumen gestures plus dedicated planting and watering performances.
  The converter strips wrapper translation, bakes only bounded rotation that
  returns by the final frame, preserves the terminal pose on a 30 Hz grid, and
  emits no character geometry or material payload. Normal motion time-scales the
  garden clips into the authoritative action clock; reduced motion skips them,
  and missing catalog/files fall back locally without moving progression
  authority out of `GameSession`. The family inherits ADR 0005's standing
  animation authorization; its six exact sources, Mixamo product-use terms,
  transforms, hashes, and runtime scope remain independently recorded. Raw
  sources, standalone packs, sublicensing, and outside-project reuse remain
  excluded.
* Moved the provisional camp into a distinct western forest-edge clearing,
  spread the fire, seed bed, and shelter into a readable triangle, and extended
  both the town approach and altered-story trail to the new entrance. Added
  numeric regressions for cottage clearance, open working space, meadow-edge
  margin, and route continuity. The action-weight pass now gives every accepted
  Day One interaction a grounded three-to-four-second timeline with an exact
  commit cue; invalid interactions remain immediate. An actual-interaction
  browser route completed all eight chores and reached the Ledger objective,
  with plant/water contact, reduced motion, save boundaries, and forced asset
  failures checked separately; fresh-player action-feel validation remains open.
* Replaced the town-wide peach dirt ribbon with a mixed route grammar. Arrival,
  cottage, and ritual lanes now share one deterministic, warm-brick-biased
  reclaimed-paver draw, while pond, forest, and meadow routes retain softer
  clover wear, broken foot patches, shoulder dapples, and sparse stones. The
  Bell now waits on the rear hill at the end of a longer paved procession; its
  visible terrain, Rapier collider, camera surface, interaction, anomaly VFX,
  asset pilot, and ritual torch share the elevated landmark contract. The
  provisional camp still has no rendered dirt pad, and explicit thickness or
  height tiers prevent every ground treatment from fighting with the meadow.
* Limited fRiENDSiES head emission to explicit presentation opt-ins instead of
  applying a white `0.22` lift to every head. Streamed `Grey Cloud` and curated
  Steward Lumen `White Elephant` retain their reviewed soft-white treatment;
  ordinary textured heads such as token `#8`'s `Ye` keep authored colors.
* Added strict, shareable fRiENDSiES player selection through `?friend=8448`,
  the `?token=8448` alias, full generator URLs, and `/fren/8448` deep links.
  Remote players now fetch one 192 KB catalog range before loading their exact
  animation-compatible component assets; invalid or failed selections recover
  to bundled `#6602` and `#8914` without flashing the emergency visual. A code-
  native emergency visual is reserved for total bundled decoder/local-family
  failure so the story can still boot.
  The arbitrary-token path remains a pinned external runtime dependency:
  published Thornvale builds use the recorded catalog, token range `1..10000`,
  exact canonical storage prefix, and bundled fallbacks. These are engineering
  integrity controls under ADR 0004, not a player-avatar-only permission scope.
* Replaced the audit's authored-or-CC0-only release rule with a scoped
  `project-release-authorized` path. The three exact fRiENDSiES animation
  derivatives may ship inside Thornvale builds while raw-source, standalone
  asset-pack, and general outside-project redistribution remain disallowed.
* Replaced the startup procedural humanoid and token `#0001` player with locally
  bundled fRiENDSiES `#6602`. The player and Steward rigs remain empty until a
  fRiENDSiES loads; recovery prefers local `#6602` and `#8914`, then uses a
  code-native emergency visual only after total bundled failure. The superseded
  `#0001` player files were removed while Flower White remains available to
  Trait Echo v1.
* Reframed the default journey as **A Courtesy Before Dusk** with a left-weighted
  civic-paper welcome, qualitative `THORNVALE REMEMBERS` standing, quieter HUD,
  and Courtesy/Correction color and typography states.
* Added a pure arrival-through-ending presentation projector so restored saves
  reapply the correct Ledger mood, route grammar, trait posture, and semantic
  shell without changing story anchors, collisions, interactions, or saves.
* Refined fRiENDSiES Trait Echo v1 into the **Second Witness** grammar: three
  Flower White, three mounted Torch, and one Crown Up placement. Seven instances
  now display 26,544 trait triangles in three trait draws, plus one shared
  socket-colored civic-mount draw; `?traits=off` remains the exact rollback.
* Replaced generic route beads with paired honey witness stitches for comply and
  sparse violet ink-thorns for alter while preserving route samples,
  destinations, collision metadata, and ending triggers.
* Added deterministic breathing grass as one static instanced draw: 192, 432,
  or 800 clustered tufts by quality, with masked civic/story clearances, one
  bounded shader-time uniform, a fully static reduced-motion treatment, and a
  camera-space fade that prevents cropped foreground shards.
* Replaced six town-wide pastel rectangle butterflies (18 meshes and six
  callbacks) with two pond dragonflies and one Garden Arch dragonfly on
  medium/high quality. Faceted moss bodies and translucent celadon kite wings
  use two instanced draws, one deterministic hover–dart callback, a low-quality
  count of two, static reduced-motion poses, and a fade before night routes.
* Removed the legacy square petal drift from night rendering, skip pooled
  weather systems at zero opacity, and strip the controls panel's idle paper
  slab while a higher-priority objective is visible.
* Expanded the pinned 10,000-token / 1,077-trait / 1,447-variant collection atlas
  with 27 individual casting profiles, surface/counter meanings, mount/phase/risk
  filters, shot budgets, and technical readiness. Per-trait rights coverage was
  removed because canonical entries inherit ADR 0004.
* Kept Book Of Ocean, Friends Key, All Seeing, Orb, and other candidates outside
  Trait Echo/environmental requests and bundled release assets pending exact
  variant, provenance, fit, performance, fallback, and rollback review—not
  individual permission. Full-token player selection and local bundling share
  the same standing project authorization.
* Consolidated the formerly exact local `#0001`, `#6602`, `#8914`, Trait Echo,
  and remote player grants into the single `friendsies-project` manifest family.
  The strict asset release audit now treats source identity and runtime safety
  as engineering gates while continuing to prohibit standalone, raw-mirror,
  sublicense, and outside-project distribution.

## 0.3.0 - 2026-07-12

* Added the playable Core Hook story from the arrival letter through the Steward, ledger, second bell, correction choice, route, and ending.
* Expanded the village into a roomier outer ring with clearer paths, cottage doorsteps, garden loops, and landmark spacing.
* Added polished Blender-authored cottage and village-dressing kits with reproducible source scripts, provenance, runtime fallbacks, and collision coverage.
* Bundled dependable fRiENDSiES player, Steward, and animation assets with explicit Thornvale-scoped publication authorization.
* Improved locomotion, grounded movement, camera collision and close-wall visibility, day/night presentation, interaction feedback, and story UI.
* Added 39 automated tests, GitHub Actions verification, release/QA documentation, and production asset checks.

### Known limitations

* The production build still reports Vite's advisory warning for the large Three.js and Rapier chunks; it does not fail the build.
* Bundled fRiENDSiES and animation authorization is scoped to Thornvale and does not grant general redistribution rights outside this project.

* Added Plan 2.0 with a single-player core-hook proof, a gated narrative vertical slice, measurable exit criteria, an issue-ready backlog, and conditional Friends Mode.
* Updated roadmap, README, wiki navigation, and milestone status notes to reflect the new sequence.
* Initial wiki draft
