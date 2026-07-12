# Thornvale Plan 2.0

> Ship the feeling before expanding the feature list.

| Field | Value |
| --- | --- |
| Status | Core Hook Proof v0.3 implemented; fresh-player validation pending |
| Prepared | 2026-07-11 |
| Baseline | `main` at `114a5faf5c0784715315744730b9c7b375b2473e` |
| Target | A polished 20–30 minute single-player browser demo |
| Planning assumption | One core developer with part-time narrative, art, and audio support |
| Supersedes | The sequencing in `Roadmap.md` and the README's original high-level roadmap |

## 0. Build status — Core Hook Proof v0.3

The first Milestone 1 implementation is now playable end to end. This is a proof build, not an exit-gate claim: the five required fresh-player sessions and learning review still remain.

- fRiENDSiES `#8914` is the starting steward, Steward Lumen, with white head emission restored and capsule-relative foot alignment.
- The letter → welcome → Ledger → dusk bell → supernatural second bell → false record → correction → comply/alter sequence is complete.
- Story time replaces the player-facing day/night toggle; `N` is available only after enabling debug mode.
- Neighborliness, relationship, rules, events, choice, phase, and ending persist in a versioned local save with reset and corrupt-save recovery.
- Both outcomes change the route treatment, steward response, relationship, Neighborliness score, objective, and ending card.
- fRiENDSiES idle, walk, joy-jump, and rumba clips are bound through the collection's canonical skeleton. Runtime derivatives and provenance are recorded under `public/animations/`.
- Automated state tests cover strict ordering, both anomaly triggers, anomaly idempotency across reload, both endings, save restoration, reset, and corrupt-save recovery.

The immediate next gate is observational: run five clean first-play sessions, capture completion time and help requests, then tune wayfinding, pacing, and copy before adding another villager or system.

## 1. Executive decision

Thornvale already has enough engine foundation to test its premise. The current build proves that a player can load into a browser, move through a small 3D scene, collide with the world, interact with two objects, and toggle between day and night. It does **not** yet prove the game's differentiator: friendship used as social control.

Plan 2.0 therefore makes the next release a **single-player core-hook proof**, not multiplayer. The next playable build must let a player experience one wholesome routine, discover one unspoken rule, witness one anomaly, face one polite intervention, and make one obey-or-resist choice with a visible consequence.

Multiplayer, broad crafting systems, and procedural content stay behind validation gates. They should not compete with the first complete Thornvale experience.

## 2. Review of the current plan

### What the repository already proves

- A modular Vite, Three.js, and Rapier browser prototype builds successfully.
- The controller, camera, collision, moving-platform support, debug tools, and visual rig form a usable technical base.
- The greybox town contains four buildings, a Community Ledger, and a Town Bell.
- Day/night lighting and fog work in the deployed build.
- The public Vercel deployment is shareable.
- The narrative premise and design pillars are distinctive and internally consistent.

### What is still only a promise

- No villager, dialogue, favor, quest, rule, anomaly, intervention, or ending is implemented.
- `kindnessCount` is an unbounded interaction counter, not the specified Neighborliness system.
- Day/night is a manual lighting toggle, not a story phase or gameplay loop.
- The cottage interior and authored town art are absent.
- The Friendsies avatar is loaded from remote metadata and assets on the startup critical path.
- There is no player save, content-state model, automated test suite, CI workflow, release, or issue backlog.

### Validation snapshot on 2026-07-11

| Check | Result |
| --- | --- |
| Clean production build | Passed with Vite 5.4.21 |
| Built JavaScript | App 92.52 kB, Three.js 521.84 kB, Rapier 2,058.23 kB before gzip |
| Dependency audit | No production advisories; development tree reports two high and two moderate advisories |
| Live deployment | Reaches “Ready,” renders the avatar/greybox world, and changes to night state |
| Live console | Expected-but-noisy 404s for `favicon.ico` and missing optional `assets/town.glb`; character metadata count logs as `undefined` |
| Failed-remote behavior | Local blocked-network run remained on Friendsies metadata loading instead of reaching the fallback |
| Automated verification | No repository test suite or CI workflow |
| GitHub workflow | Six merged PRs, one stale open PR (#4), no issue backlog, and no release tags in the checkout |

### Planning drift to correct

| Old-plan problem | Plan 2.0 correction |
| --- | --- |
| README says Prototype → Vertical Slice → Alpha, while the wiki puts multiplayer before the narrative slice. | One roadmap with gated milestones; single-player hook proof comes first. |
| Milestone 1 remains marked active after most of its acceptance criteria shipped. | Mark the technical prototype complete and carry its missing content into the new plan. |
| The README promises fishing, gardening, crafting, decorating, relationships, quests, and multiple endings at once. | Build only the mechanics required for one complete authored loop. |
| Physics is documented as TBD even though Rapier is in production code. | Record current decisions and update documentation with implementation reality. |
| Controls, collider naming, project structure, and avatar plans disagree across documents. | Make this file canonical and reconcile supporting docs during Milestone 0. |
| Rooms + Friends Mode is treated as the automatic next step. | Require evidence that co-op strengthens the social-horror thesis before funding networking. |
| “Done” means a feature exists. | Every milestone now has player-facing, technical, and validation gates. |

## 3. Product contract for the vertical slice

### Player promise

> In one sitting, the player should enjoy being welcomed into Thornvale, realize the welcome has rules, and choose whether belonging is worth obedience.

### Selected slice premise

The player arrives with a letter in their own handwriting that they do not remember writing. A town steward welcomes them, offers the cottage, and asks for two harmless courtesies: enter their name in the Community Ledger and ring the Town Bell at dusk.

The ledger later records an action the player has not taken. At night, the bell rings by itself. The steward returns with a kind correction. The player can comply with the town's version of events or alter the record. That choice changes the next route, the town's response, and the slice ending.

This scenario uses assets and interactions that already exist while testing the themes the current prototype does not.

### Product decisions

| Decision | Plan 2.0 position |
| --- | --- |
| Primary mode | Single-player first |
| First supported platform | Desktop Chromium-class browser, keyboard and mouse |
| Arrival premise | The letter in the player's handwriting |
| Day/night progression | Story-controlled; `N` remains a debug shortcut only |
| Neighborliness | Internal 0–100 score with diegetic feedback; numeric value appears only in debug tools |
| Content model | Authored events and conditions before procedural direction |
| Avatar reliability | A bundled Thornvale-safe fallback must always boot; Friendsies assets are optional until provenance and hosting are documented |
| Mobile and controllers | Deferred until the desktop slice passes its validation gate |
| Multiplayer | Conditional after the single-player hook validates |

### Slice state model

The first implementation should keep state small and explicit:

- `phase`: arrival, day-routine, dusk, night-investigation, intervention, resolution
- `neighborliness`: 0–100, starting at 50
- `relationship.steward`: guarded, warm, corrective
- `rulesKnown`: set of discovered rule IDs
- `choices`: durable choice flags such as `ledger_record = comply | alter`
- `eventsSeen`: idempotency flags for dialogue, anomalies, and interventions
- `ending`: assimilate, escape, or unset

The score is not a morality meter. High Neighborliness grants warmth and access but increases scrutiny; low Neighborliness reveals resistance paths but increases interventions.

### Explicit non-goals for the demo

- Fishing, farming, gardening, decorating, inventory, economy, and broad crafting
- Open-world expansion or procedural town generation
- General-purpose NPC simulation
- Procedural anomaly selection before three authored anomalies are fun
- Character customization beyond a reliable default avatar
- Accounts, cloud saves, room servers, chat, or multiplayer synchronization
- Three complete endings; two polished endings are the target, with Rewrite as a stretch goal
- Mobile parity

## 4. Success scorecard

The demo is successful only when the experience and the software both pass.

### Player experience

- The main path lasts 20–30 minutes for a first-time player.
- At least 80% of five or more fresh testers finish without developer help.
- At least 70% can describe the “kindness as control” tension without being prompted.
- At least 70% notice one anomaly before the game labels it.
- The obey/resist choice changes access, NPC behavior, and ending state—not dialogue alone.
- At least two testers voluntarily replay or ask what the other choice changes.

### Content completeness

- Three named villagers each express a different form of conformity.
- Two to three authored day/night cycles are playable.
- Three escalating anomalies and one complete investigation chain are present.
- The town loop and one cottage interior are visually readable.
- Two endings are implemented, tested, and reachable from a clean save.

### Technical quality

- `npm ci` and `npm run build` pass from a clean checkout.
- Unit tests cover state transitions, rule triggers, Neighborliness thresholds, and save migration.
- One automated browser smoke test reaches the playable state, toggles or advances phase, and performs an interaction.
- The supported deployment has no unhandled exceptions or expected-asset 404s.
- Startup always reaches play with a local fallback when remote avatar services fail.
- A documented reference device maintains the agreed frame-time budget after a baseline profile in Milestone 0.
- Production dependencies have no known high or critical advisories; development-tool advisories have an owner and upgrade plan.
- Asset sources, licenses, and credits are recorded.

## 5. Milestone roadmap

Estimates are sequencing aids, not commitments. Re-estimate after Milestone 0 once ownership and art capacity are confirmed.

### Milestone 0 — Rebaseline and make the prototype dependable

**Estimate:** 3–5 focused days

**Outcome:** one trustworthy roadmap and a build that reaches gameplay without depending on third-party assets.

#### Deliverables

- Make `Plan-2.0.md` the roadmap source of truth and update stale wiki/README references.
- Record ADRs for JavaScript, Rapier, `COLLIDER_*`, single-player-first, browser support, save format, and avatar policy.
- Close PR #4 as superseded, or extract any still-useful character-builder work into a new issue after the avatar decision.
- Remove merged branches after confirming they contain no unique work; keep `main` and active work branches legible.
- Move remote Friendsies loading off the startup critical path.
- Add timeouts, a bundled fallback avatar, explicit loading progress, and asset-error recovery.
- Remove expected favicon and optional-town 404 noise from the deployed console.
- Upgrade the build toolchain to a supported secure version after a compatibility check.
- Add CI for install, build, unit tests, and a minimal browser smoke test.
- Capture baseline load, transfer-size, frame-time, and browser-support measurements.
- Create GitHub milestones and issues from the backlog in Section 7.

#### Exit gate

- The app reaches “Ready” with the network blocked after the HTML/JS bundle is loaded.
- A clean CI run is green.
- There is one roadmap, one controls list, one collider convention, and one current architecture description.
- Every P0 issue has an owner or is explicitly parked.

### Milestone 1 — Core Hook Proof

**Estimate:** 2–3 weeks

**Outcome:** an 8–12 minute authored loop that makes Thornvale feel like Thornvale.

#### Player flow

1. Arrive with the unexplained letter.
2. Meet the steward and receive access to the cottage.
3. Complete the Ledger and Bell routine.
4. Learn one rule indirectly.
5. Advance into night through story state, not a player-facing toggle.
6. Witness the ledger or bell anomaly.
7. Receive an escalating polite intervention.
8. Comply or resist.
9. See a changed route, response, and short resolution.

#### Systems

- A small session state store with serializable flags
- Story phase director
- Data-driven dialogue and choices for one villager
- Real Neighborliness triggers and thresholds
- Rule discovery and violation tracking
- One scripted anomaly and one intervention chain
- Local save, reset, and versioned schema
- Dialogue, choice, subtitle, and objective UI
- Debug controls separated from player-facing controls

#### Exit gate

- Five fresh playtests completed.
- At least four testers finish without help.
- The core choice changes at least three downstream outputs.
- No progression blocker, unhandled error, or asset dependency prevents completion.
- The team can state what it learned and what changes before expanding content.

### Milestone 2 — Narrative Vertical Slice

**Estimate:** 4–6 weeks

**Outcome:** a polished 20–30 minute demo with two meaningful outcomes.

#### Content

- Three villagers: a welcoming authority, a transactional caretaker, and a conflicted conformist
- Two or three day/night cycles
- Three anomalies that escalate from plausible to undeniable
- One full investigation chain
- Neighborliness-dependent access, dialogue tone, scrutiny, and intervention intensity
- Assimilate and Escape endings; Rewrite is stretch scope
- One cottage interior and one polished town loop with three recognizable landmarks
- Day/night ambience, interaction feedback, and anomaly audio cues

#### Production foundations

- Content files define dialogue, conditions, effects, rules, anomalies, and endings without editing the render loop.
- Save data is migratable and recoverable.
- New world assets use a documented naming, scale, collider, and compression pipeline.
- Loading, failure, pause, settings, and reset states are intentional.
- Subtitles, reduced-motion mode, volume controls, readable focus states, and documented controls are present.

#### Exit gate

- The full Success Scorecard passes or has a named exception approved for demo scope.
- Both endings are reachable from a new save and a restored save.
- A content-only change can add or revise a dialogue beat without changing `main.js`.
- The slice is externally playtested and considered ready for hardening, not merely feature complete.

### Milestone 3 — Public Demo hardening and release

**Estimate:** 1–2 weeks

**Outcome:** a tagged, supportable public demo.

#### Deliverables

- Performance pass against the Milestone 0 budgets
- Asset compression and startup sequencing pass
- Supported-browser matrix and smoke runs
- Accessibility and input sanity pass
- Error recovery, save reset, and corrupted-save handling
- License, asset provenance, credits, contribution guide, privacy note, and current changelog
- Release notes, rollback instructions, and a tagged `v0.2.0-demo` release
- A stable Vercel deployment with a small feedback path

#### Exit gate

- All P0 bugs are closed; remaining P1 issues are documented and accepted.
- CI is green on the release commit.
- A clean browser profile can start, finish, reload, and replay the demo.
- The release tag, deployment, changelog, and feedback link all point to the same build.

### Conditional Milestone 4 — Friends Mode

Do not start this milestone because it is next on the old roadmap. Start it only when:

1. The single-player demo passes the player-experience scorecard.
2. A short design brief explains how another human player strengthens conformity, secrecy, or social pressure.
3. Hosting cost, moderation, blocking, privacy, and anti-griefing have owners.
4. The team accepts that networking work will slow narrative/content work.

If approved, the first spike is limited to shareable room links, transform sync, one emote, basic chat or preset phrases, and one conformity-themed cooperative ritual. It is not a general online-world milestone.

## 6. Implementation map

Plan 2.0 keeps the working engine code and adds the smallest layer needed for authored gameplay.

| Area | Direction |
| --- | --- |
| `src/main.js` | Keep as composition and loop wiring; move story state, content, and effects into focused modules. |
| `DayNightSystem.js` | Keep visual presets; let a new phase director own when transitions occur. |
| `InteractableSystem.js` | Add conditions, disabled reasons, action IDs, and one-shot safeguards instead of embedding story callbacks in `main.js`. |
| `TownBuilder.js` | Preserve the Ledger and Bell; separate world placement data from mesh creation and add the cottage/interior pipeline. |
| `CharacterLoader.js` | Add metadata timeout, validation, pinned asset manifests, cancellation, and local fallback; do not block game startup. |
| `HUD.js` | Keep lightweight status/debug UI; add separate accessible dialogue, choice, objective, subtitle, and settings components. |
| New `GameSession` | Own serializable state, flags, score, relationships, and ending. |
| New `PhaseDirector` | Advance arrival/day/dusk/night/intervention/resolution from authored conditions. |
| New `NeighborlinessSystem` | Apply named score changes, clamp values, expose tiers, and emit state-change events. |
| New `RuleSystem` | Track discovered rules, compliance, violations, and consequences. |
| New `NarrativeRunner` | Evaluate dialogue conditions and apply declared effects. |
| New `AnomalySystem` | Run authored, idempotent anomaly events; procedural selection remains later. |
| New `SaveSystem` | Version, validate, migrate, reset, and recover local saves. |
| New `src/content/slice-01/` | Store villagers, dialogue, rules, anomalies, objectives, and endings as data. |
| New tests and CI | Unit-test pure game state; browser-smoke the boot and one interaction on every PR. |

Avoid turning these names into a framework project. A module should exist only when Milestone 1 needs it, and every abstraction should ship with a concrete authored beat.

## 7. Issue-ready backlog

### P0 — Prove the hook

| ID | Issue | Acceptance signal |
| --- | --- | --- |
| THV-001 | Reconcile roadmap, controls, architecture, collider, and milestone docs | No conflicting current guidance remains. |
| THV-002 | Make startup independent of remote avatar services | Offline/failed-remote smoke run reaches play with a fallback. |
| THV-003 | Add CI, unit-test harness, and browser smoke test | Clean PR run installs, tests, builds, and boots. |
| THV-004 | Introduce versioned `GameSession` and save/reset | State round-trips and invalid saves recover safely. |
| THV-005 | Add story-controlled `PhaseDirector` | The core loop advances without the player using `N`. |
| THV-006 | Replace `kindnessCount` with Neighborliness | Named positive/negative triggers change clamped score and tier. |
| THV-007 | Implement one villager and data-driven dialogue | Dialogue conditions and effects work without render-loop edits. |
| THV-008 | Turn Ledger + Bell into the first routine and rule | The routine teaches the rule through play. |
| THV-009 | Author the first night anomaly | It fires once, is noticeable, and survives save/reload correctly. |
| THV-010 | Implement the polite intervention chain | Response escalates based on rule and Neighborliness state. |
| THV-011 | Implement obey/resist consequence and short resolution | Choice changes route, NPC response, and ending flag. |
| THV-012 | Run five observed hook-proof playtests | Completion and theme-comprehension metrics are recorded. |

### P1 — Build the vertical slice

- Add the remaining two villagers and relationship beats.
- Add two more authored anomalies and the investigation chain.
- Build the cottage interior and replace the greybox town loop with readable landmarks.
- Add data validation and authoring documentation for narrative content.
- Add audio, subtitles, reduced motion, volume controls, focus states, and settings persistence.
- Implement Assimilate and Escape endings and full replay/reset flow.
- Profile, budget, and optimize the complete content build.
- Document asset provenance and remove mutable external production dependencies.

### P2 — Expand after validation

- Rewrite ending
- Light foraging or crafting only if it reinforces a proven routine
- Additional zones and villager arcs
- A rule/anomaly authoring tool if content volume justifies it
- Procedural Anomaly Director using the authored events as validated inputs
- Controller and mobile investigations

### P3 — Conditional bets

- Friends Mode networking
- Chat and emotes
- General character builder
- Broad cozy-sim economy
- Large or persistent shared world

## 8. Risk register

| Risk | Why it matters | Mitigation / gate |
| --- | --- | --- |
| Feature breadth hides the missing hook | Cozy systems and multiplayer can consume months without proving the thesis. | Enforce non-goals and milestone exit gates. |
| Remote avatar and decoder dependencies fail or change | Current startup can wait on mutable third-party services. | Bundle a fallback, pin or mirror assets, time out requests, and boot independently. |
| Content production becomes the bottleneck | The demo needs authored dialogue, anomalies, audio, and art—not more engine shell. | Lock the slice script early and schedule weekly playable content reviews. |
| Main-loop coupling slows iteration | Story callbacks currently live directly in `main.js`. | Move only state and authored effects into testable modules as each beat ships. |
| Performance regresses with real assets | The current greybox understates asset, animation, and draw-call cost. | Establish budgets in Milestone 0 and profile each content milestone. |
| Documentation drifts again | The current README and wiki disagree on roadmap and implementation. | One canonical plan, named document owner, and doc check in milestone closeout. |
| Save changes strand playtesters | Narrative flags will evolve quickly during testing. | Version, validate, migrate, and expose a safe reset path from the first save. |
| Multiplayer creates safety and operating obligations | Chat, rooms, moderation, privacy, and hosting are product scope, not just netcode. | Require the four-part Friends Mode gate before implementation. |
| Asset ownership is unclear | A public demo needs permission for every avatar, model, texture, font, and sound. | Maintain an asset manifest and block release on unresolved provenance. |

## 9. Operating model

- Keep one milestone active at a time.
- Every feature issue names the player-facing beat and the exit criterion it supports.
- Prefer thin vertical changes that can be played over isolated engine projects.
- Require green install, unit, build, and smoke checks before merge.
- Run at least one fresh-player test each week during Milestones 1 and 2.
- Record observations, completion time, help requests, theme comprehension, and choice distribution.
- Review scope at every milestone gate; defer work rather than silently extending the milestone.
- Tag playable checkpoints and keep the public demo on a known release commit.
- Update this plan when a gate changes—not after implementation has already diverged.

## 10. Immediate next actions

1. Merge this plan and update wiki/README navigation.
2. Close or supersede stale PR #4 after preserving any useful design notes.
3. Create Milestones 0–3 and issues THV-001 through THV-012 in GitHub.
4. Write the 8–12 minute hook-proof script beat by beat.
5. Fix the startup asset critical path and add the bundled fallback avatar.
6. Add the CI and smoke-test baseline.
7. Implement `GameSession`, save/reset, and phase state before adding more content.
8. Convert the Ledger and Bell into the first routine/rule pair.
9. Ship the anomaly, intervention, and obey/resist consequence as one playable thread.
10. Run five playtests, review the scorecard, and only then authorize the full vertical slice.

## 11. Definition of Plan 2.0 complete

Plan 2.0 is complete when a new player can open the public link, finish a stable 20–30 minute story without guidance, understand that Thornvale's kindness is a control system, make a consequential choice, reach one of two endings, and replay safely—while the team can build, test, release, and extend that experience without relying on undocumented state or mutable external assets.
