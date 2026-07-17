# Milestone 1 Day One Cohort

- **Cohort ID:** `M1-DAYONE-2026-07-16-A`
- **Status:** Phase 1 broad build complete; available for lightweight fresh-player feedback
- **Study condition:** production desktop build, pilot assets, trait echoes on,
  keyboard and mouse, high quality, normal motion

This checkpoint tests whether a route-naive player can complete the authored Day One
and Core Hook without required coaching, understand the food-and-energy loop,
feel ownership of the repaired camp, and recognize the Bell and Ledger turn. It
is a reproducible Phase 1 reference, not a fixed-quota permission gate. Later
work should still follow an explicit phase contract rather than expanding these
systems incidentally.

## Frozen build contract

| Field | Frozen value |
| --- | --- |
| Runtime source commit | `1e58739c9fe6ae9c1a218f7eaa8c98dabb4827ea` |
| Production deployment | GitHub deployment `5457588533`, successful 2026-07-15 |
| Immutable deployment | `https://thornvale-eaq6816nf-pizzalords-projects.vercel.app` — redirects unauthenticated visitors to Vercel SSO, so do not give this URL to participants |
| Public participant URL | `https://thornvale.vercel.app/?quality=high&assets=pilot&traits=v1&controls=desktop&friend=6602&cohort=M1-DAYONE-2026-07-16-A` |
| App bundle | `assets/index-CNX6_PYE.js` |
| Bundle SHA-256 | `827e9dbcde47f92559ee19cc159cba4c7aa5b0d17d178faf44dd43e854a255df` |
| Automated release gate | `npm run check`: 255/255 tests, production build, and asset audit passed; production `dist` was 8,379,189 / 8,388,608 bytes |
| Qualified browser | Chrome 150 on macOS, 1280 x 720 viewport, DPR 1 |

The public alias is mutable. Record the served bundle when exact comparison
matters. If the runtime changes, use a new build label; ordinary phase feedback
may continue across labeled refinements, while baseline-versus-pilot comparisons
must use a consistent build and condition.

Do not keep `story=reset` in the participant URL: it would erase the save again
on reload. Give each participant a new browser profile or clear Thornvale local
storage before opening the frozen URL.

## Operator qualification

These are release preflights, not fresh-player evidence.

### Clean route — passed

- Used the production URL and browser-dispatched keyboard events through the
  production InputManager, motor, collision, and interaction paths; no teleport,
  save injection, direct director calls, or preloaded state.
- Signed the Ledger before starting chores, walked every town, pond, camp, and
  Bell route, and completed all eight Day One actions.
- Finished the afternoon at 33 energy, 85 nourishment, and one wood. The Ledger
  showed wood `6 / 6`, fish `1 / 1`, fire recorded, supper prepared and taken,
  seed bed planted and watered, and shelter recorded under the signed name.
- The shelter changed from the collapsed bundle to the erected tent, the first
  Bell rang, the return-route second Bell used its camera reveal, and the Alter
  branch reached its ending.
- Final console result: zero warnings and zero errors.

### Intentional pass-out route — passed

- Gathered wood, caught and cooked the fish without eating it, then planted and
  watered the garden. Attempting the shelter at 6 energy triggered recovery.
- The unrepaired-camp wake returned to the front gate at approximately
  `(0, 0.91, 14)`, restored energy/nourishment to `70 / 55`, charged four coins,
  incremented pass-outs to one, and retained five wood, one cooked fish, the
  lit fire, and the completed garden. The shelter remained visibly collapsed.
- The live Ledger truthfully showed supper prepared but not taken and shelter
  awaiting. A real page reload restored the same gate position, inventory,
  meters, fee, pass-out count, objective, and world projections.
- Eating and then repairing produced 82 energy, 93 nourishment, one wood, a
  complete Day One account, and the erected shelter. The recovered route then
  walked to and rang the first Bell.
- Final console result: zero warnings and zero errors.

### Reference performance sample

An 8.965-second production walk at 1280 x 720 on Chrome 150 sampled 1,070
animation frames: 8.33 ms median, 8.36 ms p95, 8.80 ms p99, and 9.28 ms maximum.
This is a qualification-machine reference, not a representative-device support
claim.

## Session protocol

1. Create a clean browser profile or clear `thornvale.core-hook-v03` before the
   participant arrives. Open only the frozen public URL above.
2. Use a participant who has not watched, tested, or been briefed on this route.
3. Say only: “Please play until the game clearly ends. Think aloud if you are
   comfortable.” Do not teach controls, point toward objectives, or explain the
   story unless the participant explicitly asks.
4. Copy [`FRESH-PLAYER-TEMPLATE.md`](FRESH-PLAYER-TEMPLATE.md) for the session.
   Record exact behavior and help requests before interpretation.
5. Ask the template's post-play questions before explaining intent or showing
   another outcome.
6. Keep incomplete sessions. If technical failure prevents a comparable run,
   record it and add another fresh participant rather than erasing the evidence.

In addition to the stable template fields, record time to first self-directed
resource action, optional extra work, food/energy comprehension, perceived
action weight, camp attachment, and whether the Bell conflict felt more
consequential after repairing the shelter.

## Feedback and refinement rule

Invite fresh players as they are available and use the short questionnaire.
Review roughly three sessions for early repeated patterns; five or more improve
confidence but are not required before agentic work continues. Fix reproducible
progression, save-integrity, or runtime failures immediately. Carry ordinary
confusion, action-weight, comprehension, and emotional-response findings into a
bounded refinement pass. Do not generalize from operator preflights or a single
participant, and do not treat isolated taste as a stop-work order.

| Slot | Record | Status |
| --- | --- | --- |
| 01 | `YYYY-MM-DD-session-01.md` | Available |
| 02 | `YYYY-MM-DD-session-02.md` | Available |
| 03 | `YYYY-MM-DD-session-03.md` | Early pattern review |
| 04 | `YYYY-MM-DD-session-04.md` | Optional confidence |
| 05 | `YYYY-MM-DD-session-05.md` | Optional confidence |
