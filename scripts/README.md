# Repository Scripts

Put repeatable development, asset-processing, QA, and release helpers here.
Runtime application code belongs in `src/`; one-off investigation commands do
not need to become permanent scripts.

A committed script should:

- be safe to run from the repository root;
- fail with a non-zero exit code and an actionable message;
- avoid destructive behavior by default;
- document its inputs, outputs, and required external tools;
- produce deterministic output where practical; and
- be invoked from `package.json` when it becomes part of the standard workflow.

Prefer Node ESM for cross-platform repository helpers because this project
already uses `"type": "module"`. Shell scripts are appropriate when they are
small and their platform requirements are explicit.

Asset-processing scripts must retain source attribution and record the transform
in the destination asset family's `PROVENANCE.md`.
