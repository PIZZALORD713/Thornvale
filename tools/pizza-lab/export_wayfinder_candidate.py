"""Rebuild and export one bounded Pizza Lab Wayfinder asset candidate."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
sys.path.insert(0, str(ROOT))

from wayfinder_authoring import BOARD_IDS, build_editable_wayfinder, load_generator  # noqa: E402


FAMILY_ID = "thornvale-wayfinder-pizza-lab-v1"
BASELINE_GLB = REPO_ROOT / "public/village/thornvale-village-dressing.glb"
WORLD_MANIFEST = REPO_ROOT / "assets-src/pizza-lab/world-stage/thornvale-world-stage-v1.json"
GENERATOR_PATH = REPO_ROOT / "scripts/build-village-dressing.py"
SOURCE_BLEND = (
    REPO_ROOT
    / "assets-src/pizza-lab/wayfinder-v1/thornvale-wayfinder-authoring.blend"
)
OUTPUT_DIR = REPO_ROOT / "output/pizza-lab/wayfinder-v1"
CANDIDATE_GLB = OUTPUT_DIR / "thornvale-wayfinder-candidate.glb"
CANDIDATE_JSON = OUTPUT_DIR / "candidate.json"
EXPECTED_MATERIALS = {
    "TV_Antique_Gold",
    "TV_Blush",
    "TV_Lavender",
    "TV_Leaf_Dark",
    "TV_Leaf_Light",
    "TV_Mint",
    "TV_Stone_Light",
    "TV_Stone_Warm",
    "TV_Wood_Cocoa",
    "TV_Wood_Honey",
}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_arguments() -> argparse.Namespace:
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--overrides", required=True)
    return parser.parse_args(arguments)


def load_overrides(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1 or data.get("id") != "thornvale-wayfinder-board-overrides-v1":
        raise RuntimeError("Unsupported Wayfinder override contract")
    boards = data.get("boards") or {}
    if set(boards) != set(BOARD_IDS):
        raise RuntimeError(f"Expected board overrides {BOARD_IDS}, found {sorted(boards)}")
    return data


def finite_vector(value, label: str) -> list[float]:
    if not isinstance(value, list) or len(value) != 3:
        raise RuntimeError(f"{label} must contain three numbers")
    result = [float(item) for item in value]
    if not all(math.isfinite(item) for item in result):
        raise RuntimeError(f"{label} contains a non-finite value")
    return result


def assert_close_vector(actual, expected, label: str, tolerance: float = 1e-6) -> None:
    if any(abs(float(left) - float(right)) > tolerance for left, right in zip(actual, expected)):
        raise RuntimeError(f"{label} changed outside the canonical baseline")


def apply_board_overrides(assemblies: list[bpy.types.Object], overrides: dict) -> None:
    by_id = {str(assembly["pizza_lab_board_id"]): assembly for assembly in assemblies}
    for board_id in BOARD_IDS:
        assembly = by_id[board_id]
        contract = overrides["boards"][board_id]
        baseline = contract.get("before") or {}
        after = contract.get("after") or {}
        canonical_location = list(assembly["pizza_lab_baseline_location"])
        canonical_rotation = list(assembly["pizza_lab_baseline_rotation_euler"])
        canonical_scale = list(assembly["pizza_lab_baseline_scale"])
        assert_close_vector(finite_vector(baseline.get("location"), f"board {board_id} baseline location"), canonical_location, f"board {board_id} baseline location")
        assert_close_vector(finite_vector(baseline.get("rotationEuler"), f"board {board_id} baseline rotation"), canonical_rotation, f"board {board_id} baseline rotation")
        assert_close_vector(finite_vector(baseline.get("scale"), f"board {board_id} baseline scale"), canonical_scale, f"board {board_id} baseline scale")

        location = finite_vector(after.get("location"), f"board {board_id} location")
        rotation = finite_vector(after.get("rotationEuler"), f"board {board_id} rotation")
        scale = finite_vector(after.get("scale"), f"board {board_id} scale")
        if abs(location[0] - canonical_location[0]) > 0.75 or abs(location[2] - canonical_location[2]) > 0.75:
            raise RuntimeError(f"Board {board_id} translation exceeds the 0.75 meter authoring envelope")
        if abs(location[1] - canonical_location[1]) > 0.35:
            raise RuntimeError(f"Board {board_id} depth translation exceeds the 0.35 meter authoring envelope")
        if abs(rotation[0]) > 1e-6 or abs(rotation[1]) > 1e-6:
            raise RuntimeError(f"Board {board_id} may rotate only around Blender Z")
        # Z is the vertical axis in Blender. A directional sign needs the full
        # yaw circle; decoded footprint bounds remain the safety gate.
        if not (0.5 <= scale[0] <= 1.75 and 0.75 <= scale[1] <= 1.25 and 0.5 <= scale[2] <= 1.75):
            raise RuntimeError(f"Board {board_id} scale exceeds the reviewed authoring envelope")
        assembly.location = location
        assembly.rotation_mode = "XYZ"
        assembly.rotation_euler = rotation
        assembly.scale = scale


def bake_board_assemblies(root: bpy.types.Object, assemblies: list[bpy.types.Object]) -> None:
    for assembly in assemblies:
        for child in list(assembly.children):
            world = child.matrix_world.copy()
            child.parent = root
            child.matrix_world = world
        bpy.data.objects.remove(assembly, do_unlink=True)


def export_glb(generator, root: bpy.types.Object, path: Path) -> None:
    root.pop("stage_translation_m", None)
    root["pizza_lab_family"] = FAMILY_ID
    root["pizza_lab_export_contract"] = "board-transform-only-v1"
    generator.consolidate_root(root)
    bpy.ops.object.select_all(action="DESELECT")
    selected = [root, *list(root.children_recursive)]
    for obj in selected:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        check_existing=False,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_texcoords=False,
        export_normals=True,
        export_tangents=False,
        export_attributes=False,
        export_materials="EXPORT",
        export_unused_images=False,
        export_unused_textures=False,
        export_skins=False,
        export_morph=False,
        export_animations=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=10,
        export_draco_generic_quantization=12,
        export_shared_accessors=True,
        export_copyright="Original project-authored ThornVale geometry",
    )


def parse_glb(path: Path) -> dict:
    with path.open("rb") as handle:
        magic, version, _length = struct.unpack("<4sII", handle.read(12))
        if magic != b"glTF" or version != 2:
            raise RuntimeError("Candidate is not a glTF 2.0 binary")
        json_length, chunk_type = struct.unpack("<II", handle.read(8))
        if chunk_type != 0x4E4F534A:
            raise RuntimeError("Candidate GLB has no leading JSON chunk")
        return json.loads(handle.read(json_length).decode("utf-8").rstrip(" \t\r\n\0"))


def accessor_count(document: dict, index: int) -> int:
    accessor = document.get("accessors", [])[index]
    count = accessor.get("count")
    if not isinstance(count, int) or count <= 0:
        raise RuntimeError("Candidate GLB contains an invalid accessor count")
    return count


def validate_document(document: dict, path: Path) -> dict:
    root_indices = document.get("scenes", [])[document.get("scene", 0)].get("nodes", [])
    if len(root_indices) != 1:
        raise RuntimeError("Candidate GLB must contain exactly one scene root")
    root_node = document["nodes"][root_indices[0]]
    if root_node.get("name") != "VillageWayfinder":
        raise RuntimeError("Candidate GLB root must be VillageWayfinder")
    for key, identity in (
        ("translation", [0, 0, 0]),
        ("rotation", [0, 0, 0, 1]),
        ("scale", [1, 1, 1]),
    ):
        if key in root_node and list(root_node[key]) != identity:
            raise RuntimeError(f"Candidate root {key} must be identity")
    if set(document.get("extensionsUsed") or []) != {"KHR_draco_mesh_compression"}:
        raise RuntimeError("Candidate must use only KHR_draco_mesh_compression")
    if set(document.get("extensionsRequired") or []) != {"KHR_draco_mesh_compression"}:
        raise RuntimeError("Candidate must require KHR_draco_mesh_compression")
    for key in ("images", "textures", "animations", "skins", "cameras"):
        if document.get(key):
            raise RuntimeError(f"Candidate GLB must not contain {key}")
    if any(buffer.get("uri") for buffer in document.get("buffers", [])):
        raise RuntimeError("Candidate GLB must not reference external buffers")
    material_names = {material.get("name") for material in document.get("materials", [])}
    if material_names != EXPECTED_MATERIALS:
        raise RuntimeError(f"Candidate material contract changed: {sorted(material_names)}")

    primitives = 0
    vertices = 0
    triangles = 0
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            primitives += 1
            extensions = set((primitive.get("extensions") or {}).keys())
            if extensions != {"KHR_draco_mesh_compression"}:
                raise RuntimeError("Every candidate primitive must use Draco")
            vertices += accessor_count(document, primitive["attributes"]["POSITION"])
            triangles += accessor_count(document, primitive["indices"]) // 3
    metrics = {
        "bytes": path.stat().st_size,
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "primitives": primitives,
        "materials": len(document.get("materials", [])),
        "vertices": vertices,
        "triangles": triangles,
    }
    if metrics["nodes"] != 11 or metrics["meshes"] != 10 or primitives != 10:
        raise RuntimeError(f"Candidate optimized hierarchy changed: {metrics}")
    if metrics["materials"] != 10 or triangles != 1488:
        raise RuntimeError(f"Candidate material or triangle contract changed: {metrics}")
    if metrics["bytes"] > 31_000:
        raise RuntimeError(f"Candidate exceeds its 31,000 byte deployment gate: {metrics['bytes']}")
    return metrics


def validate_clean_reimport(path: Path) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    root = bpy.data.objects.get("VillageWayfinder")
    if root is None or root.parent is not None:
        raise RuntimeError("Clean reimport did not preserve the VillageWayfinder root")
    if root.location.length > 1e-6 or any(abs(value) > 1e-6 for value in root.rotation_euler):
        raise RuntimeError("Clean reimport root transform is not identity")
    if any(abs(value - 1) > 1e-6 for value in root.scale):
        raise RuntimeError("Clean reimport root scale is not identity")

    minimum = Vector((math.inf, math.inf, math.inf))
    maximum = Vector((-math.inf, -math.inf, -math.inf))
    decoded_vertices = 0
    decoded_triangles = 0
    for obj in root.children_recursive:
        if obj.type != "MESH":
            continue
        obj.data.calc_loop_triangles()
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            if not all(math.isfinite(value) for value in point):
                raise RuntimeError(f"Decoded candidate contains non-finite geometry in {obj.name}")
            minimum.x = min(minimum.x, point.x)
            minimum.y = min(minimum.y, point.y)
            minimum.z = min(minimum.z, point.z)
            maximum.x = max(maximum.x, point.x)
            maximum.y = max(maximum.y, point.y)
            maximum.z = max(maximum.z, point.z)
        for triangle in obj.data.loop_triangles:
            if triangle.area <= 1e-10:
                raise RuntimeError(f"Decoded candidate contains a zero-area triangle in {obj.name}")
        decoded_vertices += len(obj.data.vertices)
        decoded_triangles += len(obj.data.loop_triangles)
    size = maximum - minimum
    if minimum.z < -0.08 or minimum.z > 0.08:
        raise RuntimeError(f"Candidate ground contact moved outside tolerance: {minimum.z}")
    if size.x > 3.2 or size.y > 3.2 or size.z > 3.6:
        raise RuntimeError(f"Candidate bounds exceed the reviewed footprint: {tuple(size)}")
    return {
        "min": [round(value, 6) for value in minimum],
        "max": [round(value, 6) for value in maximum],
        "size": [round(value, 6) for value in size],
        "decodedVertices": decoded_vertices,
        "decodedTriangles": decoded_triangles,
    }


def main() -> int:
    arguments = parse_arguments()
    overrides = load_overrides(Path(arguments.overrides).resolve())
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_BLEND.parent.mkdir(parents=True, exist_ok=True)
    generator = load_generator(REPO_ROOT)
    generator.clean_scene()
    bpy.context.preferences.filepaths.save_version = 0
    generator, root, assemblies = build_editable_wayfinder(REPO_ROOT)
    apply_board_overrides(assemblies, overrides)

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene.unit_settings.scale_length = 1.0
    scene["pizza_lab_family"] = FAMILY_ID
    scene["pizza_lab_board_overrides"] = json.dumps(overrides["boards"], sort_keys=True)
    source_temp = SOURCE_BLEND.with_name(f".{SOURCE_BLEND.stem}.tmp-{os.getpid()}.blend")
    candidate_temp = CANDIDATE_GLB.with_name(f".{CANDIDATE_GLB.stem}.tmp-{os.getpid()}.glb")
    try:
        bpy.ops.wm.save_as_mainfile(filepath=str(source_temp), compress=True)
        source_hash = sha256(source_temp)
        bake_board_assemblies(root, assemblies)
        export_glb(generator, root, candidate_temp)
        document = parse_glb(candidate_temp)
        metrics = validate_document(document, candidate_temp)
        candidate_hash = sha256(candidate_temp)
        clean_reimport = validate_clean_reimport(candidate_temp)
        manifest = json.loads(WORLD_MANIFEST.read_text(encoding="utf-8"))
        candidate = {
            "schemaVersion": 1,
            "id": "thornvale-wayfinder-candidate-v1",
            "family": FAMILY_ID,
            "root": "VillageWayfinder",
            "baseSource": {
                "path": "public/village/thornvale-village-dressing.glb",
                "sha256": sha256(BASELINE_GLB),
            },
            "generator": {
                "path": "scripts/build-village-dressing.py",
                "sha256": sha256(GENERATOR_PATH),
            },
            "worldStage": {
                "path": "assets-src/pizza-lab/world-stage/thornvale-world-stage-v1.json",
                "layoutSha256": manifest["layoutSha256"],
                "sha256": sha256(WORLD_MANIFEST),
            },
            "authoringSource": {
                "path": "assets-src/pizza-lab/wayfinder-v1/thornvale-wayfinder-authoring.blend",
                "sha256": source_hash,
            },
            "candidate": {
                "path": "output/pizza-lab/wayfinder-v1/thornvale-wayfinder-candidate.glb",
                "sha256": candidate_hash,
                **metrics,
                "bounds": clean_reimport,
            },
            "boardOverrides": overrides["boards"],
            "blender": {
                "version": bpy.app.version_string,
                "export": "GLB, Y-up, normals, materials, extras, Draco level 6, position q14, normal q10",
            },
        }
        encoded = json.dumps(candidate, indent=2, sort_keys=True) + "\n"
        candidate_json_temp = CANDIDATE_JSON.with_name(
            f".{CANDIDATE_JSON.stem}.tmp-{os.getpid()}.json"
        )
        candidate_json_temp.write_text(encoded, encoding="utf-8")
        os.replace(source_temp, SOURCE_BLEND)
        os.replace(candidate_temp, CANDIDATE_GLB)
        os.replace(candidate_json_temp, CANDIDATE_JSON)
    finally:
        for path in (source_temp, candidate_temp):
            if path.exists():
                path.unlink()

    print(f"PIZZA_LAB_WAYFINDER_CANDIDATE={CANDIDATE_JSON}")
    print(f"PIZZA_LAB_WAYFINDER_GLB={CANDIDATE_GLB}")
    print(f"PIZZA_LAB_WAYFINDER_SHA256={candidate_hash}")
    print(f"PIZZA_LAB_WAYFINDER_METRICS={json.dumps(metrics, sort_keys=True)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
