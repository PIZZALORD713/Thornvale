---
schema: thornvale.schema-note/v1
schema_id: thornvale.character-card/v1
tags:
  - thornvale/schema
  - thornvale/character
---

# Character Card v1

`thornvale.character-card/v1` is the minimum identity contract for an
Obsidian-native ThornVale character card.

## Required identity properties

| Property | Contract |
| --- | --- |
| `schema` | Exactly `thornvale.character-card/v1` |
| `card_id` | Stable resolver identity; filenames and labels are not identity |
| `kind` | Asset or character family |
| `token_id` | Safe integer for a fRiENDSiES card |
| `label` | Human-facing label |
| `story_role` | Verified runtime or authored role |
| `story_identity` | Explicitly `unassigned` until authored |
| `asset_root` | Expected root for every curated component |
| `rig` | Compatible motion rig |
| `action_packs` | Declared semantic action packs |
| `trait_*` | Seven flat fRiENDSiES trait properties |
| `source_refs` | Exact repository sources |
| `tags` | Ordinary Obsidian tags |

Mutable character authorship belongs in the Markdown body, not invented
frontmatter. Empty story sections are valid authoring slots.

## Invocation contract

Writers use normal wikilinks and transclusion:

```markdown
[[Characters/Friend 6602|Friend 6602]]
![[Characters/Friend 6602#Playable 3D Preview]]
```

Tools may use one fenced directive:

````markdown
```thornvale-character
id: "friend:6602"
mode: play
```
````

`id` is required and resolves only against `card_id`. `mode` is `card`,
`preview`, or `play`, defaulting to `card`. An optional future `action` must be
a semantic ID exposed by a declared action pack. Unknown or duplicate fields
fail visibly.
