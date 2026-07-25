---
schema: thornvale.qa-note/v1
subject: "friend:6602"
status: passed
baseline_commit: 98c5b8b3ce6906cfa5630369eefb08d2503e133c
tags:
  - thornvale/qa
  - thornvale/character
  - friendsies
  - story-authoring
---

# Friend 6602 Story Workshop — 2026-07-24

## Scope

Standalone Story Archive verification for selectable canonical traits, isolated
3D inspection, local Obsidian Markdown editing, and display-density recovery.
The editor writes only an explicitly selected local card after an explicit Save.
It does not write game state, the deployed repository, or the shared URL.

## Automated gates

- Focused archive and authoring tests: 14/14 passed.
- Full repository suite: 378/378 passed.
- Standalone Story Archive Vite build: passed.
- Main production Vite build: passed.
- Distribution asset audit and release audit: passed.
- Production distribution: 10,035,006 / 10,066,330 bytes.
- `git diff --check`: passed.

## Desktop Chromium

Route:
`/story-archive/Preview/?id=friend%3A6602&mode=play`

- All seven canonical trait controls exposed their exact value, runtime asset,
  binding description, and provenance path.
- Backpiece, Body, Face, Hand, Head, Shoe, and Sprout each rendered alone with
  automatic camera fitting. Face intentionally rendered the Romeo overlay on
  its Deli head substrate.
- Full Friend restored the complete assembly at 8 render calls and 13,030
  rendered triangles for the character-plus-ground frame.
- The supported route produced no console or WebGL warnings.

## Display-density regression

Chrome DevTools emulation changed one loaded tab from DPR 1 to DPR 2 and back
without a reload:

- DPR 1: CSS 745.625 × 592, buffer 746 × 592.
- DPR 2: CSS 745.625 × 592, buffer 1492 × 1184.
- DPR 1 restored: buffer 746 × 592.

The runtime diagnostic pixel ratio followed 1 → 2 → 1 and the console remained
clean.

## Obsidian editor

- The browser adapter rejected protected fields and only exposed the eight
  authored story sections from Story identity through Consequences.
- A disposable in-memory file handle verified explicit Choose, dirty-field-only
  Save, `{ mode: "exclusive" }`, full-document write, close, and post-write
  read-back.
- The first save updated Story identity and multi-line Relationships while
  preserving exact frontmatter and `trait_body: Pop`.
- A second save preserved a non-overlapping external writer note.
- A divergent external Open want edit was rejected before a third write.
- Unit coverage also verifies CRLF preservation, empty authoring slots,
  same-field conflict detection, wrong-card rejection, heading injection
  rejection, NUL rejection, and the 12,000-character field boundary.

The OS-native picker itself was not automated; Playwright cannot safely choose
a real user vault file without leaving the browser boundary. Direct saving
therefore remains a desktop Chrome/Edge, HTTPS-or-localhost interaction gate.

## Responsive and fallback behavior

- 390 × 844 portrait and 844 × 390 landscape retained the trait workshop below
  the full-height preview without horizontal overflow.
- With `showOpenFilePicker` unavailable, all seven trait controls continued to
  work while Choose and Save disabled with a clear desktop-browser requirement.

## Boundaries

- Saving updates only the selected local Markdown file. A normal commit and
  redeploy are still required to refresh the shared Story Archive link.
- The editor re-reads immediately before Save and blocks divergent same-field
  changes, but an external application can still race after that final read.
- Touch remains an emulated input pilot; no physical-phone performance or full
  mobile-support claim is made.
