---
schema: thornvale.archive/v1
tags:
  - thornvale/archive
---

# ThornVale Story Archive

This folder is a small Obsidian vault for character truth, authored story
slots, and local playable previews. Open `story-archive/` as a vault.

## Start here

- Character: [[Characters/Friend 6602|Friend 6602]]
- Playable invocation: [[Invocations/Preview Friend 6602]]
- Reusable template: [[Templates/Character Card]]
- Schema contract: [[Schemas/Character Card v1]]
- Preview verification: [[QA/2026-07-23 Friend 6602 Preview]]
- Workshop verification: [[QA/2026-07-24 Friend 6602 Story Workshop]]

## Run the local preview

From the repository root:

```bash
npm run story-archive:dev
```

The preview is served over HTTP at
`http://127.0.0.1:3000/story-archive/Preview/?id=friend%3A6602&mode=play`.
Raw `file://` viewing is unsupported because the curated character assembly,
animation pack, and Draco decoder use root-relative runtime URLs.

## Use the character workshop

In the card rail, select any verified trait to see its exact value, runtime
asset, binding, provenance path, and automatically fitted isolated 3D view.
Choose **Full Friend** to restore the complete assembly.

To author local story details, open **Edit character details**, choose the
actual `Characters/Friend 6602.md` file, edit the exposed story sections, and
press **Save selected file**. Direct local-file saving requires desktop Chrome
or Edge over HTTPS or localhost. The editor re-reads before Save, preserves
unrelated changes, rejects same-field conflicts, and never exposes verified
identity, trait, rig, action, or source metadata for editing.

## Authority boundary

The archive records canon and exposes presentation-only motion. It does not
write ThornVale game saves, progression, relationships, inventory, physics, or
runtime story state. The explicit editor writes only the local Markdown file
the author selects; a normal commit and redeploy are still required to update
the shared link. Unknown character IDs, modes, actions, or missing required
assets fail visibly instead of substituting another Friend.
