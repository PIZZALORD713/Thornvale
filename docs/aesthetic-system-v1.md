# Thornvale Aesthetic System v1

Status: implemented development slice; local review only
Chapter: **A Courtesy Before Dusk**
Creative thesis: **a treasured civic storybook that has learned to watch you**

## Brand boundary

Thornvale is the only player-facing masterbrand.

- `Thornvale` is the game, world, wordmark, and public product.
- `A Courtesy Before Dusk` is the current playable chapter.
- `fRiENDSiES` is exact-case cast/source credit in credits, provenance, debug,
  and internal tools only.
- `Trait Echo` is internal runtime terminology.
- `fRiENEMiES` is an internal art-direction lens: friendly forms reorganized
  into polite enforcement. It is not a collection, public sub-brand, logo,
  collaboration claim, or player-facing mode.

The same warm objects carry both readings. Thornvale never switches to a
separate horror skin.

## Central metaphor: the second witness

Thornvale treats private memory as lonely and unsafe. A truth becomes reliable
when the town supplies a second witness.

- Pairs mean witnessed or shared truth.
- Singles mean private memory.
- Daytime pairs retain slight independent motion.
- Dusk brings them into a shared rhythm.
- The anomaly creates exact stillness or impossible agreement.
- Comply restores perfect synchronization.
- Alter leaves one member of a pair out of register.

This keeps the town morally ambiguous: collective memory may be care, control,
or both.

## Trait casting grammar

Traits are civic language, not meadow filler or collectibles.

| Collection category | Thornvale meaning | Placement rule |
| --- | --- | --- |
| Sprout | Identity, office, district, or belonging | One crest above eye level per landmark |
| Hand item | Gift, courtesy, ritual, access, or observation | One mounted tool at threshold or hand height |

Active vocabulary:

- `Flower White`: offered kindness and evidence that kindness occurred.
- `Torch`: guidance becoming ritual boundary.
- `Crown Up`: civic office and authority.

The v1 stage uses seven instances in three trait draw families:

- one private arrival Flower;
- a paired Flower witness at the Community Ledger;
- paired Gate Torches;
- one Bell ritual Torch;
- one Ledger Crown crest.

Every instance declares an authored `offering`, `sconce`, or `crest` socket.
One shared code-native mount draw call provides contact and cast shadow. The
free-standing spawn Torch and redundant arrival Flower were removed.

Rights-gated intake order:

1. `Friends Key` as the Welcome Gate crest;
2. `Book Of Ocean` on the Ledger shelf;
3. `Resting Green Leaf` at the comply cottage;
4. `Kaleidoscope` only after the second-bell reveal.

`All Seeing`, `Orb`, `Warp`, `Rebirth`, `Crown Down`, and additional flower
colors remain on hold. Their literal meaning or repeated silhouettes would
collapse the ambiguity or recreate decorative clutter.

## Courtesy / Correction shell

The shell uses one semantic token set projected across arrival, day, dusk,
post-bell, anomaly, intervention, comply, and alter.

| Token | Courtesy | Correction | Comply | Alter |
| --- | --- | --- | --- | --- |
| Paper | `#FFF8EA` | `#EEEAE7` | `#F7F1DC` | `#F0EEF7` |
| Ink | `#332A3E` | `#29263D` | `#2F3D35` | `#2D2C47` |
| Primary | `#7A3F59` | `#625B8E` | `#52745E` | `#5B628E` |
| Secondary | `#315B4A` | `#AEBCEB` | `#C99A4B` | `#7B70B5` |
| Signal | `#D79B45` | `#C88A46` | `#E0BC63` | `#B8C7FF` |
| Route | `#F1B96E` | `#8D87C8` | `#FFD28C` | `#BEC8FF` |

Courtesy uses slightly asymmetric paper corners and independently offset
witness marks. Correction keeps the paper illuminated while the world cools,
tightens component radii, and snaps paired marks into exact registration.
There is no red, glitch, gore, or novelty horror typography.

Typography roles:

- UI/display: Avenir Next, Segoe UI, or system sans-serif at moderate weight;
- letters and civic records: Iowan Old Style, Palatino, or Georgia;
- signature face: only the player's actual signature;
- monospaced face: debug only.

The welcome panel sits left on wide screens so the gate and in-world trait
language remain visible. Below 900 px it becomes a centered responsive card.
Live HUD surfaces are hidden until entry. During play, the current objective
outranks transient status and controls.

## Presentation state flow

`GameSession` remains the only authoritative source. No aesthetic field is
written into the save schema.

```text
GameSession snapshot
  -> AestheticPresentation (pure event-precedence projector)
      -> DOM data attributes and semantic CSS tokens
      -> StoryUI qualitative remembrance
      -> StoryWorld ledger mood and route grammar
  -> FriendsiesTraitEchoes (render-only trait posture and timing)
```

Projected root attributes:

- `data-story-state`
- `data-story-mood`
- `data-town-standing`
- `data-ledger-mood`
- `data-story-route`

The event sequence outranks a stale phase field, so a restored anomaly save
reinstates the violet false-record treatment and synchronized trait state.
Projection failures are isolated from completed story transactions.

## Qualitative town standing

The internal 0–100 Neighborliness value remains available to debug systems but
never appears in player UI or accessibility text.

| Story state | Player-facing standing |
| --- | --- |
| Arrival | A new face |
| Met Lumen | Kindly met |
| Signed Ledger | Written in |
| First Bell | In good standing |
| Anomaly / intervention | Being worried over |
| Comply | Home |
| Alter | Differently |

The fixed label is `THORNVALE REMEMBERS`.

## Consequence grammar

- Comply uses two close honey witness stitches at every route sample.
- Alter uses sparse, skewed violet ink-thorns with alternating visual weight.
- Both preserve the proven route coordinates, destinations, clearance, and
  ending triggers.
- Reduced motion preserves the still visual meaning without animated lift.

## Motion hierarchy

Motion has three channels:

1. ambient: slow sky, restrained particles, and GPU grass breath;
2. response: interaction burst, bell, or a local trait reaction;
3. anomaly: synchronized stillness or one dominant coordinated change.

Only one channel should dominate a shot. Ambient particle counts and post
saturation were reduced so story responses can read. Breathing grass is a
single instanced draw call with shader-driven tip displacement; JavaScript
updates one shared time uniform, never individual blades. Quality caps and a
static reduced-motion treatment protect frame cost and accessibility. A
camera-space 3–7 m scale envelope collapses near-lens tufts before they can
become cropped screen-edge shards; it adds no CPU or per-instance work.

Ambient insects follow the same hierarchy. The former six town-wide
rectangular-wing butterflies were replaced by two pond dragonflies plus one
Garden Arch dragonfly on medium/high quality (two total on low). Faceted
moss-ink bodies and translucent celadon kite wings render in two instanced
draws. Their deterministic motion alternates long inspection holds with short
bounded darts, stays inside habitat envelopes, and fades before night routes
appear. Reduced motion preserves a static first-station silhouette while still
allowing the dusk fade.

Legacy square petal points fade to zero and leave the render list before night
consequence routes appear. The shaped pooled fireflies, petals, sparkles, and
sky stars remain, while zero-opacity weather systems skip submission. When an
objective is active, the controls retain faint key hints but shed their paper,
border, blur, and shadow until hovered, keeping the objective as the dominant
civic surface.

At teardown, ambient life, Trait Echo, and breathing grass release their
resources and unregister callbacks before the shared world animator is cleared.
The app then nulls every presentation reference exposed to diagnostics, so a
reload or future in-page remount cannot retain the new GPU resources.

## Runtime and rollback contracts

- Default: `?assets=pilot&traits=v1`
- Explicit world rollback: `?assets=baseline` restores the v0.3 procedural
  landmarks, 64 static grass tufts, and six legacy butterflies; it makes no
  pilot-plaza request and constructs no breathing-grass or dragonfly owner.
- Explicit trait rollback: `?traits=off`
- Direct-render diagnostic: `?post=off`
- Quality checks: `?quality=low|medium|high`
- Story reset: `?story=reset`

Presentation variants must not move interaction IDs, story anchors, colliders,
route destinations, or save fields. No new collection binary is permitted
until its exact variant completes source-integrity, fit, budget, fallback, and
rollback review. Canonical fRiENDSiES material inherits ADR 0004 and never
requires a new permission decision for a role, placement, or transform.

## Validation matrix

Review at minimum:

- 1440×900, 1488×644, 800×600, and 390×844;
- day, dusk, night/anomaly, comply, and alter;
- `traits=off` and `traits=v1`;
- baseline and pilot assets;
- high and low quality;
- default and reduced motion;
- clean save, restored anomaly, both routes, and reset.

The welcome frame should leave at least 60% of a wide viewport unobscured.
No player-facing collection name, token number, asset jargon, or numeric
Neighborliness may leak into the default journey.

## Release boundary

ADR 0004 supplies one standing project-wide authorization for present and
future canonical fRiENDSiES assets in every integrated Thornvale role, including
characters, hand items, sprouts, backpieces, props, environments, UI, and local
or streamed delivery. Token, variant, hash, role, context, transform, catalog
revision, and delivery changes do not reopen permission.

The pinned `1..10000` catalog, exact component prefix, local hashes, transforms,
budgets, fallbacks, and QA remain engineering release gates. Standalone asset
packs, bulk raw collection mirrors or dumps, sublicensing, and outside-Thornvale
reuse remain excluded. `friendsies-animations` stays separately governed where
Mixamo supplies upstream motion rights.
