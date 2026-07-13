# fRiENDSiES animation provenance

These runtime files are animation-only derivatives. Redundant token `#7499`
meshes, materials, and textures were removed before inclusion in Thornvale.

## Permission and release scope

- Manifest status: `project-release-authorized`
- Release blocked: no
- Authorization: the source-repository and Thornvale project owner explicitly
  authorized these exact runtime derivatives for use and publication in
  Thornvale on 2026-07-11 and 2026-07-12, and reaffirmed that release scope on
  2026-07-12.
- Supporting product-use terms: Adobe's [Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html),
  retrieved 2026-07-12, permits royalty-free use of Mixamo characters and
  animations in video games.
- Runtime distribution: permitted when bundled as part of Thornvale game builds.
- Raw-source and standalone asset-pack redistribution: not permitted by this
  record.
- General reuse outside Thornvale: not granted.

| Runtime file | Source file | Source repository commit | Source SHA-256 | Runtime SHA-256 |
| --- | --- | --- | --- | --- |
| `friendsies-walk.glb` | `walk.glb` | `PIZZALORD713/animation_collection2@f8286ef2c5421d54115afdafdac33f206533ac25` | `6188c653463f18ad5dc170f4e77e7e1427259023cc96a9f5351cad1103319ebb` | `a1acaf9e7381ebc44698ac37c33dd0b12ff00706fd8b13ed9de39651a333105f` |
| `friendsies-joy-jump.glb` | `joy-jump.glb` | `PIZZALORD713/animation_collection2@f8286ef2c5421d54115afdafdac33f206533ac25` | `441008097f4e8b1fc7de0b39f45a5b5135f6e2102aa1f0aaddad9de38fcfd97a` | `985642e608caac9405ca43f285a70e16e19efcaadff1706be2f87c27438cdfe5` |
| `friendsies-dance-rumba.glb` | `dance-rumba.glb` | `PIZZALORD713/animation_collection2@f8286ef2c5421d54115afdafdac33f206533ac25` | `f50fa5c49d7d85dd813d2e64f819289729733413fd4807b919e230ae2c220b34` | `001f71011ae8746c45a498b3b49464a10caf5cb21c9d4b3a5b0287edd3cb1117` |

## Runtime animation contract

The measured GLTFLoader clip contract is:

| Runtime file | Clip | Duration | Runtime role and loop policy |
| --- | --- | ---: | --- |
| `friendsies-walk.glb` | `walk-high-arms` | 1.417 s | Loaded and available by name; not selected by the current role map |
| `friendsies-walk.glb` | `walk-low-arms` | 1.333 s | Player walk; repeats while locomotion remains grounded and moving |
| `friendsies-joy-jump.glb` | `Joy-Jumper` | 1.900 s | Preserved joy one-shot and source for the derived jump phases |
| `friendsies-dance-rumba.glb` | `Dance_Rumba` | 2.400 s | Dance one-shot; clamps at completion before the prior locomotion loop resumes |

All four source clips target the same normalized 20-node contract as the
bundled fRiENDSiES body: `Root`, `Spine1`, `Spine2`, `Spine3`, `Head`, paired
`Biscep`, `Arm`, `Hand`, `Attachment`, `Thigh`, `Shin`, and `Toe` nodes, plus
`Backpiece_Attachment`. Three.js sanitizes punctuation while loading, so source
body names such as `Attachment.L` bind to animation targets such as
`AttachmentL`. The animation derivatives intentionally contain nodes and
animation tracks but no mesh, material, texture, image, or skin payload.

Each clip carries constant two-key `Root.position`, `Root.quaternion`, and
`Root.scale` tracks. The loader preserves those tracks, but they contain no
root displacement to extract; `CharacterMotor` and `VisualRig` remain
authoritative for player movement and placement. The body GLB supplies the
skeleton, rest pose, and embedded idle. These animation-only files do not
replace or infer a frame-zero rest pose.

At runtime `Joy-Jumper` is also split at 30 fps into
`friendsies-jump-ascent`, `friendsies-fall`, and `friendsies-land`. Those
physical-state-driven clips, Joy, Dance, and landing use `LoopOnce`; the
embedded idle and selected walk use `LoopRepeat`. Subclips begin at their
selected source frames without rebasing the character skeleton or writing
animation state into physics, story state, or saves.

The source repository has no general `LICENSE` file. That does not narrow the
explicit project-specific publication authorization recorded above: the three
hashed runtime derivatives are approved for Thornvale builds while the source
files and standalone animation assets remain outside that grant.

`PIZZALORD713/animation_collection` was audited but is not copied here. Several
of its source files identify Mixamo provenance; they are outside this exact-file
authorization and require their own intake record before inclusion.

## Verification

- `node --test tests/friendsies-animation-assets.test.js tests/friendsies-animation.test.js`:
  9/9 passed; the shipped GLBs and runtime locomotion policy pass their focused
  offline contract suites.
- `node --test tests/asset-budgets.test.js`: 7/7 passed after the scoped local-
  family authorization update.
- `npm run check`: 153/153 tests passed on the `origin/main` integration, the
  production build completed, and the development asset audit passed at
  8,066,610 bytes of the 8 MiB deployment
  budget.
- `npm run assets:release`: `friendsies-animations` and the exact authorized
  local character/Trait Echo families are absent from the strict blocker list.
  The separately authorized remote-player family is evaluated through its
  pinned catalog, token-range, origin, and integrated-player contract rather
  than inheriting authority from these animation files. The refreshed command
  passed with 21 runtime files, one external dependency, and production `dist`
  at 8,066,610 / 8,388,608 bytes.
- No animation binary, runtime URL, loader, fallback, or player-facing behavior
  changed in this provenance and contract-test update.
