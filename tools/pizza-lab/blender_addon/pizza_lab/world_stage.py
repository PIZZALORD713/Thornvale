"""Build the disposable, full ThornVale World Stage from resolved runtime input."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Iterable

import bpy

from .core import GAME_ID, ROLE, PizzaLabError


WORLD_COLLECTION = "PIZZA_LAB_WORLD_STAGE"
EDITABLE = "pizza_lab_editable"
AUTHORITY = "pizza_lab_authority"
PUBLISH_SET = "pizza_lab_publish_set"


def _runtime_point(value: dict[str, Any] | list[float]) -> tuple[float, float, float]:
    if isinstance(value, dict):
        x, y, z = value["x"], value.get("y", 0), value["z"]
    else:
        x, y, z = value
    return float(x), -float(z), float(y)


def _runtime_size(value: dict[str, Any]) -> tuple[float, float, float]:
    return float(value["x"]), float(value["z"]), float(value["y"])


def _collection(name: str, parent: bpy.types.Collection) -> bpy.types.Collection:
    result = bpy.data.collections.new(name)
    parent.children.link(result)
    return result


def _unlink_collection(collection: bpy.types.Collection) -> None:
    for child in list(collection.children):
        _unlink_collection(child)
    for obj in list(collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(collection)


def _move_to(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    if collection not in obj.users_collection:
        collection.objects.link(obj)
    for owner in list(obj.users_collection):
        if owner != collection:
            owner.objects.unlink(obj)


def _tag(
    obj: bpy.types.Object,
    game_id: str,
    role: str,
    *,
    editable: bool = False,
    authority: str = "runtime-context",
    publish_set: str = "context-v1",
) -> None:
    obj[GAME_ID] = game_id
    obj[ROLE] = role
    obj[EDITABLE] = editable
    obj[AUTHORITY] = authority
    obj[PUBLISH_SET] = publish_set
    obj.hide_select = not editable


def _material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.roughness = 0.78
    return material


def _mesh_object(
    name: str,
    vertices: Iterable[tuple[float, float, float]],
    faces: Iterable[tuple[int, ...]],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(f"{name}.mesh")
    mesh.from_pydata(list(vertices), [], list(faces))
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def _disc(
    name: str,
    x: float,
    y: float,
    z: float,
    radius_x: float,
    radius_z: float,
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    segments: int = 96,
) -> bpy.types.Object:
    vertices = [_runtime_point({"x": x, "y": y, "z": z})]
    for index in range(segments):
        angle = index / segments * math.tau
        vertices.append(_runtime_point({
            "x": x + math.cos(angle) * radius_x,
            "y": y,
            "z": z + math.sin(angle) * radius_z,
        }))
    faces = [(0, 1 + index, 1 + ((index + 1) % segments)) for index in range(segments)]
    return _mesh_object(name, vertices, faces, collection, material)


def _box(
    spec: dict[str, Any],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=_runtime_point(spec["position"]))
    obj = bpy.context.object
    obj.name = spec["id"]
    obj.dimensions = _runtime_size(spec["size"])
    obj.display_type = "WIRE"
    obj.show_in_front = True
    obj.data.materials.append(material)
    _move_to(obj, collection)
    _tag(obj, spec["id"], spec.get("role", "contract-proxy"))
    return obj


def _line(
    name: str,
    points: list[list[float]],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
    radius: float = 0.07,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}.curve", type="CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for target, point in zip(spline.points, points):
        x, y, z = _runtime_point(point)
        target.co = (x, y, z, 1)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def _path_ribbon(
    route: dict[str, Any],
    collection: bpy.types.Collection,
    material: bpy.types.Material,
) -> bpy.types.Object:
    points = route["points"]
    half_width = float(route["width"]) * 0.5
    vertices: list[tuple[float, float, float]] = []
    for index, point in enumerate(points):
        previous = points[max(0, index - 1)]
        following = points[min(len(points) - 1, index + 1)]
        tangent_x = float(following[0]) - float(previous[0])
        tangent_z = float(following[2]) - float(previous[2])
        length = max(1e-8, math.hypot(tangent_x, tangent_z))
        normal_x = -tangent_z / length
        normal_z = tangent_x / length
        for sign in (1, -1):
            vertices.append(_runtime_point([
                float(point[0]) + normal_x * half_width * sign,
                float(point[1]) + 0.025,
                float(point[2]) + normal_z * half_width * sign,
            ]))
    faces = [
        (index * 2, index * 2 + 1, index * 2 + 3, index * 2 + 2)
        for index in range(len(points) - 1)
    ]
    return _mesh_object(route["id"], vertices, faces, collection, material)


def _import_assets(
    data: dict[str, Any],
    project_root: Path,
    editable_collection: bpy.types.Collection,
    context_collection: bpy.types.Collection,
) -> int:
    sources = {source["id"]: source for source in data["sources"]}
    placements_by_source: dict[str, list[dict[str, Any]]] = {}
    for placement in data["assets"]:
        if placement["id"] == "thornvale.authoredProps.wayfinder":
            continue
        placements_by_source.setdefault(placement["source"], []).append(placement)

    staged = 0
    for source_id, placements in placements_by_source.items():
        source = sources.get(source_id)
        if not source:
            raise PizzaLabError(f"World Stage source {source_id!r} is missing")
        source_path = (project_root / source["path"]).resolve()
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(source_path))
        imported = [obj for obj in bpy.data.objects if obj not in before]
        imported_set = set(imported)
        claimed: set[bpy.types.Object] = set()
        roots: list[bpy.types.Object] = []
        for placement in placements:
            matches = [obj for obj in imported if obj.name == placement["assetRoot"]]
            if len(matches) != 1:
                raise PizzaLabError(
                    f"Expected one {placement['assetRoot']!r} root in {source_id!r}; found {len(matches)}"
                )
            root = matches[0]
            roots.append(root)
            world = root.matrix_world.copy()
            if root.parent in imported_set:
                root.parent = None
                root.matrix_world = world
            root.location = _runtime_point(placement["position"])
            root.rotation_mode = "XYZ"
            root.rotation_euler = (0, 0, float(placement.get("rotationY", 0)))
            root.scale = (1, 1, 1)
            editable = bool(placement.get("editable"))
            target = editable_collection if editable else context_collection
            hierarchy = [root, *list(root.children_recursive)]
            for child_index, obj in enumerate(hierarchy):
                claimed.add(obj)
                _move_to(obj, target)
                child_id = placement["id"] if child_index == 0 else f"{placement['id']}.part.{child_index}"
                _tag(
                    obj,
                    child_id,
                    "editable-asset" if editable else "locked-real-asset-context",
                    editable=editable and child_index == 0,
                    authority="blender-candidate" if editable else "runtime-context",
                    publish_set=placement["publishSet"],
                )
                obj["pizza_lab_asset_root"] = placement["assetRoot"]
                obj["pizza_lab_source_sha256"] = source["sha256"]
            staged += 1
        for obj in imported:
            if obj not in claimed and obj not in roots:
                bpy.data.objects.remove(obj, do_unlink=True)
    return staged


def _load_wayfinder_authoring(
    data: dict[str, Any],
    project_root: Path,
    collection: bpy.types.Collection,
) -> int:
    source = data.get("authoringAssets", {}).get("wayfinder") or {}
    source_path = (project_root / str(source.get("path") or "")).resolve()
    if source_path != (
        project_root
        / "assets-src/pizza-lab/wayfinder-v1/thornvale-wayfinder-authoring.blend"
    ).resolve():
        raise PizzaLabError("Wayfinder authoring source is not allowlisted")
    import hashlib

    actual_hash = hashlib.sha256(source_path.read_bytes()).hexdigest()
    if actual_hash != source.get("sha256"):
        raise PizzaLabError("Wayfinder authoring source hash does not match World Stage input")
    with bpy.data.libraries.load(str(source_path), link=False) as (data_from, data_to):
        data_to.objects = list(data_from.objects)
    loaded = [obj for obj in data_to.objects if obj is not None]
    roots = [obj for obj in loaded if obj.name == source.get("root")]
    if len(roots) != 1:
        raise PizzaLabError(f"Expected one editable VillageWayfinder root, found {len(roots)}")
    root = roots[0]
    placement = next(
        item for item in data["assets"]
        if item["id"] == "thornvale.authoredProps.wayfinder"
    )
    root.location = _runtime_point(placement["position"])
    root.rotation_mode = "XYZ"
    root.rotation_euler = (0, 0, float(placement.get("rotationY", 0)))
    root.scale = (1, 1, 1)
    hierarchy = [root, *list(root.children_recursive)]
    names = {obj.name for obj in hierarchy}
    missing = sorted(set(source.get("requiredComponents") or []) - names)
    if missing:
        raise PizzaLabError(f"Wayfinder authoring source is missing components: {missing}")
    for obj in hierarchy:
        _move_to(obj, collection)
        is_root = obj == root
        semantic_id = str(obj.get("pizza_lab_semantic_id") or "")
        is_board_assembly = semantic_id in {
            "thornvale.asset.village-wayfinder.board.01",
            "thornvale.asset.village-wayfinder.board.02",
            "thornvale.asset.village-wayfinder.board.03",
        }
        game_id = (
            placement["id"]
            if is_root
            else semantic_id or f"{placement['id']}.component.{obj.name}"
        )
        editable = is_root or is_board_assembly
        _tag(
            obj,
            game_id,
            (
                "editable-wayfinder-root"
                if is_root
                else "editable-wayfinder-board"
                if is_board_assembly
                else "locked-wayfinder-component"
            ),
            editable=editable,
            authority="blender-wayfinder-candidate" if editable else "authoring-source-locked",
            publish_set="wayfinder-asset-v1" if editable else "wayfinder-context-v1",
        )
        obj["pizza_lab_asset_root"] = "VillageWayfinder"
        obj["pizza_lab_component_name"] = obj.name
        obj["pizza_lab_authoring_source_sha256"] = actual_hash
    return 1


def build_world_stage(input_path: Path, project_root: Path, *, replace: bool = False) -> dict[str, Any]:
    try:
        data = json.loads(input_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PizzaLabError(f"Unable to read World Stage input: {exc}") from exc
    if data.get("schemaVersion") != 1 or data.get("id") != "thornvale-world-stage-v1":
        raise PizzaLabError("Unsupported World Stage input")

    existing = bpy.data.collections.get(WORLD_COLLECTION)
    if existing and not replace:
        raise PizzaLabError("World Stage already exists; pass replace=True to rebuild it")
    if existing:
        _unlink_collection(existing)

    root = bpy.data.collections.new(WORLD_COLLECTION)
    bpy.context.scene.collection.children.link(root)
    editable_assets = _collection("PL_ASSETS_EDITABLE", root)
    context_assets = _collection("PL_ASSETS_CONTEXT", root)
    terrain_context = _collection("PL_TERRAIN_CONTEXT", root)
    path_context = _collection("PL_PATH_CONTEXT", root)
    contract_proxies = _collection("PL_CONTRACT_PROXIES", root)
    guides = _collection("PL_GUIDES", root)

    meadow_material = _material("PL Meadow Context", (0.23, 0.46, 0.18, 0.62))
    hill_material = _material("PL Bell Hill Context", (0.31, 0.55, 0.22, 0.78))
    path_material = _material("PL Path Context", (0.62, 0.37, 0.24, 0.8))
    water_material = _material("PL Water Context", (0.15, 0.48, 0.65, 0.72))
    collider_material = _material("PL Collider Proxy", (0.95, 0.18, 0.18, 0.3))
    interaction_material = _material("PL Interaction Proxy", (0.95, 0.7, 0.08, 0.55))
    route_material = _material("PL Story Route", (0.62, 0.22, 0.86, 0.8))

    meadow = data["terrain"]["meadow"]
    meadow_obj = _disc(
        "terrain.meadow", 0, meadow["y"], 0, meadow["radius"], meadow["radius"],
        terrain_context, meadow_material,
    )
    _tag(meadow_obj, meadow["id"], "locked-terrain-context")

    hill = data["terrain"]["bellHill"]
    vertices = [
        _runtime_point(hill["vertices"][index:index + 3])
        for index in range(0, len(hill["vertices"]), 3)
    ]
    indices = hill["indices"]
    faces = [tuple(indices[index:index + 3]) for index in range(0, len(indices), 3)]
    hill_obj = _mesh_object(hill["id"], vertices, faces, terrain_context, hill_material)
    _tag(hill_obj, hill["id"], "locked-render-physics-terrain")

    plaza = data["terrain"]["plaza"]
    plaza_obj = _disc(
        plaza["id"], plaza["x"], plaza["y"], plaza["z"], plaza["radius"],
        plaza["radius"] * plaza["scaleZ"], terrain_context, path_material,
    )
    _tag(plaza_obj, plaza["id"], "locked-terrain-context")
    pond = data["terrain"]["pond"]
    pond_obj = _disc(pond["id"], pond["x"], pond["y"] + 0.03, pond["z"], 4.2, 3.2, terrain_context, water_material)
    _tag(pond_obj, pond["id"], "locked-terrain-context")

    for hill_spec in data["terrain"]["decorativeHills"]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, location=_runtime_point(hill_spec))
        obj = bpy.context.object
        obj.name = hill_spec["id"]
        obj.scale = (hill_spec["scaleX"], hill_spec["scaleZ"], hill_spec["scaleY"])
        obj.data.materials.append(hill_material)
        _move_to(obj, terrain_context)
        _tag(obj, hill_spec["id"], "locked-decorative-terrain")

    for route in data["paths"]:
        obj = _path_ribbon(route, path_context, path_material)
        _tag(obj, f"path.{route['id']}", "locked-path-context")
        obj["pizza_lab_path_profile"] = route["profile"]
        obj["pizza_lab_path_width"] = route["width"]
    for apron in data["pathAprons"]:
        apron_obj = _box({
            "id": f"path-apron.{apron['id']}",
            "role": "locked-path-apron",
            "position": {"x": apron["x"], "y": apron["y"] + 0.02, "z": apron["z"]},
            "size": {"x": apron["width"], "y": 0.04, "z": apron["depth"]},
        }, path_context, path_material)
        apron_obj.rotation_euler.z = float(apron.get("rotationY", 0))

    for collider in data["colliders"]:
        _box(collider, contract_proxies, collider_material)
    bounds = data["terrain"]["physicsBounds"]
    _box({
        "id": bounds["id"], "role": "physics-bounds",
        "position": {"x": 0, "y": -0.06, "z": 0},
        "size": {"x": bounds["halfExtent"] * 2, "y": 0.1, "z": bounds["halfExtent"] * 2},
    }, contract_proxies, collider_material)

    for interaction in data["interactions"]:
        radius = float(interaction["radius"])
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=48,
            radius=radius,
            depth=0.08,
            location=_runtime_point(interaction),
        )
        obj = bpy.context.object
        obj.name = interaction["id"]
        obj.data.materials.append(interaction_material)
        obj.display_type = "WIRE"
        obj.show_in_front = True
        _move_to(obj, contract_proxies)
        _tag(obj, interaction["id"], interaction.get("role", "interaction-radius"))

    spawn = data["guides"]["spawn"]
    bpy.ops.mesh.primitive_cone_add(vertices=24, radius1=0.5, depth=1.2, location=_runtime_point(spawn))
    spawn_obj = bpy.context.object
    spawn_obj.name = spawn["id"]
    spawn_obj.data.materials.append(interaction_material)
    _move_to(spawn_obj, guides)
    _tag(spawn_obj, spawn["id"], "spawn-guide")
    for route in data["guides"]["storyRoutes"]:
        obj = _line(route["id"], route["points"], guides, route_material)
        _tag(obj, route["id"], "story-route-guide")
    for exclusion in data["guides"]["grassExclusions"]:
        obj = _disc(
            f"guide.grass-exclusion.{exclusion['id']}",
            exclusion["x"], 0.06, exclusion["z"], exclusion["radius"], exclusion["radius"],
            guides, interaction_material, segments=40,
        )
        obj.display_type = "WIRE"
        obj.show_in_front = True
        _tag(obj, f"guide.grass-exclusion.{exclusion['id']}", "grass-exclusion-guide")

    precinct = data["guides"]["bellPrecinct"]
    for role, items in (
        ("witness-stone", precinct["witnessStones"]),
        ("lantern", precinct["lanterns"]),
        ("grove-tree", precinct["groveTrees"]),
    ):
        for index, item in enumerate(items):
            scale = float(item.get("scale", 0.45 if role == "lantern" else 1))
            bpy.ops.mesh.primitive_ico_sphere_add(
                subdivisions=1,
                radius=scale,
                location=_runtime_point({"x": item["x"], "y": scale, "z": item["z"]}),
            )
            obj = bpy.context.object
            obj.name = f"guide.bell-precinct.{role}.{index}"
            obj.data.materials.append(route_material)
            obj.display_type = "WIRE"
            obj.show_in_front = True
            _move_to(obj, guides)
            _tag(obj, obj.name, f"bell-precinct-{role}-guide")
    for index, drift in enumerate(precinct["flowerDrifts"]):
        obj = _disc(
            f"guide.bell-precinct.flower-drift.{index}",
            drift["x"], 0.08, drift["z"], drift["radius"], drift["radius"],
            guides, route_material, segments=40,
        )
        obj.display_type = "WIRE"
        obj.show_in_front = True
        obj["pizza_lab_instance_count"] = int(drift["count"])
        _tag(obj, obj.name, "bell-precinct-flower-drift-guide")

    asset_count = _import_assets(data, project_root, editable_assets, context_assets)
    asset_count += _load_wayfinder_authoring(data, project_root, editable_assets)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene["pizza_lab_adapter"] = "thornvale"
    bpy.context.scene["pizza_lab_stage_id"] = data["id"]
    bpy.context.scene["pizza_lab_layout_sha256"] = data["authority"]["layoutSha256"]
    bpy.context.scene["pizza_lab_stage_authority"] = "candidate-only"
    bpy.context.view_layer.update()
    return {
        "collection": WORLD_COLLECTION,
        "assetCount": asset_count,
        "pathCount": len(data["paths"]),
        "colliderCount": len(data["colliders"]),
        "interactionCount": len(data["interactions"]),
        "layoutSha256": data["authority"]["layoutSha256"],
    }
