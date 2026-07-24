---
schema: thornvale.character-card/v1
card_id: "friend:6602"
kind: friendsies
token_id: 6602
label: Friend 6602
aliases:
  - "fRiENDSiES #6602"
canon_status: verified-runtime
story_role: default-player
story_identity: unassigned
asset_root: /friendsies/6602
rig: friendsies-humanoid-v1
action_packs:
  - story-actions-v1
trait_backpiece: Ghostin
trait_body: Pop
trait_face: Romeo
trait_hand: Staffv
trait_head: Deli
trait_shoe: High Boots Red
trait_sprout: Totem
source_refs:
  - src/content/friendsies-cast.js
  - assets-src/friendsies/6602/SOURCE.md
  - public/friendsies/6602/PROVENANCE.md
tags:
  - thornvale/character
  - friendsies
---

# Friend 6602

> [!info] Canon status
> This card records the verified default-player asset and runtime role. The
> repository does not assign this Friend a personal name, pronouns, personality,
> memory, relationship, or dialogue.

## Verified identity

- Token: `#6602`
- Runtime role: `default-player`
- Story use: `arrival`, `player-avatar`
- Rig: `friendsies-humanoid-v1`
- Assembly: six GLB mesh parts plus one face PNG

## Verified traits

| Part | Trait |
| --- | --- |
| Backpiece | Ghostin |
| Body | Pop |
| Face | Romeo |
| Hand | Staffv |
| Head | Deli |
| Shoe | High Boots Red |
| Sprout | Totem |

## Story identity

Unassigned.

## Open want

Unassigned.

## Private fear

Unassigned.

## Belief about ThornVale

Unassigned.

## Conflicting memory

Unassigned.

## Conditional action

Unassigned.

## Relationships

Unassigned.

## Consequences

Unassigned.

## Safe action surface

- Idle
- Walk
- Jump
- Joy
- Dance
- `day-one.plant-seed`
- `day-one.water-seed`

Steward Lumen’s four `lumen.*` gestures share the rig but are not authored
actions for Friend 6602 and are not exposed by this card.

## Playable 3D Preview

Run `npm run story-archive:dev`, then use the embedded local story-room preview:

<iframe
  title="Playable 3D preview of Friend 6602"
  src="http://127.0.0.1:3000/story-archive/Preview/?id=friend%3A6602&mode=play"
  allow="fullscreen"
  style="width: 100%; min-height: 680px; border: 0; border-radius: 18px;"
></iframe>

The preview is presentation-only. Animation completion does not change story,
save, physics, inventory, relationship, or progression state. Keyboard controls
are confirmed in desktop Chromium-class browsers. Touch controls are an input
pilot, not a full mobile support or performance claim.

## Sources

- `src/content/friendsies-cast.js`
- `src/config/player-character.js`
- `src/visuals/CharacterLoader.js`
- `src/visuals/loadFriendsiesAnimationPack.js`
- `src/content/story-actions-v1.js`
- `assets-src/friendsies/6602/SOURCE.md`
- `public/friendsies/6602/PROVENANCE.md`
- `public/animations/PROVENANCE.md`
- `public/animations/story-actions-v1/pack.json`
- `public/animations/story-actions-v1/PROVENANCE.md`
