# 0010: Global player, world, and activity state

- Status: Accepted
- Date: 2026-07-20

## Context

The bounded Day One proof originally nested inventory, survival meters, camp,
garden, and activity counters under one chapter. Woodcutting and fishing are
now durable activities that can support later quests and progression outside
that chapter. Keeping tools or harvested resources inside Day One would create
competing inventories and make a persistent stump or catch ambiguous after the
chapter ends.

There are no existing players whose development saves require migration.

## Decision

`GameSession` version 1 is the only save authority and uses the storage key
`thornvale.game-session-v1`. It stores:

- global player meters, economy, stackable inventory, fish specimens, owned
  tools, upgrades, and equipment;
- global camp, garden, and stable tree records;
- lifetime woodcutting, fishing, cooking, and gardening totals; and
- story fields plus a Day One historical account and completion flag.

Chapter state may record what happened during its authored window, but it may
not own current inventory or duplicate world facts. All relevant inventory,
world, lifetime, and chapter consequences commit in one transaction. Exact
version validation rejects unsupported or internally inconsistent state; no
migration or compatibility getter is provided.

Fishing phase, tension, reel progress, tree fall, and swing animation remain
transient presentation state. UI and visuals consume snapshots and emit intent.

## Consequences

- Tools, wood, seeds, planted trees, stumps, and fish remain meaningful after
  the first afternoon and can become prerequisites or evidence for later
  authored content.
- A transaction must update inventory, lifetime totals, and any applicable
  chapter account atomically, including Day One completion when its predicate
  becomes true.
- Invalid loadouts, impossible counters, duplicate planting sites, invalid tree
  stages, and mismatched completion state cause the development save to reset.
- Future inventory screens, rod/axe tiers, bait tables, growth, and quests can
  consume the same authority without another save-state owner.
- Changing this hierarchy or its persistence semantics requires a later ADR and
  a new exact save version.
