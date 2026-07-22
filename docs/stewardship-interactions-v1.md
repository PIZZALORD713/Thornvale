# ThornVale Stewardship Interactions v1

## Decision

- **Status:** Implemented and verified on
  `codex/global-inventory-wood-fishing-v1`; this document records the shipped
  slice without changing the wider commitments in `wiki/Plan-2.0.md`.
- **Player-facing beat:** Find and keep the canonical fRiENDSiES axe, fell a
  physical mature tree to a persistent stump, plant its guaranteed seed, then
  use the canonical fRiENDSiES `hand:Guess` fishing pole to cast, hook, fight,
  and land an easy pond fish.
- **Player-feeling shift:** Completing assigned chores -> beginning to inhabit
  and alter a place that remembers the player's actions.
- **Fresh-player hypothesis:** A player can learn both loops without coaching,
  explain why a strike or catch succeeded, and identify the persistent evidence
  left in the world.
- **Implementation gate:** The complete Core Hook remains finishable while the
  new wood and fishing behavior can be played from a clean save, restored after
  reload, and exercised in normal and reduced-motion presentation.

## Product contract

### Cozy pleasure

- The axe is a real found object and remains part of the player's global tool
  collection.
- Each axe strike has anticipation, contact, recoil, visible trunk damage, and
  readable progress toward a directional fall.
- A felled mature tree leaves a stump, drops usable wood, and guarantees one
  replacement seed.
- Fishing uses a short skill sequence: cast, read the true bite, hook, manage
  line tension, and land the fish.
- The canonical `hand:Guess` pole presents the forgiving simple-rod tier; better
  rods and bait remain represented in the state contract but only the first
  tier is playable in v1.

### Precise wrongness and future content seam

The first planting patch is marked as the town's approved replacement site.
The v1 implementation proves persistent planting but does not yet move or
correct an unapproved sapling. A later authored beat may contrast genuine
stewardship with the town's insistence that every replacement grow in its
assigned place.

### Protected ambiguity

Marked planting can plausibly be careful land management or a system that
controls where anything new is allowed to take root. The mechanic must remain
sincerely useful before later story content applies pressure to it.

## Authoritative state contract

The expanded game uses a clean global state. No legacy-player migration is
required; incompatible development saves reset safely.

```text
GameSession
├── story: phase, relationships, choices, events, ending
├── player
│   ├── meters: energy, nourishment
│   ├── economy: coins, doctorDebt
│   ├── inventory
│   │   ├── stackables: wood, commonTreeSeed, wormBait
│   │   └── specimens: individual catch records
│   ├── tools: owned tool IDs
│   └── equipment: axe, rod, bait
├── world
│   ├── trees: stable authored tree states
│   ├── trees: authored and player-planted trees with planting-site IDs
│   ├── garden: Day One garden state
│   └── camp: fire and shelter state
├── activities: durable woodcutting, fishing, meal, and planting totals
└── chapters.dayOne: historical account and completion state
```

### Invariants

- Inventory, tools, world state, and activity totals have one authoritative
  owner; chapter or quest state does not duplicate current inventory.
- A tool cannot be equipped unless it is owned.
- A tree uses a stable authored ID and one lifecycle state:
  `mature -> stump`; a planting uses `empty -> seedling` in v1.
- A mature tree's wood and seed reward commits exactly once when the final
  strike contacts. Reload cannot restore the tree while preserving its reward.
- A stump cannot be struck for another reward.
- Planting consumes one seed exactly once and produces one persistent seedling.
- Every committed tree strike spends the established chop labor cost in the
  same transaction as its contact. Insufficient energy changes no tree state
  and uses the existing retained-inventory clinic recovery path.
- Fishing bait commits on cast, while the fish specimen and activity totals
  commit exactly once on a successful landing; misses and line breaks award no
  fish. The forgiving simple-rod v1 does not charge energy.
- Transient swing, fall, bobber, bite, tension, and landing animation state is
  never the source of saved gameplay truth.
- Day One completion continues to derive from durable global facts and chapter
  progress even after resources are consumed.
- Once Day One completes, its historical account is frozen; later stewardship
  still advances lifetime activity totals and global inventory.

## Playable scope

### Woodcutting v1

1. Find the canonical fRiENDSiES `hand:Axe` at the forest-edge wood station.
2. Collect it to add and equip `tool.axe.friendsies`.
3. Approach any of three authored mature trees.
4. Commit repeated strikes while movement is locked only during each swing and
   camera look remains available.
5. On the final contact, persist the stump and grant the tree's wood plus one
   common tree seed exactly once.
6. Approach the authored planting patch and plant the seed.
7. Reload and verify the stump, inventory, tool, and seedling agree.

### Fishing v1

1. The player begins with `tool.rod.simple`, visually represented by canonical
   fRiENDSiES `hand:Guess`; worm bait is optional for easy fish.
2. Interact at the pond to enter fishing mode and cast.
3. Read tentative nibbles and press on the true plunge inside the hook window.
4. Hold to reel while countering the fish's direction and keeping tension below
   the break threshold.
5. Fill landing progress to commit one individual pond-fish catch.
6. A miss or line break returns to a retryable pond state without reward.
7. Keyboard/touch share semantic input. Hold-to-reel avoids button mashing.

### Explicit non-goals

- Chopping every decorative town tree
- Procedural forests, free-placement planting, seasons, or real-time growth
- Axe durability, broad crafting, shops, or a general economy
- More than one axe tier or rod tier in the first playable gate
- Rare-fish schedules, weather tables, fish population depletion, or dozens of
  species
- A generic inventory screen or quick-action radial before tool choice requires
  one
- The later planting-correction story beat

## Implementation map

| Layer | Responsibility | Proof |
| --- | --- | --- |
| `src/content/` | Tool/item IDs, authored tree/patch/pond definitions, action timing, fish profiles, prompts | Frozen content-contract tests |
| `src/game/GameSession.js` | Global player, inventory, tools, equipment, world, activities, and chapter state | Default/reset, validation, transaction, reload, and impossible-state tests |
| `src/game/` feature directors/controllers | Axe pickup, tree strikes, planting commits, fishing state machine, energy costs, exact-once rewards | Deterministic state-machine and reload tests |
| `src/config/town.js` | Stable anchors and interaction placement | Route and interaction-target tests |
| `src/visuals/` | Tree lifecycle, damage/fall/stump/seedling projection, pond/bobber/rod/fish projection, canonical axe and pole loads with procedural fallbacks | Projection tests and browser observation |
| `src/ui/` | Global essentials and fishing phase/tension feedback; emits intent only | DOM/accessibility tests |
| `src/main.js` | Composition, registration, lifecycle, and frame updates only | Browser smoke and disposal tests |
| `assets-src/`, `public/`, manifest | Exact canonical axe and `hand:Guess` pole sources, hashes, runtime paths, transforms, fallbacks, and provenance | Asset contract tests and `npm run assets:audit` |

## Work sequence and gates

1. **State gate:** Global state defaults, reset, transactions, sanitization, and
   existing Core Hook/Day One regressions pass.
2. **Asset gate:** Canonical axe and fishing-pole source/hash/provenance plus
   procedural fallbacks pass focused asset tests and the development audit.
3. **Tree gate:** Axe discovery through planted seedling passes deterministic
   state/projection tests and refresh verification.
4. **Fishing gate:** Cast through landing and miss/break recovery pass
   deterministic input/state tests.
5. **Integration gate:** Existing arrival-to-ending route remains finishable;
   the new interactions are readable in the real browser.
6. **Broad gate:** `npm run check` and the asset audit pass, followed by the
   targeted browser matrix below.

## Browser acceptance

- Clean save and `?story=reset`
- Desktop controls and deterministic touch controls
- Normal and reduced motion
- High and low quality
- Default bundled character and asset-load failure fallback
- Axe pickup, three-tree interaction availability, repeated strikes, final fall,
  stump, wood/seed reward, planting, and refresh persistence
- Cast, false nibble, true bite, hook, tension, reel, landing, failure retry,
  fish inventory record, and refresh persistence
- Existing campfire, garden, shelter, Bell, correction, and both ending routes
- No unhandled console errors or startup-blocking optional asset request

## Phase-end evidence

- Record completion time, help requests, stalls, early hook attempts, line
  breaks, trees struck, and whether the player notices the stump and seedling
  after returning to the grove.
- Pass when a fresh player finds the axe, fells and replants one tree, and lands
  an easy fish without coaching, while accurately describing the important
  timing feedback.
- Failure signals are unclear tool discovery, rewards that feel detached from
  contact, fishing outcomes that feel random, or persistent world state the
  player does not notice.
