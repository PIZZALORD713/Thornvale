"""Shared command core for interactive and headless Pizza Lab sessions."""

from __future__ import annotations

import base64
import json
import math
from pathlib import Path
from typing import Any

import bpy


VERSION = "0.1.0"
GAME_ID = "pizza_lab_game_id"
ROLE = "pizza_lab_role"


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
        "message": "Pizza Lab does not publish arbitrary terrain meshes in v0.1.",
    }


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


COMMANDS = {
    "scene.inspect": inspect_scene,
    "scene.validate": validate_scene,
    "object.transform": transform_object,
    "transaction.undo": undo_transform,
    "terrain.contract": terrain_contract,
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
