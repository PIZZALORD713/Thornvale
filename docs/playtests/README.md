# Fresh-Player Playtests

Use these records to decide what ThornVale should change before expanding scope.
The current milestone and success thresholds remain authoritative in
[`../../wiki/Plan-2.0.md`](../../wiki/Plan-2.0.md).

## Run a session

1. Copy [`FRESH-PLAYER-TEMPLATE.md`](FRESH-PLAYER-TEMPLATE.md) to
   `YYYY-MM-DD-session-XX.md`.
2. Record the exact commit, URL or local command, query flags, browser, and study
   condition. Do not mix baseline and pilot observations in one session.
3. Start from a clean browser profile or cleared ThornVale storage. Use a player
   who has not watched the route or received story instructions.
4. Let the player think aloud if comfortable. Do not teach controls, explain the
   story, point toward objectives, or interpret an anomaly unless the player asks.
5. Record the time and exact request before helping. Mark whether the help was
   required to continue.
6. Ask the post-play questions before explaining intent or showing the other branch.
7. Complete the facilitator synthesis after the participant leaves.

Use a session ID rather than a participant name. Retain recordings, screenshots,
or direct quotes only with permission, and do not record unnecessary personal data.

## Preserve observation quality

- Record behavior before interpretation: what the player did, saw, said, or
  requested comes before the facilitator's theory.
- Separate progression blockers, friction, confusion, delight, and suggestions.
- Do not patch the build between sessions without recording a new commit or build
  label. A changed build begins a new comparison cohort.
- For baseline-versus-pilot tests, assign one condition per fresh participant.
  Showing both conditions teaches the route and invalidates a fresh comparison.
- Keep failed and incomplete sessions. They are evidence, not bad data.

## Later skill gate

Create `thornvale-playtest-learning` only after at least five complete session
records exist for a comparable build or explicitly labeled study. Use those raw
records as the skill's working examples.

The later skill should:

- aggregate completion, duration, help, anomaly recognition, theme comprehension,
  choice distribution, verified consequences, and replay interest;
- preserve exact observations separately from interpretations;
- group repeated friction by route stage and severity;
- compare cohorts only when build and study conditions permit it;
- rank the smallest evidence-backed changes before recommending new content; and
- produce a milestone decision: tune, retest, pass the gate, or stop for a blocker.

Do not let the future skill invent missing observations or convert one player's
preference into a product conclusion.
