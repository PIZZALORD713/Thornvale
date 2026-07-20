# ADR 0009: Production dist budget headroom

- Status: Accepted
- Date: 2026-07-20

## Context

The original 8 MiB production-dist cap was set for the opening-route asset
pilot after dormant public files were removed. Integrating the release-ready
object-cue work with Pizza Lab Wayfinder v1.1 produces an 8,416,553-byte build,
27,945 bytes above that cap, while all family-specific GLB, character, source,
texture, audio, provenance, and fallback gates remain satisfied.

Treating a cap with no working headroom as immutable would force unrelated
visual-quality or provenance regressions for tiny additions. Removing declared
runtime assets or provenance records is not an acceptable way to make the audit
green.

## Decision

Increase only `policy.budgets.distMaxBytes` in
`assets-src/asset-manifest.json` by 20%, from 8,388,608 to 10,066,330 bytes. The
integer is the ceiling of 8 MiB multiplied by 1.2, so the enforced limit is not
less than the approved increase. Keep every family-specific and source-intake
budget unchanged.

Continue to build before measuring the complete deployment. Production-only
minification may reclaim bytes only when checked-in sources remain unchanged and
decode or runtime equivalence is covered by tests and browser evidence.

## Consequences

- The combined mainline build gains about 1.65 MiB of measured headroom.
- Future assets still need their own payload, geometry, provenance, fallback,
  browser, and release gates; this is not blanket approval to fill the cap.
- A later increase requires another explicit policy decision backed by measured
  release content rather than silently weakening the audit.
