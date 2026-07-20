"""Factory-scene acceptance test for the shared Pizza Lab command core."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "blender_addon"))

from pizza_lab.core import _blender_to_runtime, execute, load_adapter  # noqa: E402


def main() -> int:
    adapter = load_adapter(ROOT / "adapters" / "thornvale.json")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_cube_add(location=(1.0, 2.0, 3.0))
    cube = bpy.context.active_object
    cube.name = "PizzaLabFixture"
    cube["pizza_lab_game_id"] = "fixture-prop"
    cube["pizza_lab_role"] = "visual"
    cube["pizza_lab_editable"] = True

    inspected = execute("scene.inspect", {}, adapter)
    assert inspected["result"]["objects"][0]["gameId"] == "fixture-prop"

    preview = execute("object.transform", {
        "gameId": "fixture-prop", "location": [4, 5, 6], "apply": False,
    }, adapter)
    assert preview["result"]["applied"] is False
    assert list(cube.location) == [1.0, 2.0, 3.0]

    applied = execute("object.transform", {
        "gameId": "fixture-prop", "location": [4, 5, 6], "apply": True,
    }, adapter)
    assert list(cube.location) == [4.0, 5.0, 6.0]
    undone = execute("transaction.undo", {"undoToken": applied["result"]["undoToken"]}, adapter)
    assert undone["result"]["undone"] is True
    assert list(cube.location) == [1.0, 2.0, 3.0]

    validation = execute("scene.validate", {}, adapter)
    assert validation["result"]["valid"] is True
    assert execute("terrain.contract", {}, adapter)["result"]["mode"] == "preview-only"

    stage = execute("stage.load", {"replace": True}, adapter)
    assert len(stage["result"]["objects"]) == 3
    staged_wayfinder = next(
        obj for obj in bpy.context.scene.objects
        if obj.get("pizza_lab_game_id") == "thornvale.authoredProps.wayfinder"
    )
    assert all(
        abs(actual - expected) < 1e-6
        for actual, expected in zip(staged_wayfinder.location, [0.0, 6.4, 0.0])
    ), list(staged_wayfinder.location)
    staged_wayfinder.location = [2.5, 8.0, 0.0]
    staged_wayfinder.rotation_euler.z = 0.5
    assert _blender_to_runtime(staged_wayfinder) == {
        "x": 2.5, "y": 0.0, "z": -8.0, "rotationY": 0.5,
    }
    staged_wayfinder.location = [0.0, 6.4, 0.0]
    staged_wayfinder.rotation_euler.z = 0.0
    published = execute("stage.publish", {}, adapter)
    assert published["result"]["published"] is True
    print("PIZZA_LAB_VERIFY=passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
