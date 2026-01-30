# System — Neighborliness

## Purpose

Track how “in sync” the player is with town expectations.

## What it affects (eventually)

* Access to areas
* NPC tone and help
* Frequency/intensity of scrutiny
* Nighttime interventions

## MVP Implementation (Phase 1)

* A single number `neighborliness` (0–100)
* A few triggers:

  * Completing a task: +
  * Breaking a rule (later): -
* Display only in debug HUD
