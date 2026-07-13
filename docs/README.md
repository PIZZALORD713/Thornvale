# Engineering Documentation

This directory holds implementation-facing records that help contributors
change and ship Thornvale safely. Product intent and player-facing design stay
in [`../wiki`](../wiki/Home.md).

## Sections

| Directory | Purpose |
| --- | --- |
| [`architecture`](architecture/README.md) | Current runtime boundaries, dependency flow, and planned extraction seams |
| [`decisions`](decisions/README.md) | Durable architecture decision records (ADRs) |
| [`playtests`](playtests/README.md) | Fresh-player session procedure, template, and learning-skill gate |
| [`qa`](qa/README.md) | Automated and manual verification procedures and evidence |
| [`release`](release/README.md) | Repeatable release preparation and handoff |

The [fRiENDSiES trait workflow](friendsies-trait-workflow.md) covers the local
collection index, visual atlas, candidate probes, curation sidecar, and the
gates for promoting an individual trait into a game scene.

The [aesthetic system v1](aesthetic-system-v1.md) records the Courtesy /
Correction shell, Second Witness lore, trait casting, motion hierarchy,
presentation state flow, rollback rules, and visual QA matrix.

Keep these documents close to the implementation they describe. If a change
alters a player rule, narrative promise, visual target, or product milestone,
update the relevant wiki page as well.
