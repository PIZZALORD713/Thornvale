# Key Object Cues v1 source

## Ownership and permission

- Manifest family ID: `thornvale-key-object-cues-v1`
- Creator or owning project: Thornvale project
- Intended status: `project-authored`
- Authorization or license: generated specifically for Thornvale without external image inputs; no root license is selected, so default project copyright terms apply; see `NOTICE.md`
- Source item page: none
- Direct source URL or repository commit: none; built-in OpenAI image generation output copied into this source family
- Authored: 2026-07-19
- Raw-source redistribution: not offered as a standalone art pack
- Release blocker: none

The built-in image-generation tool did not expose a model or generator version. No reference images, characters, logos, typefaces, downloaded textures, or third-party artwork were supplied. The three PNGs below are the unchanged generated outputs retained as the canonical visual inputs.

## Canonical inputs

| Input | Original generated filename | Bytes | SHA-256 | Storage | Role |
| --- | --- | ---: | --- | --- | --- |
| `community-ledger-source.png` | `exec-addbb796-6a8b-4707-8919-22ce11462894.png` | 2,350,408 | `1ecd8deab8fcd0943c3c1a9fde4c7be023793c9ec82d611a842868b28ef4be3b` | git | source |
| `forest-edge-camp-source.png` | `exec-36f4be7d-3d65-4c25-8b2b-9ecd5679129c.png` | 2,630,657 | `21908419258bf52065e22878c719766e467fc76d1b096509706d886deb9ae869` | git | source |
| `town-bell-source.png` | `exec-cbe8ec3e-479a-4a90-8dc9-ed917786b075.png` | 2,783,296 | `980d06a36745f3c2c1a018adab6e8f1d75fe2463fbe9ed7a1e4c8da240076de2` | git | source |

- Intake batch: `2026-07-19-key-object-cues-v1`
- External images, textures, fonts, scans, or references: none

## Final prompt set

All three calls used built-in image generation in `stylized-concept` mode.

### Community Ledger

> Compact game UI discovery cue of the Community Ledger from Thornvale: a welcoming civic ledger stand with an open cream-paper book, warm carved wood, small brass corner fittings, and one restrained berry-red wax seal. Plain warm ivory paper field; premium hand-painted storybook object illustration; clean readable silhouette; subtle paper grain; cozy cottage-core with adult collector polish; centered front three-quarter view with generous even padding. Soft warm daylight. Cream, walnut, muted berry, aged brass, and tiny moss accents. One isolated object only; no character, legible writing, typography, logo, watermark, border, cast shadow, childish clip art, photorealism, neon color, horror imagery, clutter, or extra props.

### Forest-edge camp

> Compact game UI discovery cue of Thornvale's forest-edge camp: a small cream canvas shelter and cot beside a tidy stone fire ring and one modest seed-bed marker. Plain warm ivory paper field; premium hand-painted storybook landmark illustration; clean readable silhouette; subtle paper grain; cozy cottage-core with adult collector polish; one compact landmark cluster centered in a front three-quarter view with generous even padding. Soft late-afternoon warmth. Cream canvas, walnut poles, muted moss, warm ember, and a dusty berry accent. No people, characters, text, logo, watermark, border, dramatic background scene, cast shadow, childish clip art, branded camping gear, photorealism, neon color, horror imagery, or clutter.

### Town Bell

> Compact game UI discovery cue of Thornvale's Town Bell: a single aged brass bell hanging from a small warm timber arch with one simple clover-colored ribbon tied near the beam. Plain warm ivory paper field; premium hand-painted storybook object illustration; clean readable silhouette; subtle paper grain; cozy civic craftsmanship with adult collector polish; centered front three-quarter view with generous even padding. Soft dusk-gold light, welcoming with one quiet note of ritual. Aged brass, walnut timber, muted clover green, cream highlights, and a tiny berry accent. One isolated bell landmark only; no character, text, logo, watermark, border, cast shadow, childish clip art, church iconography, photorealism, neon color, gore, generic darkness, or clutter.

## Rebuild and transform

- Canonical source of truth: the three source PNGs above
- Toolchain: Node.js 22.22.3; FFmpeg 8.1 with `libsvtav1`
- Generator version and seed: built-in image generator version and seed were not exposed
- Transform: center-fit each square source to 128×128, Lanczos downsample, YUV 4:2:0, single-frame AV1 at CRF 42 and preset 8, strip metadata, wrap as AVIF
- Exact command:

  ```bash
  node scripts/build-key-object-cues-v1.mjs
  node scripts/build-key-object-cues-v1.mjs --verify
  ```

- Expected outputs: `public/ui/key-object-cues/v1/*.avif`
- Clean validation: the script verifies AV1 codec, 128×128 dimensions, a 4 KiB per-file cap, hashes, and source hashes
