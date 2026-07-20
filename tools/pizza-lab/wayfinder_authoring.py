"""Canonical editable Wayfinder assembly shared by seed and candidate export."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy


BOARD_IDS = ("01", "02", "03")


def load_generator(project_root: Path):
    generator_path = project_root / "scripts" / "build-village-dressing.py"
    spec = importlib.util.spec_from_file_location("thornvale_village_dressing", generator_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load generator {generator_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def create_board_assemblies(
    root: bpy.types.Object,
    collection: bpy.types.Collection,
) -> list[bpy.types.Object]:
    assemblies = []
    for board_id in BOARD_IDS:
        board = next(
            (obj for obj in root.children if obj.name.split(".", 1)[0] == f"Wayfinder_Board_{board_id}"),
            None,
        )
        medallion = next(
            (obj for obj in root.children if obj.name.split(".", 1)[0] == f"Wayfinder_BoardMedallion_{board_id}"),
            None,
        )
        if board is None or medallion is None:
            raise RuntimeError(f"Wayfinder board assembly {board_id} is incomplete")

        board_world = board.matrix_world.copy()
        medallion_world = medallion.matrix_world.copy()
        assembly = bpy.data.objects.new(f"Wayfinder_BoardAssembly_{board_id}", None)
        collection.objects.link(assembly)
        assembly.parent = root
        assembly.location = board.location.copy()
        assembly.rotation_mode = "XYZ"
        assembly.rotation_euler = board.rotation_euler.copy()
        assembly.scale = (1, 1, 1)
        assembly.empty_display_type = "CUBE"
        assembly.empty_display_size = 0.24
        assembly["pizza_lab_semantic_id"] = f"thornvale.asset.village-wayfinder.board.{board_id}"
        assembly["pizza_lab_board_id"] = board_id
        assembly["pizza_lab_baseline_location"] = list(assembly.location)
        assembly["pizza_lab_baseline_rotation_euler"] = list(assembly.rotation_euler)
        assembly["pizza_lab_baseline_scale"] = [1.0, 1.0, 1.0]

        bpy.context.view_layer.update()

        board.parent = assembly
        board.matrix_world = board_world
        medallion.parent = assembly
        medallion.matrix_world = medallion_world
        board["pizza_lab_semantic_id"] = f"thornvale.asset.village-wayfinder.board.{board_id}.face"
        medallion["pizza_lab_semantic_id"] = (
            f"thornvale.asset.village-wayfinder.board.{board_id}.medallion"
        )
        assemblies.append(assembly)
    return assemblies


def build_editable_wayfinder(
    project_root: Path,
    collection_name: str = "PIZZA_LAB_WAYFINDER_AUTHORING",
) -> tuple[object, bpy.types.Object, list[bpy.types.Object]]:
    generator = load_generator(project_root)
    collection = generator.new_collection(collection_name)
    materials = generator.build_materials()
    root = generator.build_wayfinder(collection, materials)
    root.location = (0, 0, 0)
    bpy.context.view_layer.update()
    root["pizza_lab_authoring_source"] = True
    root["pizza_lab_seed_generator"] = "scripts/build-village-dressing.py"
    root["pizza_lab_seed_version"] = generator.BUILD_VERSION
    root["pizza_lab_runtime_root"] = "VillageWayfinder"
    root["pizza_lab_local_origin"] = "ground center"
    root["pizza_lab_authoring_axis"] = "Blender Z-up; -Y front"
    root["pizza_lab_runtime_axis"] = "glTF Y-up; +Z front"
    root["pizza_lab_semantic_id"] = "thornvale.asset.village-wayfinder"
    assemblies = create_board_assemblies(root, collection)
    return generator, root, assemblies
