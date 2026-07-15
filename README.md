# Thornvale: Kawaii 2.0
> A cozy third-person village adventure where friendship is a mechanic — and conformity is the cost.

## The 2.0 visual overhaul

This folder is the presentation-first rebuild of Thornvale. It keeps the existing controller and Rapier physics foundation while replacing the greybox presentation with a complete, animated kawaii village:

- **fRiENDSiES characters by default**, loaded non-blockingly with a local offline fallback
- Four distinct Blender-authored cottages with porches, awnings, dormers, signs, trellises, and emissive windows
- An expanded village ring with doorstep paths, outer garden walks, fenced cottage plots, a pond, and authored wayfinding landmarks
- Animated clouds, chimney smoke, localized pond-and-garden dragonflies,
  drifting petals, fireflies, water ripples, foliage, bell motion, and
  interaction bursts
- Quality-scaled breathing grass in one instanced draw, with deterministic path,
  landmark, building, pond, and story-route clearances and a static
  reduced-motion presentation; camera-space scaling keeps near-lens tufts from
  becoming cropped foreground shards
- Two-draw code-native dragonflies replace the old 18-mesh rectangular-wing
  butterflies: two insects on low quality and three on medium/high use
  deterministic stop–inspect–dart stations, then fade before night routes;
  reduced motion keeps their first-station silhouettes static
- Authored fRiENDSiES idle, walk, joy-jump, and rumba clips, plus a subtle procedural squash-and-sway layer
- Smooth cinematic day/night transitions with glowing windows, moonlight, stars, and a character key light
- Bloom, candy color grading, vignette, subtle grain, and adaptive quality fallbacks
- A responsive cinematic welcome screen and animated glass HUD
- Procedural Web Audio ambience, chimes, interaction sounds, and footsteps with no audio downloads
- Reduced-motion and responsive UI support

### Choose a fRiENDSiES character

The locally bundled default character is token `#6602`. Select another from the fRiENDSiES collection with:

```text
http://localhost:3000/?friend=8448
http://localhost:3000/fren/8448
```

The `friend` value can be a token ID or a full generator link such as
`https://www.frienemies.xyz/fren/8448`; `?token=8448` remains an alias. IDs are
strictly limited to `1`–`10000`, and selection is applied on initial navigation
or reload. Thornvale fetches only the selected token's catalog range and model
parts. A malformed or failed selection falls back to local `#6602`, then local
Steward `#8914`. A code-native emergency visual appears only if the bundled
decoder or both local fRiENDSiES families fail, keeping total asset failure
playable without replacing the normal fRiENDSiES-first path.

Canonical fRiENDSiES assets and metadata have standing project authorization
for integrated Thornvale use. The current player loader intentionally pins one
catalog revision, accepts IDs `1`–`10000`, and streams only the selected token's
components from `https://storage.googleapis.com`; those are source-integrity,
security, performance, and fallback constraints rather than permission limits.
The authorization does not permit standalone packs, bulk raw collection mirrors
or dumps, sublicensing, or reuse outside Thornvale.

### Visual quality controls

```text
?quality=high       # default
?quality=medium
?quality=low
?post=off           # direct-render debugging fallback
?assets=pilot       # versioned arrival/plaza art (default)
?assets=baseline    # restore the v0.3 procedural landmarks
?traits=v1          # fRiENDSiES Trait Echo v1 (default)
?traits=off         # remove environmental trait echoes
```

The pilot replaces only the Welcome Gate, Community Ledger, and Town Bell
visuals. Gameplay coordinates, colliders, interaction IDs, and story state stay
on the v0.3 contract, and each missing pilot root falls back independently.

The selectors are independent. For example, `?assets=baseline&traits=v1`
tests the trait language against the procedural landmarks, while
`?assets=pilot&traits=off` isolates the authored landmark overhaul. Missing
selectors use the intended `pilot + v1` composition; explicit `baseline + off`
is the full-presentation rollback, while `?traits=off` is the exact independent
Trait Echo rollback. Unknown selector values also fail safely to the matching
baseline or off mode.

### fRiENDSiES Trait Echo v1

Trait Echo v1 turns three already bundled character traits into a reversible
environmental story language along the opening route:

- Three `#0001` **Flower White** placements create one private arrival offering
  and a paired set of Ledger witnesses.
- Three `#8914` **Torch** placements mount as paired Gate sconces and one Bell
  sconce, carrying guidance into dusk ritual and authority.
- One `#8914` **Crown Up** placement marks the Ledger as civic office and tilts
  as the town's account becomes suspect.

Each trait has one semantic job: Flower White is offered and witnessed
kindness, Torch is civic guidance and ritual, and Crown Up is office. The
shared rule is the **Second Witness**: paired objects represent the town's
collective account, while the single arrival flower remains private.

The Ledger witness pair, Bell light, Torch glow, and Crown posture react to the
arrival, dusk, first-bell, anomaly, intervention, comply, and alter states.
Reduced-motion mode preserves the state changes without ambient sway or
flicker. The treatment is decorative and render-only: it does not move story
anchors, change collisions, or add save fields.

When the fRiENDSiES flower loads, the 56 generic procedural flowers on the
arrival/plaza corridor are removed; the 52 distant meadow accents remain as
perimeter texture. A trait-load failure restores the complete procedural
meadow automatically.

The seven placements reuse existing local GLBs and therefore add **zero new
asset bytes**. They render as three trait draw families and display **26,544
trait triangles** when every family loads. One additional shared, code-native
civic-mount draw grounds the seven traits as offerings, sconces, and a crest;
it adds no trait asset. The freestanding arrival Torch and duplicate arrival
flower from the first proof were removed. `Book Of Ocean`, `Friends Key`, `All
Seeing`, and `Orb` remain cataloged candidates only; none is loaded or shipped
by v1.

These canonical files and their Thornvale-authored arrangement inherit the
standing `friendsies-project` authorization. The same authorization covers
future canonical fRiENDSiES characters, detached traits, hand items, sprouts,
backpieces, tools, equipment, props, environments, UI, documentation, testing,
promotional captures, streaming, local bundling or caching, optimization,
transformation, and derivative runtime assets inside Thornvale. Exact source
URLs, hashes, transforms, budgets, fallbacks, and QA remain required engineering
evidence. Use `?traits=off` for the exact runtime rollback. See the [Trait Echo
v1 QA record](docs/qa/2026-07-12-trait-echo-v1.md), adjacent provenance files,
and [ADR 0004](docs/decisions/0004-friendsies-project-wide-authorization.md).

### fRiENDSiES trait library

The environmental trait library is indexed as development source data rather
than fetched by the Trait Echo runtime. The pinned catalog covers all 10,000
tokens, 1,077 named traits, and 1,447 distinct asset/preview variants while
preserving the token IDs that use each visual. Shareable full-player links use
the bounded ranged-metadata implementation described above; both local and
remote uses inherit the same project-wide authorization.

```bash
npm run friendsies:index
npm run friendsies:atlas
```

The atlas runs locally and provides searchable preview cards, type and curation
filters, variant/token context, and game-development notes. Candidate GLBs can
then be inspected one at a time:

```bash
npm run friendsies:probe -- --type hand --value "Book Of Ocean"
```

Probing does not add the candidate to the shipped game. See the
[trait workflow](docs/friendsies-trait-workflow.md) for the index-to-runtime
promotion gates.

### Core Hook Proof v0.3

The default build now plays the complete first-run Core Hook test, **A Courtesy Before Dusk**:

1. Read the letter in your own handwriting.
2. Meet **Steward Lumen**, fRiENDSiES `#8914`.
3. Sign the Community Ledger and learn that it records each town task.
4. Settle the forest-edge camp while the Ledger keeps a truthful account.
5. Ring the Bell once at dusk and start back toward Lumen.
6. See the Bell framed as it rings a second time on the return journey.
7. Read the false correction, confront Lumen, and choose which account remains.
8. Reach either **Home, as recorded** or **A path the town forgot**.

Progress is saved locally and restores the story phase, time, steward position, route, choice, and ending. Use `?story=reset` (or `?reset=1`) for a clean first run. Use `?story=off` only for the presentation sandbox.

The optimized runtime clips are animation-only derivatives of [`PIZZALORD713/animation_collection2`](https://github.com/PIZZALORD713/animation_collection2). ADR 0005 grants standing project-owner authorization for all current and future animation sources and derivatives the owner controls or may lawfully use in integrated Thornvale work, without a new approval per file, clip, pack, role, transform, or revision. It does not replace upstream terms or permit raw-source, standalone-pack, sublicense, or outside-Thornvale redistribution. The first collection remains unshipped until its exact source, upstream terms, transforms, budgets, fallbacks, and QA complete intake; owner reapproval is not the gate. See [`public/animations/PROVENANCE.md`](public/animations/PROVENANCE.md) and [ADR 0005](docs/decisions/0005-thornvale-animation-project-wide-authorization.md). Default player [`#6602`](public/friendsies/6602/PROVENANCE.md), Steward [`#8914`](public/friendsies/8914/PROVENANCE.md), the `#0001` Flower White trait, and the Draco decoder are bundled for a dependable first run.

## What is Thornvale?
**Thornvale** is a warm, cottage-core valley town that feels like a hug… until you notice the hug has a grip strength rating.

You arrive in a picture-perfect hamlet of mossy roofs, lantern-lit paths, and neighbors who *really* want to help. By day, it plays like a wholesome village sim: explore, craft, decorate, forage, run errands, and build relationships. By night, the town’s “welcoming” vibe twists into something uncanny: paths subtly rearrange, villagers repeat phrases like they’re reading from a script, and the hedges—heavy with thorns—feel like they’re listening.

The deeper you bond with Thornvale, the clearer it becomes: **community here is a system. Kindness is currency. Routine is law.**

## Core Hook
A cozy town game where the central mystery is:
**Are these people protecting you… or keeping you?**

## Gameplay Loop
### Day (Cozy Mode)
- Forage, fish, garden, craft, and decorate your cottage
- Help villagers with “wholesome” quests that unlock areas and upgrades
- Build relationships and learn local secrets through dialogue + favors
- Earn trust (and benefits) through participation in town routines

### Night (Uncanny Mode)
- Investigate anomalies and “impossible” changes in the environment
- Decode rules you were never explicitly told
- Survive “polite interventions” when you break the pattern
- Uncover what Thornvale is, what it wants, and why you were chosen

## Story Premise
You arrive in Thornvale for a fresh start — or chasing something that brought you here: a missing person, a strange job posting, a letter you don’t remember writing.

The town welcomes you immediately, almost *too* immediately. Everyone is kind in the same ways, at the same times, using the same phrases. It’s comforting… until it’s not.

Your choices shape the truth you uncover and what Thornvale becomes:
- **Assimilate:** become a pillar of the community (and inherit its power)
- **Escape:** break the loop and survive what follows you out
- **Rewrite:** expose the mechanism and change the town’s rules from within

## Design Pillars
- **Cozy with teeth:** warmth and charm, with a steady undercurrent of dread
- **Social horror:** the fear isn’t gore — it’s pressure, politeness, and conformity
- **Familiar, then wrong:** the world stays beautiful while reality bends around you
- **Player agency:** your relationship choices affect your safety, access, and ending

## Signature Unsettling Detail
Everyone is friendly… **in exactly the same way.**
Same phrasing. Same smiles. Same “helpful” nudges toward the approved path.

And the town keeps score.

## Key Systems (Concept)
- **Neighborliness (Reputation):** town-wide trust level that unlocks perks… and scrutiny
- **Routine System:** daily rituals that reward compliance and punish disruption
- **Anomaly Director:** dynamic “one weird thing” events (subtle → overt) that escalate
- **Polite Interventions:** NPCs and environment react to “rule breaks” with escalating softness
- **Cozy Progression / Uncanny Resistance:** upgrades help with crafting *and* surviving the weird

## Tone & Vibe
Think: **Garden Grove comfort** + **The Nudge unease**
Warm lamplight, handmade charm, soft music… and one detail that’s always slightly off.

Keywords: *cottagecore, folk-horror, uncanny social pressure, “nice” dystopia, pretty paranoia.*

## Current Status
- **Concept + narrative pillars:** ✅
- **Core loop definition:** ✅
- **Technical prototype:** ✅ third-person controller, collision, authored town, story-driven day/night, fRiENDSiES animation, desktop input, a bounded touch-input pilot, and debug tools
- **Core Hook Proof v0.3:** ✅ one steward, one rule, one anomaly, one intervention, two consequential outcomes, local save/reset, and state-transition tests
- **Current target:** five fresh-player validation sessions and tuning from observed completion/friction data

## MVP Controls (Playable Slice)
- **WASD**: Move
- **Shift**: Sprint
- **Mouse**: Look
- **E**: Interact
- **Space**: Jump
- **`**: Toggle debug overlay
- **N**: Toggle Day/Night only while debug mode is open
- **ESC**: Release cursor

On coarse-pointer touch devices, Thornvale automatically presents a left
movement stick, right-side drag look, outer-band sprint, Jump, and contextual
Interact/Skip actions. Use `?controls=touch` or `?controls=desktop` for an
explicit input path during QA; `?controlsStyle=classic` keeps the original touch
layout as a presentation rollback. Desktop keyboard and mouse remain the
supported baseline while representative-phone performance and full mobile
support stay behind their physical-device gate.

## Run & Deploy
### Local Dev
```bash
npm install
npm run dev
```

### Verify the build

```bash
npm test
npm run check
```

`npm run check` runs the full test suite, production build, and development
asset audit. `npm run assets:release` applies the stricter release gate. The
canonical fRiENDSiES collection has one standing authorization for integrated
Thornvale use; catalog pins, origins, hashes, transforms, budgets, fallbacks, and
QA remain engineering release gates. Covered animation sources and derivatives
inherit the separate standing authorization in ADR 0005, while their Mixamo,
repository, and other upstream source chains keep independent provenance and
license gates. Repeated project-owner approval is not required; unknown or
incompatible upstream rights still block release.

### Build for Production
```bash
npm run build
npm run preview
```

### Deployment Notes
- The project is a static Vite build. Deploy the `dist/` output to any static host (Vercel, Netlify, GitHub Pages).
- The hybrid procedural/Blender town, effects, UI, soundscape, default player
  `#6602`, Steward `#8914`, and their decoder are bundled locally. Optional
  player-token metadata and model parts stream after the world is already
  playable. Recovery prefers the local fRiENDSiES cast; an independent code-
  native safety visual appears only after total bundled GLTF or Draco failure.

## Roadmap (Plan 2.0)
1. **Rebaseline + Reliability** — reconcile decisions, remove remote startup blockers, and add CI/tests
2. **Core Hook Proof** — one complete authored routine where kindness becomes control
3. **Narrative Vertical Slice** — a polished 20–30 minute experience with three villagers and two endings
4. **Public Demo** — performance, accessibility, release, and support hardening
5. **Friends Mode (conditional)** — only after the single-player hook passes validation

See the canonical [Thornvale Plan 2.0](wiki/Plan-2.0.md) for scope, gates, metrics, risks, and the issue-ready backlog.

## Want to Collaborate?
If you’re into cozy games, narrative design, environment art, or systems that are secretly psychological warfare in a cardigan:
- Open an Issue with **ideas / mechanics / references**
- Or drop a pitch for a small contribution (quest chain, anomaly concept, NPC archetype)

---

**Tagline candidates (pick one):**
- *Warm cottage-core. One unsettling detail.*
- *Better Than Friends. Worse Than Rules.*
- *Welcome home. Please don’t change anything.*
