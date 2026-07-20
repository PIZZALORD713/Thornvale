"""Create and save the disposable full ThornVale Pizza Lab World Stage."""

from __future__ import annotations

import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
sys.path.insert(0, str(ROOT / "blender_addon"))

from pizza_lab.world_stage import build_world_stage  # noqa: E402


def main() -> int:
    input_path = REPO_ROOT / "output" / "pizza-lab" / "world-stage-v1.input.json"
    output = REPO_ROOT / "output" / "pizza-lab" / "thornvale-world-stage-v1.blend"
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    result = build_world_stage(input_path, REPO_ROOT, replace=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    print(f"PIZZA_LAB_WORLD_STAGE={output}")
    print(f"PIZZA_LAB_WORLD_STAGE_COUNTS={result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
