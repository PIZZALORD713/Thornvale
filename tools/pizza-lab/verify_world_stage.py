"""Semantic acceptance for a saved and reopened ThornVale World Stage."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
sys.path.insert(0, str(ROOT / "blender_addon"))

from pizza_lab.core import PizzaLabError, execute, load_adapter  # noqa: E402


def main() -> int:
    input_path = REPO_ROOT / "output" / "pizza-lab" / "world-stage-v1.input.json"
    data = json.loads(input_path.read_text(encoding="utf-8"))
    adapter = load_adapter(ROOT / "adapters" / "thornvale.json")

    assert bpy.data.filepath.endswith("thornvale-world-stage-v1.blend")
    assert bpy.context.scene["pizza_lab_stage_id"] == "thornvale-world-stage-v1"
    assert bpy.context.scene["pizza_lab_layout_sha256"] == data["authority"]["layoutSha256"]
    assert bpy.data.collections.get("PIZZA_LAB_WORLD_STAGE") is not None
    for collection in (
        "PL_ASSETS_EDITABLE",
        "PL_ASSETS_CONTEXT",
        "PL_TERRAIN_CONTEXT",
        "PL_PATH_CONTEXT",
        "PL_CONTRACT_PROXIES",
        "PL_GUIDES",
    ):
        assert bpy.data.collections.get(collection) is not None, collection

    validation = execute("scene.validate", {}, adapter)["result"]
    assert validation["valid"], validation["errors"]
    editable = [obj for obj in bpy.context.scene.objects if obj.get("pizza_lab_editable") is True]
    assert [obj.get("pizza_lab_game_id") for obj in editable] == ["thornvale.authoredProps.wayfinder"]

    wayfinder = editable[0]
    assert all(abs(actual - expected) < 1e-6 for actual, expected in zip(wayfinder.location, [0, 6.4, 0]))
    preview = execute("object.transform", {
        "gameId": "thornvale.authoredProps.wayfinder",
        "location": [1.25, 7.2, 0],
        "apply": False,
    }, adapter)["result"]
    assert preview["applied"] is False
    assert all(abs(actual - expected) < 1e-6 for actual, expected in zip(wayfinder.location, [0, 6.4, 0]))
    published = execute("stage.publish", {}, adapter)["result"]
    assert published["published"] is True
    assert [change["id"] for change in published["changes"]] == ["wayfinder"]
    assert published["changes"][0]["before"] == published["changes"][0]["after"]

    locked_id = "thornvale.landmarks.ledger.visual"
    try:
        execute("object.transform", {"gameId": locked_id, "apply": False}, adapter)
    except PizzaLabError as exc:
        assert "locked" in str(exc)
    else:
        raise AssertionError("Locked World Stage context accepted a transform")

    hill = next(obj for obj in bpy.context.scene.objects if obj.get("pizza_lab_game_id") == "terrain.bell-hill")
    assert len(hill.data.vertices) == len(data["terrain"]["bellHill"]["vertices"]) // 3
    assert len(hill.data.polygons) == len(data["terrain"]["bellHill"]["indices"]) // 3
    path_ids = {
        obj.get("pizza_lab_game_id") for obj in bpy.context.scene.objects
        if str(obj.get("pizza_lab_game_id") or "").startswith("path.")
        and not str(obj.get("pizza_lab_game_id")).startswith("path-apron.")
    }
    assert path_ids == {f"path.{route['id']}" for route in data["paths"]}
    print(
        "PIZZA_LAB_WORLD_VERIFY=passed "
        f"objects={validation['objectCount']} paths={len(path_ids)} "
        f"hill_vertices={len(hill.data.vertices)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
