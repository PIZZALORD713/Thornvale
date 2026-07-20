"""Shared command core for interactive and headless Pizza Lab sessions."""

from __future__ import annotations

import base64
import hashlib
import json
import math
import os
from pathlib import Path
from typing import Any

import bpy


VERSION = "0.4.0"
GAME_ID = "pizza_lab_game_id"
ROLE = "pizza_lab_role"
STAGE_COLLECTION = "PIZZA_LAB_STAGE"
EDITABLE = "pizza_lab_editable"


class PizzaLabError(RuntimeError):
    pass


def _vector(value: Any, label: str, size: int = 3) -> list[float]:
    if not isinstance(value, list) or len(value) != size:
        raise PizzaLabError(f"{label} must contain exactly {size} numbers")
    result = [float(item) for item in value]
    if not all(math.isfinite(item) for item in result):
        raise PizzaLabError(f"{label} contains a non-finite value")
    return result


def _object_id(obj: bpy.types.Object) -> str:
    return str(obj.get(GAME_ID) or obj.name)


def _find_object(game_id: str) -> bpy.types.Object:
    matches = [obj for obj in bpy.context.scene.objects if str(obj.get(GAME_ID) or "") == game_id]
    if not matches:
        raise PizzaLabError(f"No scene object has game id {game_id!r}")
    if len(matches) > 1:
        raise PizzaLabError(f"Game id {game_id!r} is not unique")
    return matches[0]


def _transform(obj: bpy.types.Object) -> dict[str, list[float]]:
    return {
        "location": list(obj.location),
        "rotationEuler": list(obj.rotation_euler),
        "scale": list(obj.scale),
    }


def _object_summary(obj: bpy.types.Object) -> dict[str, Any]:
    return {
        "gameId": _object_id(obj),
        "name": obj.name,
        "type": obj.type,
        "role": str(obj.get(ROLE) or "unspecified"),
        "editable": bool(obj.get(EDITABLE, False)),
        "transform": _transform(obj),
        "parent": _object_id(obj.parent) if obj.parent else None,
        "hidden": bool(obj.hide_get()),
    }


def _encode_undo(game_id: str, before: dict[str, Any]) -> str:
    raw = json.dumps({"version": 1, "gameId": game_id, "before": before}, separators=(",", ":"))
    return base64.urlsafe_b64encode(raw.encode("utf-8")).decode("ascii")


def _decode_undo(token: str) -> dict[str, Any]:
    try:
        payload = json.loads(base64.urlsafe_b64decode(token.encode("ascii")).decode("utf-8"))
    except (ValueError, UnicodeError, json.JSONDecodeError) as exc:
        raise PizzaLabError("Invalid undo token") from exc
    if (
        payload.get("version") != 1
        or not isinstance(payload.get("gameId"), str)
        or not payload["gameId"]
        or not isinstance(payload.get("before"), dict)
    ):
        raise PizzaLabError("Unsupported undo token")
    for key in ("location", "rotationEuler", "scale"):
        _vector(payload["before"].get(key), f"undo {key}")
    return payload


def inspect_scene(_: dict[str, Any], adapter: dict[str, Any]) -> dict[str, Any]:
    objects = sorted((_object_summary(obj) for obj in bpy.context.scene.objects), key=lambda item: item["gameId"])
    return {
        "pizzaLabVersion": VERSION,
        "scene": bpy.context.scene.name,
        "blendFile": bpy.data.filepath or None,
        "adapter": adapter.get("id"),
        "objects": objects,
    }


def transform_object(payload: dict[str, Any], _: dict[str, Any]) -> dict[str, Any]:
    game_id = str(payload.get("gameId") or "").strip()
    if not game_id:
        raise PizzaLabError("gameId is required")
    obj = _find_object(game_id)
    if obj.get(EDITABLE) is not True:
        raise PizzaLabError(f"Object {game_id!r} is locked by the active Pizza Lab publish policy")
    if obj.rotation_mode in {"QUATERNION", "AXIS_ANGLE"}:
        raise PizzaLabError(f"Object {game_id!r} must use an Euler rotation mode")
    before = _transform(obj)
    after = {
        "location": _vector(payload.get("location", before["location"]), "location"),
        "rotationEuler": _vector(payload.get("rotationEuler", before["rotationEuler"]), "rotationEuler"),
        "scale": _vector(payload.get("scale", before["scale"]), "scale"),
    }
    if any(abs(value) < 1e-7 for value in after["scale"]):
        raise PizzaLabError("scale values cannot be zero")

    applied = bool(payload.get("apply", False))
    if applied:
        obj.location = after["location"]
        obj.rotation_euler = after["rotationEuler"]
        obj.scale = after["scale"]
        bpy.context.view_layer.update()
    return {
        "gameId": game_id,
        "applied": applied,
        "before": before,
        "after": after,
        "undoToken": _encode_undo(game_id, before) if applied else None,
    }


def undo_transform(payload: dict[str, Any], _: dict[str, Any]) -> dict[str, Any]:
    decoded = _decode_undo(str(payload.get("undoToken") or ""))
    obj = _find_object(str(decoded["gameId"]))
    if obj.get(EDITABLE) is not True:
        raise PizzaLabError(f"Object {decoded['gameId']!r} is locked by the active Pizza Lab publish policy")
    current = _transform(obj)
    before = decoded["before"]
    obj.location = _vector(before.get("location"), "undo location")
    obj.rotation_euler = _vector(before.get("rotationEuler"), "undo rotationEuler")
    obj.scale = _vector(before.get("scale"), "undo scale")
    bpy.context.view_layer.update()
    return {"gameId": decoded["gameId"], "undone": True, "before": current, "after": _transform(obj)}


def validate_scene(_: dict[str, Any], adapter: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    seen: dict[str, str] = {}
    for obj in bpy.context.scene.objects:
        game_id = _object_id(obj)
        if game_id in seen:
            errors.append(f"Duplicate game id {game_id!r}: {seen[game_id]!r}, {obj.name!r}")
        seen[game_id] = obj.name
        if any(not math.isfinite(value) for value in (*obj.location, *obj.rotation_euler, *obj.scale)):
            errors.append(f"{game_id!r} has a non-finite transform")
        if any(abs(value) < 1e-7 for value in obj.scale):
            errors.append(f"{game_id!r} has a zero scale axis")
        if not obj.get(GAME_ID):
            warnings.append(f"{obj.name!r} has no stable {GAME_ID} property")

    required = adapter.get("requiredExportRoots", [])
    names = {obj.name for obj in bpy.context.scene.objects}
    for name in required:
        if name not in names:
            errors.append(f"Required export root {name!r} is missing")
    return {"valid": not errors, "errors": errors, "warnings": warnings, "objectCount": len(seen)}


def terrain_contract(_: dict[str, Any], adapter: dict[str, Any]) -> dict[str, Any]:
    terrain = adapter.get("terrain", {})
    return {
        "mode": "preview-only",
        "authority": terrain.get("authority"),
        "source": terrain.get("source"),
        "message": "World Stage renders the shared terrain contract but does not publish arbitrary terrain meshes in v0.3.",
    }


def _runtime_to_blender(placement: dict[str, Any]) -> tuple[list[float], float]:
    x = float(placement["x"])
    y = float(placement["y"])
    z = float(placement["z"])
    yaw = float(placement.get("rotationY", 0))
    if not all(math.isfinite(value) for value in (x, y, z, yaw)):
        raise PizzaLabError("Stage placement contains a non-finite value")
    return [x, -z, y], yaw


def _blender_to_runtime(obj: bpy.types.Object) -> dict[str, float]:
    if obj.rotation_mode in {"QUATERNION", "AXIS_ANGLE"}:
        raise PizzaLabError(f"Staged object {_object_id(obj)!r} must use an Euler rotation mode")
    if abs(obj.rotation_euler.x) > 1e-6 or abs(obj.rotation_euler.y) > 1e-6:
        raise PizzaLabError(f"Staged object {_object_id(obj)!r} cannot be tilted")
    scale = list(obj.scale)
    if any(value <= 0 for value in scale) or max(scale) - min(scale) > 1e-6 or abs(scale[0] - 1) > 1e-6:
        raise PizzaLabError(f"Staged object {_object_id(obj)!r} must retain unit scale")

    def clean(value: float) -> float:
        rounded = round(float(value), 6)
        return 0.0 if rounded == 0 else rounded

    return {
        "x": clean(obj.location.x),
        "y": clean(obj.location.z),
        "z": clean(-obj.location.y),
        "rotationY": clean(obj.rotation_euler.z),
    }


def _stage_config(adapter: dict[str, Any]) -> tuple[Path, Path, dict[str, Any]]:
    config = adapter.get("staging") or {}
    project_root = Path(adapter.get("_projectRoot") or ".").resolve()
    manifest = (project_root / str(config.get("manifest") or "")).resolve()
    source = (project_root / str(config.get("sourceAsset") or "")).resolve()
    if manifest != (project_root / "assets-src/pizza-lab/staging/thornvale-town-v1.json").resolve():
        raise PizzaLabError("Adapter staging manifest is not allowlisted")
    if source != (project_root / "public/village/thornvale-village-dressing.glb").resolve():
        raise PizzaLabError("Adapter staging source is not allowlisted")
    try:
        data = json.loads(manifest.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PizzaLabError(f"Unable to read staging manifest: {exc}") from exc
    expected_hash = str(data.get("source", {}).get("sha256") or "")
    actual_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    if actual_hash != expected_hash:
        raise PizzaLabError("Staging GLB hash does not match the manifest")
    return manifest, source, data


def load_stage(payload: dict[str, Any], adapter: dict[str, Any]) -> dict[str, Any]:
    existing = bpy.data.collections.get(STAGE_COLLECTION)
    if existing and not payload.get("replace", False):
        raise PizzaLabError("Pizza Lab stage already exists; pass replace=true to rebuild it")
    if existing:
        for obj in list(existing.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(existing)

    _, source, manifest = _stage_config(adapter)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    collection = bpy.data.collections.new(STAGE_COLLECTION)
    bpy.context.scene.collection.children.link(collection)
    for obj in imported:
        if collection not in obj.users_collection:
            collection.objects.link(obj)
        for owner in list(obj.users_collection):
            if owner != collection:
                owner.objects.unlink(obj)

    placements = manifest.get("placements") or {}
    staged = []
    for placement_id, placement in sorted(placements.items()):
        asset_name = str(placement.get("asset") or "")
        matches = [obj for obj in imported if obj.name == asset_name]
        if len(matches) != 1:
            raise PizzaLabError(f"Expected one imported root {asset_name!r}, found {len(matches)}")
        root = matches[0]
        location, yaw = _runtime_to_blender(placement)
        root.location = location
        root.rotation_mode = "XYZ"
        root.rotation_euler = [0, 0, yaw]
        root.scale = [1, 1, 1]
        root[GAME_ID] = f"thornvale.authoredProps.{placement_id}"
        root[ROLE] = "staged-placement" if placement.get("editable") else "locked-context"
        root["pizza_lab_asset_root"] = asset_name
        root[EDITABLE] = bool(placement.get("editable"))
        root.hide_select = not bool(placement.get("editable"))
        staged.append({
            "id": placement_id,
            "gameId": root[GAME_ID],
            "asset": asset_name,
            "editable": bool(placement.get("editable")),
            "transform": _transform(root),
        })

    bpy.context.view_layer.update()
    return {"collection": STAGE_COLLECTION, "source": str(source), "objects": staged}


def publish_stage(_: dict[str, Any], adapter: dict[str, Any]) -> dict[str, Any]:
    manifest_path, _, manifest = _stage_config(adapter)
    changes = []
    for placement_id, placement in sorted((manifest.get("placements") or {}).items()):
        if not placement.get("editable"):
            continue
        game_id = f"thornvale.authoredProps.{placement_id}"
        obj = _find_object(game_id)
        if obj.get("pizza_lab_asset_root") != placement.get("asset"):
            raise PizzaLabError(f"Asset root changed for {placement_id!r}")
        runtime = _blender_to_runtime(obj)
        before = {key: placement.get(key, 0) for key in ("x", "y", "z", "rotationY")}
        placement.update(runtime)
        changes.append({"id": placement_id, "before": before, "after": runtime})

    encoded = json.dumps(manifest, indent=2, sort_keys=False) + "\n"
    temporary = manifest_path.with_name(f".{manifest_path.name}.tmp-{os.getpid()}")
    try:
        temporary.write_text(encoded, encoding="utf-8")
        os.replace(temporary, manifest_path)
    finally:
        if temporary.exists():
            temporary.unlink()
    return {"published": True, "candidate": str(manifest_path), "changes": changes}


def save_scene(payload: dict[str, Any], adapter: dict[str, Any]) -> dict[str, Any]:
    requested = Path(str(payload.get("path") or "")).expanduser().resolve()
    if not str(payload.get("path") or "").strip():
        raise PizzaLabError("path is required")
    allowed = [Path(path).expanduser().resolve() for path in adapter.get("allowedWriteRoots", [])]
    if not any(requested == root or root in requested.parents for root in allowed):
        raise PizzaLabError(f"Save path is outside adapter allowedWriteRoots: {requested}")
    requested.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(requested))
    return {"saved": True, "path": str(requested)}


def load_world_stage(payload: dict[str, Any], adapter: dict[str, Any]) -> dict[str, Any]:
    from .world_stage import build_world_stage

    project_root = Path(adapter.get("_projectRoot") or ".").resolve()
    input_path = (project_root / "output/pizza-lab/world-stage-v1.input.json").resolve()
    return build_world_stage(
        input_path,
        project_root,
        replace=bool(payload.get("replace", False)),
    )


def export_wayfinder_candidate(_: dict[str, Any], adapter: dict[str, Any]) -> dict[str, Any]:
    from .wayfinder_candidate import export_wayfinder_candidate as export_candidate

    return export_candidate(adapter)


COMMANDS = {
    "scene.inspect": inspect_scene,
    "scene.validate": validate_scene,
    "object.transform": transform_object,
    "transaction.undo": undo_transform,
    "terrain.contract": terrain_contract,
    "stage.load": load_stage,
    "stage.publish": publish_stage,
    "world-stage.load": load_world_stage,
    "asset.wayfinder-candidate.export": export_wayfinder_candidate,
    "scene.save": save_scene,
}


def load_adapter(path: str | Path) -> dict[str, Any]:
    adapter_path = Path(path).expanduser().resolve()
    adapter = json.loads(adapter_path.read_text(encoding="utf-8"))
    project_root = Path(adapter.get("projectRoot", "."))
    if not project_root.is_absolute():
        project_root = (adapter_path.parent / project_root).resolve()
    adapter["_projectRoot"] = str(project_root)
    adapter["allowedWriteRoots"] = [
        str((project_root / entry).resolve()) if not Path(entry).is_absolute() else str(Path(entry).resolve())
        for entry in adapter.get("allowedWriteRoots", [])
    ]
    return adapter


def execute(command: str, payload: dict[str, Any] | None, adapter: dict[str, Any]) -> dict[str, Any]:
    handler = COMMANDS.get(command)
    if handler is None:
        raise PizzaLabError(f"Unsupported command {command!r}")
    if payload is not None and not isinstance(payload, dict):
        raise PizzaLabError("payload must be an object")
    return {"ok": True, "command": command, "result": handler(payload or {}, adapter)}
