#!/usr/bin/env python3
"""Build Thornvale's deterministic low-poly village dressing kit in Blender 4.5 LTS.

Run from any directory with:

    /Applications/Blender-4.5-LTS.app/Contents/MacOS/Blender \
      --background --factory-startup \
      --python scripts/build-village-dressing.py

The script authors the scene from primitives, saves the staged source .blend,
renders a source preview, and exports the three prop roots to one runtime GLB.
"""

from __future__ import annotations

import json
import math
import struct
from pathlib import Path

import bpy
from mathutils import Vector


BUILD_VERSION = "1.0.0"
ROOT_NAMES = ("VillageWayfinder", "GardenArch", "StoneWell")
SCRIPT_PATH = Path(__file__).resolve()
REPO_ROOT = SCRIPT_PATH.parents[1]
SOURCE_DIR = REPO_ROOT / "assets-src" / "village-dressing"
RUNTIME_DIR = REPO_ROOT / "public" / "village"
BLEND_PATH = SOURCE_DIR / "thornvale-village-dressing.blend"
PREVIEW_PATH = SOURCE_DIR / "thornvale-village-dressing-preview.png"
GLB_PATH = RUNTIME_DIR / "thornvale-village-dressing.glb"


def clean_scene() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material)


def new_collection(name: str) -> bpy.types.Collection:
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj: bpy.types.Object, collection: bpy.types.Collection) -> None:
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float = 0.68,
    metallic: float = 0.0,
    coat: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = color
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    coat_input = bsdf.inputs.get("Coat Weight")
    if coat_input is not None:
        coat_input.default_value = coat
    return material


def build_materials() -> dict[str, bpy.types.Material]:
    return {
        "cream": make_material("TV_Cream", (0.94, 0.82, 0.61, 1.0), 0.78),
        "vanilla": make_material("TV_Vanilla", (0.98, 0.91, 0.74, 1.0), 0.74),
        "cocoa": make_material("TV_Wood_Cocoa", (0.25, 0.075, 0.035, 1.0), 0.72),
        "honey": make_material("TV_Wood_Honey", (0.67, 0.31, 0.075, 1.0), 0.7),
        "mint": make_material("TV_Mint", (0.36, 0.72, 0.51, 1.0), 0.7),
        "leaf_dark": make_material("TV_Leaf_Dark", (0.075, 0.32, 0.11, 1.0), 0.76),
        "leaf_light": make_material("TV_Leaf_Light", (0.26, 0.61, 0.16, 1.0), 0.75),
        "blush": make_material("TV_Blush", (0.92, 0.42, 0.53, 1.0), 0.66),
        "lavender": make_material("TV_Lavender", (0.55, 0.48, 0.82, 1.0), 0.67),
        "stone": make_material("TV_Stone_Warm", (0.53, 0.49, 0.43, 1.0), 0.88),
        "stone_light": make_material("TV_Stone_Light", (0.72, 0.68, 0.59, 1.0), 0.86),
        "stone_dark": make_material("TV_Stone_Shadow", (0.24, 0.25, 0.22, 1.0), 0.92),
        "water": make_material("TV_Water_Teal", (0.12, 0.49, 0.58, 1.0), 0.23, coat=0.52),
        "gold": make_material("TV_Antique_Gold", (0.86, 0.53, 0.095, 1.0), 0.42, metallic=0.28),
        "stage_grass": make_material("STAGE_Grass", (0.29, 0.52, 0.20, 1.0), 0.95),
    }


def set_parent_and_local_transform(
    obj: bpy.types.Object,
    parent: bpy.types.Object,
    location: tuple[float, float, float],
    rotation: tuple[float, float, float],
) -> None:
    obj.parent = parent
    obj.location = location
    obj.rotation_euler = rotation


def set_active(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def finish_mesh(
    obj: bpy.types.Object,
    material: bpy.types.Material,
    bevel: float = 0.0,
    bevel_segments: int = 2,
    smooth: bool = False,
) -> bpy.types.Object:
    obj.data.materials.append(material)
    set_active(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0.0:
        modifier = obj.modifiers.new("Storybook bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = bevel_segments
        modifier.limit_method = "ANGLE"
        modifier.harden_normals = True
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    return obj


def add_cube(
    name: str,
    parent: bpy.types.Object,
    collection: bpy.types.Collection,
    dimensions: tuple[float, float, float],
    location: tuple[float, float, float],
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.035,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=2.0)
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    set_parent_and_local_transform(obj, parent, location, rotation)
    obj.scale = tuple(value * 0.5 for value in dimensions)
    return finish_mesh(obj, material, bevel=bevel)


def add_cylinder(
    name: str,
    parent: bpy.types.Object,
    collection: bpy.types.Collection,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    vertices: int = 10,
    bevel: float = 0.02,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth)
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    set_parent_and_local_transform(obj, parent, location, rotation)
    return finish_mesh(obj, material, bevel=bevel, smooth=False)


def add_cone(
    name: str,
    parent: bpy.types.Object,
    collection: bpy.types.Collection,
    radius_bottom: float,
    radius_top: float,
    depth: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    vertices: int = 10,
    bevel: float = 0.018,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=depth,
    )
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    set_parent_and_local_transform(obj, parent, location, rotation)
    return finish_mesh(obj, material, bevel=bevel, smooth=False)


def add_ico(
    name: str,
    parent: bpy.types.Object,
    collection: bpy.types.Collection,
    radii: tuple[float, float, float],
    location: tuple[float, float, float],
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    subdivisions: int = 1,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1.0)
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    set_parent_and_local_transform(obj, parent, location, rotation)
    obj.scale = radii
    return finish_mesh(obj, material)


def add_torus(
    name: str,
    parent: bpy.types.Object,
    collection: bpy.types.Collection,
    major_radius: float,
    minor_radius: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        align="WORLD",
        major_segments=12,
        minor_segments=4,
        location=(0.0, 0.0, 0.0),
        major_radius=major_radius,
        minor_radius=minor_radius,
    )
    obj = bpy.context.object
    obj.name = name
    move_to_collection(obj, collection)
    set_parent_and_local_transform(obj, parent, location, rotation)
    return finish_mesh(obj, material)


def add_extruded_polygon(
    name: str,
    parent: bpy.types.Object,
    collection: bpy.types.Collection,
    points_xz: list[tuple[float, float]],
    depth: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.025,
) -> bpy.types.Object:
    count = len(points_xz)
    vertices = [(x, -depth * 0.5, z) for x, z in points_xz]
    vertices += [(x, depth * 0.5, z) for x, z in points_xz]
    faces: list[tuple[int, ...]] = [tuple(range(count)), tuple(range(count * 2 - 1, count - 1, -1))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, next_index + count, index + count))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    set_parent_and_local_transform(obj, parent, location, rotation)
    return finish_mesh(obj, material, bevel=bevel)


def add_curve_tube(
    name: str,
    parent: bpy.types.Object,
    collection: bpy.types.Collection,
    points: list[tuple[float, float, float]],
    radius: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(f"{name}_Curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 1
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    curve.resolution_v = 0
    curve.use_fill_caps = True
    spline = curve.splines.new(type="POLY")
    spline.points.add(len(points) - 1)
    for point, coordinate in zip(spline.points, points, strict=True):
        point.co = (*coordinate, 1.0)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(material)
    set_active(obj)
    bpy.ops.object.convert(target="MESH")
    return bpy.context.object


def add_leaf(
    name: str,
    parent: bpy.types.Object,
    collection: bpy.types.Collection,
    location: tuple[float, float, float],
    rotation_z: float,
    material: bpy.types.Material,
    scale: float = 1.0,
) -> None:
    add_ico(
        name,
        parent,
        collection,
        (0.13 * scale, 0.045 * scale, 0.075 * scale),
        location,
        material,
        rotation=(0.0, 0.0, rotation_z),
    )


def add_flower(
    name: str,
    parent: bpy.types.Object,
    collection: bpy.types.Collection,
    center: tuple[float, float, float],
    petal_material: bpy.types.Material,
    gold: bpy.types.Material,
    scale: float = 1.0,
) -> None:
    cx, cy, cz = center
    for index in range(5):
        angle = index * math.tau / 5.0
        add_ico(
            f"{name}_Petal_{index + 1:02d}",
            parent,
            collection,
            (0.048 * scale, 0.025 * scale, 0.09 * scale),
            (cx + math.cos(angle) * 0.07 * scale, cy, cz + math.sin(angle) * 0.07 * scale),
            petal_material,
            rotation=(0.0, 0.0, angle - math.pi * 0.5),
        )
    add_ico(
        f"{name}_Center",
        parent,
        collection,
        (0.05 * scale, 0.03 * scale, 0.05 * scale),
        center,
        gold,
        subdivisions=2,
    )


def new_root(
    name: str,
    stage_location: tuple[float, float, float],
    collection: bpy.types.Collection,
    footprint: str,
) -> bpy.types.Object:
    root = bpy.data.objects.new(name, None)
    collection.objects.link(root)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.5
    root.location = stage_location
    root["asset_root"] = True
    root["build_version"] = BUILD_VERSION
    root["units"] = "meters"
    root["local_origin"] = "ground center"
    root["front_axis"] = "+Z in exported glTF (-Y in Blender authoring)"
    root["stage_translation_m"] = f"{stage_location[0]:.2f}, {stage_location[1]:.2f}, {stage_location[2]:.2f}"
    root["runtime_reset"] = "Set this root position to (0, 0, 0) before placement"
    root["footprint_m"] = footprint
    return root


def build_wayfinder(collection: bpy.types.Collection, mat: dict[str, bpy.types.Material]) -> bpy.types.Object:
    root = new_root("VillageWayfinder", (-5.2, 0.0, 0.0), collection, "2.25 x 0.85")

    for index, (x, y, rx, ry, rz) in enumerate(
        [(-0.22, 0.02, 0.30, 0.24, 0.14), (0.22, 0.06, 0.27, 0.22, 0.12), (0.02, -0.18, 0.22, 0.18, 0.10)]
    ):
        add_ico(
            f"Wayfinder_BaseStone_{index + 1:02d}",
            root,
            collection,
            (rx, ry, rz),
            (x, y, rz * 0.72),
            mat["stone_light" if index % 2 == 0 else "stone"],
            rotation=(0.0, 0.0, index * 0.27),
        )

    add_cube("Wayfinder_Post", root, collection, (0.27, 0.27, 2.45), (0.0, 0.0, 1.25), mat["cocoa"], bevel=0.065)
    add_cube("Wayfinder_PostInlay", root, collection, (0.075, 0.035, 1.82), (0.0, -0.153, 1.35), mat["honey"], bevel=0.015)
    add_ico("Wayfinder_PostCap", root, collection, (0.22, 0.22, 0.19), (0.0, 0.0, 2.57), mat["gold"], subdivisions=2)

    boards = [
        (2.12, 1, mat["mint"], -0.035),
        (1.72, -1, mat["blush"], 0.045),
        (1.32, 1, mat["lavender"], -0.025),
    ]
    for index, (height, direction, board_material, tilt) in enumerate(boards):
        width = 1.86
        half_height = 0.18
        shoulder = 0.54
        raw_points = [
            (-width * 0.5, -half_height),
            (shoulder, -half_height),
            (shoulder, -half_height * 1.55),
            (width * 0.5, 0.0),
            (shoulder, half_height * 1.55),
            (shoulder, half_height),
            (-width * 0.5, half_height),
        ]
        points = [(x * direction, z) for x, z in raw_points]
        add_extruded_polygon(
            f"Wayfinder_Board_{index + 1:02d}",
            root,
            collection,
            points,
            0.15,
            (0.16 * direction, -0.015, height),
            board_material,
            rotation=(0.0, 0.0, tilt),
            bevel=0.035,
        )
        add_ico(
            f"Wayfinder_BoardMedallion_{index + 1:02d}",
            root,
            collection,
            (0.105, 0.035, 0.105),
            (-0.06 * direction, -0.103, height),
            mat["gold"],
            subdivisions=2,
        )

    vine_points = [
        (-0.10, -0.18, 0.48),
        (0.11, -0.18, 0.78),
        (-0.10, -0.18, 1.08),
        (0.10, -0.18, 1.39),
        (-0.08, -0.18, 1.68),
    ]
    add_curve_tube("Wayfinder_Vine", root, collection, vine_points, 0.024, mat["leaf_dark"])
    for index, point in enumerate(vine_points[1:]):
        add_leaf(
            f"Wayfinder_Leaf_{index + 1:02d}",
            root,
            collection,
            (point[0] + (0.11 if index % 2 == 0 else -0.11), point[1] - 0.015, point[2]),
            -0.55 if index % 2 == 0 else 0.55,
            mat["leaf_light" if index % 2 == 0 else "leaf_dark"],
            0.9,
        )
    add_flower("Wayfinder_Flower", root, collection, (0.02, -0.22, 0.87), mat["blush"], mat["gold"], 0.8)
    return root


def build_garden_arch(collection: bpy.types.Collection, mat: dict[str, bpy.types.Material]) -> bpy.types.Object:
    root = new_root("GardenArch", (0.0, 0.0, 0.0), collection, "2.65 x 0.90")

    for side in (-1, 1):
        x = side * 1.08
        add_cube(f"GardenArch_Foot_{side:+d}", root, collection, (0.62, 0.64, 0.22), (x, 0.0, 0.11), mat["stone_light"], bevel=0.075)
        add_cube(f"GardenArch_Post_{side:+d}", root, collection, (0.34, 0.40, 1.84), (x, 0.0, 1.04), mat["cream"], bevel=0.07)
        add_cube(f"GardenArch_PostInlay_{side:+d}", root, collection, (0.095, 0.045, 1.46), (x, -0.225, 1.07), mat["honey"], bevel=0.018)
        add_ico(f"GardenArch_PostCap_{side:+d}", root, collection, (0.24, 0.24, 0.18), (x, 0.0, 1.98), mat["gold"], subdivisions=2)

    arch_points = []
    inner_points = []
    for index in range(13):
        angle = math.pi - index * math.pi / 12.0
        arch_points.append((math.cos(angle) * 1.08, 0.0, 1.92 + math.sin(angle) * 1.08))
        inner_points.append((math.cos(angle) * 0.88, -0.215, 1.91 + math.sin(angle) * 0.88))
    add_curve_tube("GardenArch_MainArc", root, collection, arch_points, 0.17, mat["cream"])
    add_curve_tube("GardenArch_InnerArc", root, collection, inner_points, 0.045, mat["honey"])

    vine_points = [(-1.23, -0.25, 0.35), (-1.30, -0.25, 1.12), (-1.14, -0.25, 1.88)]
    for index in range(10):
        angle = math.pi - index * math.pi / 12.0
        vine_points.append((math.cos(angle) * 1.22, -0.25, 1.93 + math.sin(angle) * 1.21))
    add_curve_tube("GardenArch_Vine", root, collection, vine_points, 0.034, mat["leaf_dark"])

    leaf_samples = [
        (-1.30, 0.78, -0.7),
        (-1.23, 1.48, 0.65),
        (-1.08, 2.22, -0.5),
        (-0.71, 2.78, 0.55),
        (-0.06, 3.10, -0.25),
        (0.60, 2.83, 0.65),
        (1.00, 2.34, -0.55),
    ]
    for index, (x, z, angle) in enumerate(leaf_samples):
        add_leaf(
            f"GardenArch_Leaf_{index + 1:02d}",
            root,
            collection,
            (x, -0.29, z),
            angle,
            mat["leaf_light" if index % 2 == 0 else "leaf_dark"],
            1.12,
        )

    add_flower("GardenArch_Flower_Left", root, collection, (-1.20, -0.31, 1.30), mat["blush"], mat["gold"], 0.92)
    add_flower("GardenArch_Flower_Top", root, collection, (-0.18, -0.31, 3.10), mat["lavender"], mat["gold"], 0.9)
    add_flower("GardenArch_Flower_Right", root, collection, (0.86, -0.31, 2.54), mat["blush"], mat["gold"], 0.8)

    # A three-piece heart reads cleanly from glTF +Z (Blender -Y).
    add_ico("GardenArch_HeartLeft", root, collection, (0.13, 0.055, 0.13), (-0.10, -0.285, 2.55), mat["blush"], subdivisions=2)
    add_ico("GardenArch_HeartRight", root, collection, (0.13, 0.055, 0.13), (0.10, -0.285, 2.55), mat["blush"], subdivisions=2)
    add_cone("GardenArch_HeartPoint", root, collection, 0.02, 0.18, 0.26, (0.0, -0.285, 2.43), mat["blush"], vertices=8, bevel=0.01)
    return root


def build_stone_well(collection: bpy.types.Collection, mat: dict[str, bpy.types.Material]) -> bpy.types.Object:
    root = new_root("StoneWell", (5.2, 0.0, 0.0), collection, "2.55 x 2.15")

    add_cylinder("StoneWell_InnerShadow", root, collection, 0.64, 0.46, (0.0, 0.0, 0.28), mat["stone_dark"], vertices=16, bevel=0.025)
    add_cylinder("StoneWell_Water", root, collection, 0.57, 0.045, (0.0, 0.0, 0.535), mat["water"], vertices=20, bevel=0.015)
    for row in range(2):
        count = 14
        for index in range(count):
            angle = index * math.tau / count + (math.pi / count if row else 0.0)
            radius = 0.78
            add_cube(
                f"StoneWell_Block_{row + 1:02d}_{index + 1:02d}",
                root,
                collection,
                (0.43, 0.39, 0.24),
                (math.cos(angle) * radius, math.sin(angle) * radius, 0.16 + row * 0.245),
                mat["stone_light" if (index + row) % 3 else "stone"],
                rotation=(0.0, 0.0, angle + math.pi * 0.5),
                bevel=0.055,
            )

    for side in (-1, 1):
        x = side * 0.96
        add_cube(f"StoneWell_PostFoot_{side:+d}", root, collection, (0.48, 0.55, 0.18), (x, 0.0, 0.09), mat["stone_light"], bevel=0.06)
        add_cube(f"StoneWell_Post_{side:+d}", root, collection, (0.24, 0.28, 1.82), (x, 0.0, 1.08), mat["cocoa"], bevel=0.055)
        add_ico(f"StoneWell_PostCap_{side:+d}", root, collection, (0.18, 0.18, 0.16), (x, 0.0, 2.01), mat["gold"], subdivisions=2)

    add_cylinder(
        "StoneWell_CrankAxle",
        root,
        collection,
        0.075,
        1.95,
        (0.0, 0.0, 1.52),
        mat["honey"],
        rotation=(0.0, math.pi * 0.5, 0.0),
        vertices=10,
        bevel=0.018,
    )
    add_cylinder("StoneWell_CrankArm", root, collection, 0.045, 0.40, (1.13, 0.0, 1.36), mat["gold"], rotation=(math.pi * 0.5, 0.0, 0.0), vertices=8, bevel=0.012)
    add_ico("StoneWell_CrankGrip", root, collection, (0.085, 0.085, 0.12), (1.13, -0.22, 1.36), mat["cocoa"], subdivisions=2)

    add_cylinder("StoneWell_Rope", root, collection, 0.022, 0.68, (0.0, -0.025, 1.17), mat["honey"], vertices=8, bevel=0.006)
    add_cone("StoneWell_Bucket", root, collection, 0.21, 0.17, 0.30, (0.0, -0.025, 0.74), mat["cocoa"], vertices=10, bevel=0.022)
    add_torus("StoneWell_BucketRim", root, collection, 0.20, 0.025, (0.0, -0.025, 0.89), mat["gold"])

    roof_angle = 0.55
    add_cube("StoneWell_RoofFront", root, collection, (2.35, 0.92, 0.12), (0.0, -0.35, 2.18), mat["mint"], rotation=(roof_angle, 0.0, 0.0), bevel=0.045)
    add_cube("StoneWell_RoofBack", root, collection, (2.35, 0.92, 0.12), (0.0, 0.35, 2.18), mat["mint"], rotation=(-roof_angle, 0.0, 0.0), bevel=0.045)
    add_cylinder("StoneWell_RoofRidge", root, collection, 0.075, 2.42, (0.0, 0.0, 2.42), mat["gold"], rotation=(0.0, math.pi * 0.5, 0.0), vertices=10, bevel=0.016)

    add_ico("StoneWell_GableHeartLeft", root, collection, (0.105, 0.045, 0.105), (-0.08, -0.84, 2.17), mat["blush"], subdivisions=2)
    add_ico("StoneWell_GableHeartRight", root, collection, (0.105, 0.045, 0.105), (0.08, -0.84, 2.17), mat["blush"], subdivisions=2)
    add_cone("StoneWell_GableHeartPoint", root, collection, 0.015, 0.145, 0.22, (0.0, -0.84, 2.07), mat["blush"], vertices=8, bevel=0.01)

    add_curve_tube(
        "StoneWell_MossVine",
        root,
        collection,
        [(-0.75, -0.45, 0.26), (-0.42, -0.55, 0.49), (-0.03, -0.60, 0.53), (0.32, -0.57, 0.48)],
        0.025,
        mat["leaf_dark"],
    )
    for index, (x, z, angle) in enumerate([(-0.62, 0.37, -0.5), (-0.29, 0.51, 0.6), (0.12, 0.52, -0.4)]):
        add_leaf(f"StoneWell_MossLeaf_{index + 1:02d}", root, collection, (x, -0.61, z), angle, mat["leaf_light"], 0.82)
    return root


def consolidate_root(root: bpy.types.Object) -> None:
    """Join each root's meshes by material for a compact runtime hierarchy."""
    groups: dict[str, list[bpy.types.Object]] = {}
    for obj in list(root.children_recursive):
        if obj.type != "MESH":
            continue
        material = obj.data.materials[0] if obj.data.materials else None
        key = material.name if material else "NoMaterial"
        groups.setdefault(key, []).append(obj)

    for material_name in sorted(groups):
        objects = groups[material_name]
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        active = objects[0]
        bpy.context.view_layer.objects.active = active
        if len(objects) > 1:
            bpy.ops.object.join()
        active = bpy.context.object
        active.name = f"{root.name}_{material_name.removeprefix('TV_')}"
        active.data.name = f"{active.name}_Mesh"
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        if active.data.materials:
            for polygon in active.data.polygons:
                polygon.material_index = 0
            while len(active.data.materials) > 1:
                active.data.materials.pop(index=1)
        active["asset_component"] = root.name
        active["material_family"] = material_name


def point_camera(camera: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_stage(
    stage_collection: bpy.types.Collection,
    mat: dict[str, bpy.types.Material],
) -> None:
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 675
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    scene.render.image_settings.color_depth = "8"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"

    scene["kit_name"] = "Thornvale Village Dressing"
    scene["build_version"] = BUILD_VERSION
    scene["authoring_axis"] = "Blender Z-up; runtime glTF Y-up"
    scene["runtime_front"] = "+Z"
    scene["generator"] = str(SCRIPT_PATH.relative_to(REPO_ROOT))

    world = bpy.data.worlds.new("Thornvale_StageWorld")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.30, 0.46, 0.64, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.62
    scene.world = world

    bpy.ops.mesh.primitive_plane_add(size=24.0, location=(0.0, 0.0, -0.025))
    floor = bpy.context.object
    floor.name = "STAGING_ONLY_Meadow"
    move_to_collection(floor, stage_collection)
    floor.data.materials.append(mat["stage_grass"])

    camera_data = bpy.data.cameras.new("STAGING_ONLY_Camera")
    camera = bpy.data.objects.new("STAGING_ONLY_Camera", camera_data)
    stage_collection.objects.link(camera)
    camera.location = (8.7, -18.5, 7.6)
    camera.data.lens = 54.0
    point_camera(camera, (0.0, 0.0, 1.25))
    scene.camera = camera

    key_data = bpy.data.lights.new("STAGING_ONLY_Key", type="AREA")
    key_data.energy = 1250.0
    key_data.shape = "DISK"
    key_data.size = 7.0
    key = bpy.data.objects.new("STAGING_ONLY_Key", key_data)
    stage_collection.objects.link(key)
    key.location = (-4.5, -6.0, 10.0)
    point_camera(key, (0.0, 0.0, 1.1))

    fill_data = bpy.data.lights.new("STAGING_ONLY_Fill", type="AREA")
    fill_data.energy = 850.0
    fill_data.color = (0.63, 0.76, 1.0)
    fill_data.size = 6.0
    fill = bpy.data.objects.new("STAGING_ONLY_Fill", fill_data)
    stage_collection.objects.link(fill)
    fill.location = (7.0, 4.0, 7.0)
    point_camera(fill, (1.5, 0.0, 1.2))

    sun_data = bpy.data.lights.new("STAGING_ONLY_Sun", type="SUN")
    sun_data.energy = 1.7
    sun_data.angle = math.radians(22.0)
    sun = bpy.data.objects.new("STAGING_ONLY_Sun", sun_data)
    stage_collection.objects.link(sun)
    sun.rotation_euler = (math.radians(28.0), math.radians(-18.0), math.radians(-32.0))


def collect_export_objects(roots: list[bpy.types.Object]) -> list[bpy.types.Object]:
    objects: list[bpy.types.Object] = []
    for root in roots:
        objects.append(root)
        objects.extend(root.children_recursive)
    return objects


def export_runtime_glb(roots: list[bpy.types.Object]) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in collect_export_objects(roots):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = roots[0]
    bpy.ops.export_scene.gltf(
        filepath=str(GLB_PATH),
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
        export_draco_mesh_compression_enable=False,
        export_shared_accessors=True,
        export_copyright="Original Thornvale village dressing; generated in-repository",
    )


def parse_glb_json(path: Path) -> dict:
    with path.open("rb") as handle:
        magic, version, _length = struct.unpack("<4sII", handle.read(12))
        if magic != b"glTF" or version != 2:
            raise RuntimeError(f"Unexpected GLB header in {path}")
        chunk_length, chunk_type = struct.unpack("<II", handle.read(8))
        if chunk_type != 0x4E4F534A:
            raise RuntimeError(f"First GLB chunk is not JSON in {path}")
        return json.loads(handle.read(chunk_length).decode("utf-8").rstrip(" \t\r\n\0"))


def verify_and_report() -> None:
    expected_stage_locations = {
        "VillageWayfinder": Vector((-5.2, 0.0, 0.0)),
        "GardenArch": Vector((0.0, 0.0, 0.0)),
        "StoneWell": Vector((5.2, 0.0, 0.0)),
    }
    for root_name, expected_location in expected_stage_locations.items():
        root = bpy.data.objects.get(root_name)
        if root is None or (root.location - expected_location).length > 1e-6:
            raise RuntimeError(f"Unexpected source root transform for {root_name}")
        for child in root.children:
            if child.location.length > 1e-6 or any(abs(angle) > 1e-6 for angle in child.rotation_euler):
                raise RuntimeError(f"Child transform was not baked into root-local geometry: {child.name}")
            if any(abs(component - 1.0) > 1e-6 for component in child.scale):
                raise RuntimeError(f"Child scale was not applied: {child.name}")

    document = parse_glb_json(GLB_PATH)
    scene_index = document.get("scene", 0)
    root_indices = document["scenes"][scene_index].get("nodes", [])
    exported_roots = [document["nodes"][index].get("name") for index in root_indices]
    if len(exported_roots) != len(ROOT_NAMES) or set(exported_roots) != set(ROOT_NAMES):
        raise RuntimeError(f"Expected roots {ROOT_NAMES}, found {exported_roots}")
    if document.get("images") or document.get("textures"):
        raise RuntimeError("Village dressing GLB unexpectedly contains external texture/image data")
    for index in root_indices:
        root_node = document["nodes"][index]
        if not root_node.get("children"):
            raise RuntimeError(f"Exported root {root_node.get('name')} has no child meshes")

    mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.name.startswith(ROOT_NAMES)]
    vertices = sum(len(obj.data.vertices) for obj in mesh_objects)
    triangles = 0
    for obj in mesh_objects:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    summary = {
        "blend": str(BLEND_PATH.relative_to(REPO_ROOT)),
        "preview": str(PREVIEW_PATH.relative_to(REPO_ROOT)),
        "glb": str(GLB_PATH.relative_to(REPO_ROOT)),
        "root_nodes": exported_roots,
        "nodes": len(document.get("nodes", [])),
        "meshes": len(document.get("meshes", [])),
        "materials": len(document.get("materials", [])),
        "vertices": vertices,
        "triangles": triangles,
        "textures": len(document.get("textures", [])),
        "glb_bytes": GLB_PATH.stat().st_size,
    }
    print("VILLAGE_DRESSING_SUMMARY " + json.dumps(summary, sort_keys=True))


def main() -> None:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    clean_scene()
    # The generated .blend is replaceable output; do not accumulate Blender's
    # numbered save-version backups on deterministic rebuilds.
    bpy.context.preferences.filepaths.save_version = 0
    export_collection = new_collection("VillageDressing_EXPORT")
    stage_collection = new_collection("STAGING_ONLY")
    materials = build_materials()

    roots = [
        build_wayfinder(export_collection, materials),
        build_garden_arch(export_collection, materials),
        build_stone_well(export_collection, materials),
    ]
    for root in roots:
        consolidate_root(root)
    setup_stage(stage_collection, materials)

    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=True)
    bpy.ops.render.render(write_still=True)
    export_runtime_glb(roots)
    verify_and_report()


if __name__ == "__main__":
    main()
