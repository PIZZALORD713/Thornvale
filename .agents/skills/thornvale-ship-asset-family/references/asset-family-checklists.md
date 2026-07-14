# Asset-family checklists

Load only the section for the media being changed. Apply the core workflow in `SKILL.md` to every family.

## Models and Blender sources

- Identify every external mesh, texture, font, HDRI, scan, add-on output, and reference used in the source. Call a model project-authored only when those inputs are accounted for.
- Prefer a deterministic generator for procedural ThornVale kits. Record Blender version, generator version, seed, command, and whether the script or `.blend` is canonical.
- Use meters. Document Blender Z-up, glTF Y-up, authored front, runtime front, origins, root transforms, and any intentional staging offsets.
- Preserve stable named top-level roots and runtime pivots. Keep gameplay placement and colliders in code.
- Bake or consolidate transforms intentionally. Merge by material only when root identity, skinning, morphs, and required pivots survive.
- Record nodes, meshes/primitives, vertices or triangles, materials, images, textures, skins, morphs, animations, and file bytes.
- Validate through clean glTF re-import. Test exact root and pivot names and loader normalization.
- Preserve a procedural or previous-version fallback per optional root.
- Use `assets-src/village-dressing/` and `public/village/pilot/v1/` as the current project-authored pattern.

## Images and textures

- Verify the exact image or source material's permission, not only the host or collection.
- Preserve the original filename, URL, creator, retrieval date, original dimensions, original hash, and color-space assumptions.
- Record crop, cleanup, palette remap, alpha treatment, rebake, mip/compression, and final format.
- Avoid introducing a second material pipeline for a support asset. Prefer a ThornVale-authored palette treatment.
- Declare `dimensions.width` and `dimensions.height` for manifest entries whose kind is `environment-texture`.
- Check the live per-file dimension and byte budgets. Check the full deployment payload, not only the requested image.
- Test day/night readability, high/low quality, transparency edges, color-space correctness, and missing-file fallback.
- Keep reference-only or unknown-license imagery out of `public/`; use a text tombstone when historical hashes matter.

## Animation GLBs

- Apply ADR 0005's standing Thornvale-owner authorization to all current and
  future animation sources and derivatives the owner controls or may lawfully
  use inside Thornvale. Do not request another owner approval per file, clip,
  pack, rig, role, context, transform, delivery method, or revision.
- Verify upstream rights to the exact animation source and any embedded
  performance, character, mesh, material, texture, audio, or repository content
  separately. The standing authorization does not replace or broaden them.
- Pin the source repository commit or exact source URL and record original and derivative hashes.
- Remove redundant geometry, materials, and textures only through a documented transform. Do not silently alter the canonical skeleton.
- Record skeleton, root bone, clip name, duration, sample rate, loop policy, root-motion policy, and frame-zero pose assumptions.
- Test binding against the actual local character skeleton, selection and transition behavior, missing-clip fallback, and reduced-motion behavior.
- Keep animation-only derivatives free of unnecessary token geometry and textures.
- Use `public/animations/PROVENANCE.md` as the current derivative record pattern,
  but reference ADR 0005 instead of creating a new exact-file owner grant. Keep
  the exact upstream source/license record and raw-source restriction.
- Keep animation provenance separate from canonical fRiENDSiES provenance under
  ADR 0004. Raw-source redistribution, standalone animation packs, sublicensing,
  and outside-Thornvale use remain excluded.

## Audio

- Verify recording, performance, composition, and sample-library rights as applicable. Do not treat “royalty-free” as a complete license record.
- Record exact item page and direct download URL, creator, license evidence, retrieval date, original format, duration, channels, sample rate, bit depth, and source hash.
- Record edits such as trim, denoise, pitch, layering, loop points, fades, loudness normalization, resampling, and compression.
- Prefer local, pre-rendered runtime files. Do not add a startup-blocking audio service or network dependency.
- Set manifest kind to `audio` so the aggregate compressed-audio budget is enforced. Read the live budget before export.
- Test browser audio unlock, loop seams, gain and ducking, day/night transitions, missing-file fallback, reduced-sensory settings when present, and disposal.
- Confirm that audio failure cannot prevent startup, interaction, or an ending.

## CC0 and public-domain intake

- Verify the exact item is marked CC0 1.0 or carries an accepted public-domain dedication. Capture the item page, creator, license text or durable evidence, and retrieval date.
- Do not infer item rights from a site's general open-access program, a pack description, search filters, or another item in the collection.
- Record the direct downloaded file, original filename and hash, and whether raw-source redistribution is allowed.
- Keep the source unchanged in the intake record when practical; derive a separately named ThornVale runtime output.
- Recolor, simplify, merge, crop, or bake support material into ThornVale's art language and record every transform.
- Use CC0 material as a supporting ingredient. Keep hero silhouettes and final authored treatment consistent with ThornVale.
- Mark a family release-approved only after the evidence is complete and the live audit accepts its status.
- Check both the aggregate CC0 runtime budget and the relevant type-specific budget.

## fRiENDSiES characters and Trait Echoes

- Use the standing `friendsies-project` authorization in ADR 0004 for canonical
  fRiENDSiES assets and metadata. Do not reopen permission review for a new
  token, trait, role, context, transform, delivery method, or canonical catalog
  revision.
- Identify the token number, exact trait name, canonical metadata record, canonical source filename or URL, and hashes.
- Keep the curated cast local and bounded. Do not fetch the full collection index to resolve a known local character.
- Record whether the binary is unchanged, transformed, animation-only, or reused in memory as an environmental arrangement.
- Treat catalog pins, allowed origins, exact selected-file URLs, hashes,
  transforms, budgets, and fallbacks as source-integrity and engineering gates,
  not repeated permission gates.
- Keep proposed traits without a ready design and technical contract in data-only
  backlog entries. Give them no runtime URL and assert that no request occurs.
- For environmental Trait Echoes, record source token and trait, placement count, story meaning, instancing strategy, displayed geometry, new runtime bytes, and reduced-motion projection.
- Preserve `?traits=off` as rollback and test it independently with each `?assets` mode.
- Verify story-state projection without changing authoritative state, saves, interactions, or endings.
- Do not use this authorization for standalone asset or character packs, bulk
  raw collection mirroring or dumps, sublicensing, raw-source redistribution as
  a separate product, or reuse outside ThornVale.
- Keep animation families on their separate Mixamo, repository, or other
  upstream provenance contracts. They inherit owner authorization from ADR 0005,
  not canonical fRiENDSiES provenance from ADR 0004.
- Use `public/friendsies/8914/PROVENANCE.md`, `src/content/friendsies-cast.js`, and the Trait Echo QA record as current patterns.
