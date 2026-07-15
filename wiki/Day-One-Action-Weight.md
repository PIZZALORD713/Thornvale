# Day One Action Weight

## Decision

- **Active milestone and gate:** Milestone 1, THV-013. A clean first afternoon and an intentional pass-out route must both reach the Bell without guidance or a soft lock.
- **Implementation state:** Accepted chores now use one readable action timeline
  of at least three seconds, keep camera look available, lock movement only for
  that bounded timeline, and save exactly once at meaningful contact. The
  `story-actions-v1` family supplies dedicated skeletal performances for
  planting and watering; browser contact, reduced-motion, save-boundary, and
  forced-fallback behavior are recorded, while fresh-player validation remains
  open.
- **Player-feeling shift:** checking tasks off a list → physically investing care in food and a place to sleep.
- **Fresh-player hypothesis:** the extra anticipation, effort, contact, and recovery make food and camp improvement feel significant without testers describing the loop as slow or repetitive.

This pass adds no new horror beat. Its job is sincere comfort and material attachment. The existing Ledger, Bell, and automatic clinic kindness remain the precise social wrongness that follows.

## Action cadence

| Action | Total | Commit cue | Readable performance |
| --- | ---: | ---: | --- |
| Chop wood | 3.2 s | 2.1 s | Brace, two weighted strikes, second impact yields two wood, recover |
| Catch fish | 3.6 s | 2.9 s | Cast, quiet wait, bite, pull, land the fish, settle |
| Light fire | 3.1 s | 2.2 s | Kneel, arrange tinder, strike, ember catches, flame grows |
| Cook fish | 3.4 s | 2.7 s | Place fish, turn and sizzle, doneness lands, lift from spit |
| Eat fish | 3.0 s | 2.25 s | Lift, two bites, swallow restores needs, lower hands |
| Plant seed | 3.1 s | 2.3 s | Kneel, dig, drop seed, cover and pat soil, rise |
| Water seed | 3.2 s | 2.35 s | Lift, controlled pour, soil darkens, lower can |
| Repair shelter | 3.6 s | 2.8 s | Brace, three fastening beats, final contact secures repair, inspect |

Missing-resource, full-inventory, completed, and other invalid interactions respond immediately; they never impose a three-second penalty.

## Interaction invariants

- One accepted `E` press starts exactly one timeline. Further interaction input cannot overlap it.
- Authoritative state remains unchanged before the commit cue. The cue transacts and saves once; later cancellation can skip recovery presentation but cannot roll back the result.
- Reloading before commit permits a clean retry. Reloading after commit restores the result and never resumes transient animation.
- Movement and jumping are suppressed during the timeline, while mouse-look and Escape remain available.
- Insufficient labor energy starts no chore animation. Pass-out recovery saves fee or debt first, covers the teleport and camera reset with a bounded wake transition, then returns the player to the front gate until shelter repair establishes camp as the saved wake point.
- Lighting, cooking, and eating remain available at zero working energy.
- Reduced motion preserves duration and commit timing while suppressing recoil,
  repeated bobbing, and camera shake. Plant and water play no skeletal clip in
  this mode and rely on the saved garden-state cue; other actions retain their
  bounded code-native prop and progress treatment.
- Presentation or subscriber failure must not stop the action clock, duplicate a commit, retain the movement lock, or block progression.

## Implementation map

| File or symbol | Change | Source of truth | Proof |
| --- | --- | --- | --- |
| `src/content/day-one-actions-v01.js` | Declare duration, commit time, pose, prop, sound, and reduced-motion cues | Authored content | Every successful action is at least 3.0 s and has one valid commit cue |
| `src/game/DayOneActionController.js` | Add a transient frame-driven action clock with run, update, cancel, subscribe, and dispose | Interaction orchestration, never save authority | Exact-once commit at 60/120/144 Hz and across slow frames; overlap and cancellation coverage |
| `src/game/DayOneDirector.js` | Validate before starting; revalidate and transact once at the commit cue | Authoritative Day One state | No pre-commit mutation; save at commit; pass-out and zero-energy recovery stay safe |
| `src/controllers/PlayerController.js` | Add a bounded action lock and facing target; retain camera look | Player movement intent | Move/jump suppression and guaranteed unlock on completion, cancel, error, or dispose |
| `src/game/InteractableSystem.js` | Hold one in-flight interaction promise globally | Input edge | Repeated `E` cannot start overlapping work |
| `src/visuals/DayOneActionPresenter.js`, `FriendsiesAnimator`, and `PlayerAnimator` | Play and cancel the plant/water story clips in normal motion; project bounded code-native fallback and other chore presentation | Presentation only | Return to idle on every terminal event; missing clip and fallback avatar remain playable; reduced motion skips skeletal playback |
| `src/visuals/DayOneWorld.js` | Animate the axe, rod/bobber, fire, spit, soil, and shelter at authored cues | Consumes transient action plus saved snapshots | Prop cues de-duplicate and never become progression authority |
| `src/audio/CozySoundscape.js` and HUD | Add grounded contact/sizzle/pour/fastening cues and quiet action progress | Presentation only | Timing and accessibility browser pass |

The generic happy/magic chore bounce should be removed. Celebration remains appropriate when the whole afternoon is completed, not after every unit of labor.

## Asset boundary

`story-actions-v1` is the first dedicated skeletal action-family pilot. Its six
animation-only GLBs total 270,232 bytes: acknowledging, happy hand gesture,
thoughtful head shake, and relieved sigh for Lumen, plus dig/plant and watering
for Day One. The exact-rig converter samples them at 30 Hz, strips wrapper
translation, and bakes only bounded wrapper rotation that returns by the final
frame. It ships no source mesh, skin, material, texture, image, camera, or light.

In normal motion, plant and water are time-scaled into their authoritative
3.1/3.2 second windows; mixer completion never owns the state transaction. In
reduced motion they play no skeletal clip, and a missing catalog or individual
file falls back locally without changing the action clock or save result. Chop,
fish, fire, cook, eat, and repair retain their code-native presentation; Joy and
dance are not relabeled as labor.

The family inherits ADR 0005's standing project-owner authorization for all
current and future animation sources and derivatives the owner controls or may
lawfully use inside Thornvale; it does not require another approval per file,
clip, pack, role, transform, or revision. The six exact sources, Mixamo product-
use terms, transforms, and hashes remain independently recorded and verified.
Raw Mixamo sources, standalone motion-pack redistribution, sublicensing, and
outside-project reuse remain excluded. Browser evidence for the Lumen reads,
plant/water contact cues, reduced motion, and failed-asset fallbacks is recorded
in
[`docs/qa/2026-07-13-story-actions-v1.md`](../docs/qa/2026-07-13-story-actions-v1.md).

## Blind-playtest proof

- Time every successful action and confirm its meaningful result lands at the visible contact cue.
- During each action, spam `E`, movement, jump, Escape, and reload immediately before and after commit.
- Run normal and reduced motion, bundled fallback and selected fRiENDSiES, clean and restored saves, plus the intentional pass-out route.
- Pass when four of five fresh players complete without coaching, no player loses or duplicates progress, and most describe the actions as satisfying or grounded rather than slow.
- Failure signal: repeated early movement attempts, uncertainty about when a resource was gained, or two or more testers calling repeated chores tedious.
- Next tuning decision: adjust recovery time or secondary repetitions first; do not shorten the anticipation/contact cue below legibility or add a broader crafting system.
