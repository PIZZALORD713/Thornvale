"""Create a disposable interactive ThornVale staging .blend."""

from __future__ import annotations

import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
sys.path.insert(0, str(ROOT / "blender_addon"))

from pizza_lab.core import execute, load_adapter  # noqa: E402


def main() -> int:
    output = REPO_ROOT / "output" / "pizza-lab" / "thornvale-town-stage.blend"
    output.parent.mkdir(parents=True, exist_ok=True)
    adapter = load_adapter(ROOT / "adapters" / "thornvale.json")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    execute("stage.load", {"replace": True}, adapter)
    bpy.context.scene["pizza_lab_adapter"] = "thornvale"
    bpy.context.scene["pizza_lab_stage_version"] = 1
    bpy.ops.wm.save_as_mainfile(filepath=str(output))
    print(f"PIZZA_LAB_STAGE={output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
