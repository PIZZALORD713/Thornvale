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
- Verification record: [[QA/2026-07-23 Friend 6602 Preview]]

## Run the local preview

From the repository root:

```bash
npm run story-archive:dev
```

The preview is served over HTTP at
`http://127.0.0.1:3000/story-archive/Preview/?id=friend%3A6602&mode=play`.
Raw `file://` viewing is unsupported because the curated character assembly,
animation pack, and Draco decoder use root-relative runtime URLs.

## Authority boundary

The archive records canon and exposes presentation-only motion. It does not
write ThornVale saves, progression, relationships, inventory, physics, or story
state. Unknown character IDs, modes, actions, or missing required assets fail
visibly instead of substituting another Friend.
