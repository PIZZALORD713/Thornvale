# Key Object Cues v1 runtime provenance

## Permission status

- Manifest family ID: `thornvale-key-object-cues-v1`
- Creator: Thornvale project using built-in OpenAI image generation
- Authorization or license: generated specifically for integrated Thornvale use without external image inputs; default project terms apply; see `NOTICE.md`
- Release blocked: no
- Raw-source redistribution: not offered as a standalone art pack

## Runtime contract

| Runtime file | Source input | Transform | Bytes | SHA-256 |
| --- | --- | --- | ---: | --- |
| `public/ui/key-object-cues/v1/community-ledger.avif` | `community-ledger-source.png` | 128×128 AVIF, AV1 CRF 42 | 1,229 | `6265b754ffda9a796c0e687a253a0846e091724ca03884c5ed817bbb40476a50` |
| `public/ui/key-object-cues/v1/forest-edge-camp.avif` | `forest-edge-camp-source.png` | 128×128 AVIF, AV1 CRF 42 | 1,500 | `061e3e8790570545cbf07f108bf9a27776df3fa1b4f344cb03fcd8cf240fb666` |
| `public/ui/key-object-cues/v1/town-bell.avif` | `town-bell-source.png` | 128×128 AVIF, AV1 CRF 42 | 1,592 | `cee19defffcd01efe9c9e70c87a0d52ce9a835d196f25e4196a589fb1eb52966` |

- Runtime URL prefix: `/ui/key-object-cues/v1/`
- Format: single-frame AVIF containing 8-bit AV1, 128×128 pixels
- Loader and placement owner: declarative cue data in `src/content/key-object-cues-v1.js`; projection in `src/ui/StoryUI.js`
- Default and fallback: cues are decorative reinforcement. Missing or undecodable files leave the objective/dialogue text intact and cannot block story progression.
- Known constraint: the first family covers the Community Ledger, forest-edge camp, and Town Bell only; it is not a general inventory atlas.

## Verification

- Deterministic validation: `node scripts/build-key-object-cues-v1.mjs --verify`, `tests/key-object-cues-assets.test.js`, and the asset manifest audit
- Browser routes and modes: clean Core Hook route at desktop, short landscape, and phone portrait; day/night; reduced motion; missing-image fallback
- Runtime payload: 4,321 bytes across three files
