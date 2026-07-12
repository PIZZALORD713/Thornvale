# Thornvale: Kawaii 2.0
> A cozy third-person village adventure where friendship is a mechanic — and conformity is the cost.

## The 2.0 visual overhaul

This folder is the presentation-first rebuild of Thornvale. It keeps the existing controller and Rapier physics foundation while replacing the greybox presentation with a complete, animated kawaii village:

- **fRiENDSiES characters by default**, loaded non-blockingly with a local offline fallback
- Four distinct Blender-authored cottages with porches, awnings, dormers, signs, trellises, and emissive windows
- An expanded village ring with doorstep paths, outer garden walks, fenced cottage plots, a pond, and authored wayfinding landmarks
- Animated clouds, chimney smoke, butterflies, drifting petals, fireflies, water ripples, foliage, bell motion, and interaction bursts
- Authored fRiENDSiES idle, walk, joy-jump, and rumba clips, plus a subtle procedural squash-and-sway layer
- Smooth cinematic day/night transitions with glowing windows, moonlight, stars, and a character key light
- Bloom, candy color grading, vignette, subtle grain, and adaptive quality fallbacks
- A responsive cinematic welcome screen and animated glass HUD
- Procedural Web Audio ambience, chimes, interaction sounds, and footsteps with no audio downloads
- Reduced-motion and responsive UI support

### Choose a fRiENDSiES character

The default character is token `#1`. Select another from the fRiENDSiES collection with:

```text
http://localhost:3000/?token=713
```

`?friend=713` is also supported. Use `?avatar=local` only to preview the offline fallback character.

### Visual quality controls

```text
?quality=high       # default
?quality=medium
?quality=low
?post=off           # direct-render debugging fallback
```

### Core Hook Proof v0.3

The default build now plays the complete first-run Core Hook test, **A Courtesy Before Dusk**:

1. Read the letter in your own handwriting.
2. Meet **Steward Lumen**, fRiENDSiES `#8914`.
3. Sign the Community Ledger and ring the bell once at dusk.
4. Leave the plaza and hear the impossible second bell.
5. Read the false correction, confront Lumen, and choose which account remains.
6. Reach either **Home, as recorded** or **A path the town forgot**.

Progress is saved locally and restores the story phase, time, steward position, route, choice, and ending. Use `?story=reset` (or `?reset=1`) for a clean first run. Use `?story=off` only for the presentation sandbox.

The optimized runtime clips are animation-only derivatives of [`PIZZALORD713/animation_collection2`](https://github.com/PIZZALORD713/animation_collection2). The first collection was audited but is not shipped because several source files require clearer redistribution provenance. See [`public/animations/PROVENANCE.md`](public/animations/PROVENANCE.md). Default player [`#0001`](public/friendsies/0001/PROVENANCE.md), Steward [`#8914`](public/friendsies/8914/PROVENANCE.md), and the Draco decoder are bundled for a dependable first run.

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
- **Technical prototype:** ✅ third-person controller, collision, authored town, story-driven day/night, fRiENDSiES animation, and debug tools
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

`npm run check` runs the story-state tests and the production build.

### Build for Production
```bash
npm run build
npm run preview
```

### Deployment Notes
- The project is a static Vite build. Deploy the `dist/` output to any static host (Vercel, Netlify, GitHub Pages).
- The hybrid procedural/Blender town, effects, fallback avatar, UI, soundscape, default player `#0001`, Steward `#8914`, and their decoder are bundled locally. Optional player-token metadata and model parts stream after the world is already playable.

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
