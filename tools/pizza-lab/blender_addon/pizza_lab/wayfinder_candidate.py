"""Collect the bounded Wayfinder authoring delta and export it durably."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

import bpy

from .core import EDITABLE, GAME_ID, PizzaLabError


ROOT_GAME_ID = "thornvale.authoredProps.wayfinder"
BOARD_GAME_IDS = (
    "thornvale.asset.village-wayfinder.board.01",
    "thornvale.asset.village-wayfinder.board.02",
    "thornvale.asset.village-wayfinder.board.03",
)


def _one_object(game_id: str) -> bpy.types.Object:
    matches = [
        obj for obj in bpy.context.scene.objects
        if str(obj.get(GAME_ID) or "") == game_id
    ]
    if len(matches) != 1:
        raise PizzaLabError(f"Expected one scene object with game id {game_id!r}, found {len(matches)}")
    return matches[0]


def _vector(value) -> list[float]:
    return [float(item) for item in value]


def _transform(obj: bpy.types.Object) -> dict[str, list[float]]:
    if obj.rotation_mode in {"QUATERNION", "AXIS_ANGLE"}:
        raise PizzaLabError(f"Wayfinder board {obj.name!r} must use Euler rotation")
    return {
        "location": _vector(obj.location),
        "rotationEuler": _vector(obj.rotation_euler),
        "scale": _vector(obj.scale),
    }


def _collect_overrides() -> dict[str, Any]:
    root = _one_object(ROOT_GAME_ID)
    if root.name != "VillageWayfinder" or root.get(EDITABLE) is not True:
        raise PizzaLabError("The editable VillageWayfinder root is not active")

    allowed_editable = {ROOT_GAME_ID, *BOARD_GAME_IDS}
    wayfinder_objects = {root, *root.children_recursive}
    unexpected = sorted(
        str(obj.get(GAME_ID) or obj.name)
        for obj in wayfinder_objects
        if obj.get(EDITABLE) is True
        and str(obj.get(GAME_ID) or "") not in allowed_editable
    )
    if unexpected:
        raise PizzaLabError(f"Unexpected editable Wayfinder components: {unexpected}")

    boards = {}
    for index, game_id in enumerate(BOARD_GAME_IDS, start=1):
        obj = _one_object(game_id)
        if obj not in wayfinder_objects or obj.parent != root:
            raise PizzaLabError(f"Wayfinder board {game_id!r} left its reviewed assembly hierarchy")
        if obj.type != "EMPTY" or obj.get(EDITABLE) is not True:
            raise PizzaLabError(f"Wayfinder board {game_id!r} is not an editable assembly")
        boards[f"{index:02d}"] = {
            "before": {
                "location": _vector(obj.get("pizza_lab_baseline_location") or []),
                "rotationEuler": _vector(obj.get("pizza_lab_baseline_rotation_euler") or []),
                "scale": _vector(obj.get("pizza_lab_baseline_scale") or []),
            },
            "after": _transform(obj),
        }
    return {
        "schemaVersion": 1,
        "id": "thornvale-wayfinder-board-overrides-v1",
        "boards": boards,
    }


def export_wayfinder_candidate(adapter: dict[str, Any]) -> dict[str, Any]:
    project_root = Path(adapter.get("_projectRoot") or ".").resolve()
    exporter = (project_root / "tools/pizza-lab/export_wayfinder_candidate.py").resolve()
    expected_exporter = project_root / "tools/pizza-lab/export_wayfinder_candidate.py"
    if exporter != expected_exporter.resolve() or not exporter.is_file():
        raise PizzaLabError("Wayfinder candidate exporter is not allowlisted")

    output_dir = project_root / "output/pizza-lab/wayfinder-v1"
    output_dir.mkdir(parents=True, exist_ok=True)
    overrides_path = output_dir / f"board-overrides-{os.getpid()}.json"
    candidate_path = output_dir / "candidate.json"
    overrides_path.write_text(
        json.dumps(_collect_overrides(), indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    try:
        completed = subprocess.run(
            [
                bpy.app.binary_path,
                "--background",
                "--factory-startup",
                "--python-exit-code",
                "1",
                "--python",
                str(exporter),
                "--",
                "--overrides",
                str(overrides_path),
            ],
            cwd=project_root,
            check=False,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if completed.returncode != 0:
            detail = "\n".join(
                line for line in (completed.stdout + "\n" + completed.stderr).splitlines()
                if "Error" in line or "RuntimeError" in line or "Traceback" in line
            )[-3000:]
            raise PizzaLabError(f"Wayfinder candidate export failed: {detail or 'Blender exited unsuccessfully'}")
        try:
            candidate = json.loads(candidate_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise PizzaLabError(f"Wayfinder exporter produced no valid candidate record: {exc}") from exc
    finally:
        overrides_path.unlink(missing_ok=True)
    return {
        "exported": True,
        "candidate": str(candidate_path),
        "glb": str(project_root / candidate["candidate"]["path"]),
        "sha256": candidate["candidate"]["sha256"],
        "metrics": candidate["candidate"],
        "boardOverrides": candidate["boardOverrides"],
    }
