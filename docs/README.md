# Engineering Documentation

This directory holds implementation-facing records that help contributors
change and ship Thornvale safely. Product intent and player-facing design stay
in [`../wiki`](../wiki/Home.md).

## Sections

| Directory | Purpose |
| --- | --- |
| [`architecture`](architecture/README.md) | Current runtime boundaries, dependency flow, and planned extraction seams |
| [`decisions`](decisions/README.md) | Durable architecture decision records (ADRs) |
| [`qa`](qa/README.md) | Automated and manual verification procedures and evidence |
| [`release`](release/README.md) | Repeatable release preparation and handoff |

Keep these documents close to the implementation they describe. If a change
alters a player rule, narrative promise, visual target, or product milestone,
update the relevant wiki page as well.
