#!/usr/bin/env python3
"""Build Thornvale's deterministic low-poly cottage kit in Blender.

Run with Blender, not the system Python:

    /Applications/Blender-4.5-LTS.app/Contents/MacOS/Blender \
      --background --factory-startup \
      --python scripts/build-town-cottages.py -- \
      --source assets-src/town-cottages/thornvale-cottages.blend \
      --output public/town/cottages/thornvale-cottages.glb

The editable .blend keeps the four cottage roots staged apart. During GLB
export the roots are temporarily moved to the origin, so a runtime can select a
named top-level root and place it directly without compensating for staging.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import struct
import sys
from collections import defaultdict
from pathlib import Path

import bpy
from mathutils import Vector


EXPECTED_ROOTS = (
    "Cottage_berry_bakery",
    "Cottage_lavender_library",
    "Cottage_mint_tea_house",
    "Cottage_rose_post_office",
)

STAGE_POSITIONS = {
    "Cottage_berry_bakery": (-11.0, -8.0, 0.0),
    "Cottage_lavender_library": (11.0, -8.0, 0.0),
    "Cottage_mint_tea_house": (-11.0, 8.0, 0.0),
    "Cottage_rose_post_office": (11.0, 8.0, 0.0),
}

# Values mirror the runtime TOWN_PALETTE. Blender's glTF exporter performs the
# required color-space conversion for material factors.
MATERIAL_SPECS = {
    "MAT_Wall_Cream": (0xFFF3DD, 0.86, 0.0),
    "MAT_Wall_Vanilla": (0xFFE8B7, 0.86, 0.0),
    "MAT_Wall_Mint": (0x9FD7BD, 0.88, 0.0),
    "MAT_Wall_Blush": (0xF5A9B8, 0.86, 0.0),
    "MAT_Roof_Blush": (0xF5A9B8, 0.78, 0.0),
    "MAT_Roof_Lavender": (0xB9A5DB, 0.78, 0.0),
    "MAT_Roof_Coral": (0xEF8A76, 0.78, 0.0),
    "MAT_Roof_Periwinkle": (0x93A7DF, 0.78, 0.0),
    "MAT_Trim_Cream": (0xFFF3DD, 0.82, 0.0),
    "MAT_Accent_Mint": (0x9FD7BD, 0.82, 0.0),
    "MAT_Accent_Teal": (0x4F9F8F, 0.78, 0.0),
    "MAT_Accent_Lavender": (0xB9A5DB, 0.80, 0.0),
    "MAT_Accent_Vanilla": (0xFFE8B7, 0.80, 0.0),
    "MAT_Wood_Cocoa": (0x815F58, 0.90, 0.0),
    "MAT_Wood_DarkCocoa": (0x5F4648, 0.88, 0.0),
    "MAT_StoneLight": (0xEAD7CB, 0.96, 0.0),
    "MAT_Gold": (0xE6AD55, 0.42, 0.18),
    "MAT_Leaf": (0x4E9B62, 0.90, 0.0),
    "MAT_LeafLight": (0x75BD72, 0.90, 0.0),
    "MAT_Flower": (0xEE7F9D, 0.82, 0.0),
}


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        default="assets-src/town-cottages/thornvale-cottages.blend",
        help="Editable staged Blender output.",
    )
    parser.add_argument(
        "--output",
        default="public/town/cottages/thornvale-cottages.glb",
        help="Runtime GLB output.",
    )
    parser.add_argument(
        "--validate-only",
        metavar="GLB",
        help="Import an existing GLB into a clean scene and validate it.",
    )
    return parser.parse_args(argv)


def hex_color(value: int) -> tuple[float, float, float, float]:
    return (
        ((value >> 16) & 0xFF) / 255.0,
        ((value >> 8) & 0xFF) / 255.0,
        (value & 0xFF) / 255.0,
        1.0,
    )


def reset_scene() -> None:
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)


def configure_scene() -> None:
    scene = bpy.context.scene
    # Generated sources are reproducible; avoid leaving Blender's `.blend1`
    # backup beside the authoritative output on repeated builds.
    bpy.context.preferences.filepaths.save_version = 0
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.world.color = (0.055, 0.065, 0.10)
    scene["generator"] = "scripts/build-town-cottages.py"
    scene["asset_scale"] = "1 Blender unit = 1 meter"
    scene["runtime_front_axis"] = "+Z"
    scene["deterministic_seed"] = 713


def make_materials() -> dict[str, bpy.types.Material]:
    materials: dict[str, bpy.types.Material] = {}
    for name, (color_hex, roughness, metalness) in MATERIAL_SPECS.items():
        material = bpy.data.materials.new(name=name)
        material.use_nodes = True
        material.diffuse_color = hex_color(color_hex)
        material.metallic = metalness
        material.roughness = roughness
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = hex_color(color_hex)
            bsdf.inputs["Roughness"].default_value = roughness
            bsdf.inputs["Metallic"].default_value = metalness
        materials[name] = material

    glow = bpy.data.materials.new(name="MAT_WindowGlow")
    glow.use_nodes = True
    glow.diffuse_color = hex_color(0xFFDC83)
    glow.roughness = 0.35
    bsdf = glow.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = hex_color(0xFFDC83)
        bsdf.inputs["Roughness"].default_value = 0.35
        emission_input = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if emission_input:
            emission_input.default_value = hex_color(0xFFB956)
        strength_input = bsdf.inputs.get("Emission Strength")
        if strength_input:
            strength_input.default_value = 1.45
    glow["runtime_role"] = "window_glow"
    glow["day_emissive_intensity"] = 0.18
    glow["night_emissive_intensity"] = 2.8
    materials[glow.name] = glow
    return materials


def activate(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def assign_material(obj: bpy.types.Object, material: bpy.types.Material) -> None:
    obj.data.materials.clear()
    obj.data.materials.append(material)


def apply_bevel(obj: bpy.types.Object, width: float, segments: int = 2) -> None:
    if width <= 0:
        return
    activate(obj)
    modifier = obj.modifiers.new(name="Soft_storybook_edges", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    modifier.angle_limit = math.radians(28.0)
    modifier.harden_normals = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def smooth_mesh(obj: bpy.types.Object) -> None:
    if obj.type != "MESH":
        return
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def add_box(
    root: bpy.types.Object,
    name: str,
    dimensions: tuple[float, float, float],
    location: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.055,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    apply_bevel(obj, min(bevel, min(dimensions) * 0.28))
    obj.parent = root
    return obj


def add_cylinder(
    root: bpy.types.Object,
    name: str,
    radius: float,
    depth: float,
    location: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    vertices: int = 12,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
    bevel: float = 0.025,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    assign_material(obj, material)
    if bevel:
        apply_bevel(obj, min(bevel, radius * 0.24, depth * 0.12))
    smooth_mesh(obj)
    obj.parent = root
    return obj


def add_sphere(
    root: bpy.types.Object,
    name: str,
    scale: tuple[float, float, float],
    location: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    segments: int = 12,
    rings: int = 8,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        radius=1.0,
        location=location,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    activate(obj)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    smooth_mesh(obj)
    obj.parent = root
    return obj


def add_cross_section_prism(
    root: bpy.types.Object,
    name: str,
    cross_section: list[tuple[float, float]],
    depth: float,
    base_z: float,
    material: bpy.types.Material,
    *,
    center_y: float = 0.0,
    bevel: float = 0.065,
) -> bpy.types.Object:
    """Extrude an X/Z cross-section through Y to make a solid storybook roof."""
    half_depth = depth * 0.5
    vertices = [
        (x, center_y - half_depth, base_z + z) for x, z in cross_section
    ] + [
        (x, center_y + half_depth, base_z + z) for x, z in cross_section
    ]
    count = len(cross_section)
    faces: list[tuple[int, ...]] = [
        tuple(range(count)),
        tuple(range(count, count * 2))[::-1],
    ]
    for index in range(count - 1):
        faces.append((index, index + count, index + count + 1, index + 1))
    faces.append((count - 1, count * 2 - 1, count, 0))

    mesh = bpy.data.meshes.new(name=f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name=name, object_data=mesh)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, material)
    apply_bevel(obj, bevel)
    obj.parent = root
    return obj


def add_gable_roof(
    root: bpy.types.Object,
    name: str,
    width: float,
    depth: float,
    base_z: float,
    height: float,
    material: bpy.types.Material,
    *,
    center_y: float = 0.0,
) -> bpy.types.Object:
    return add_cross_section_prism(
        root,
        name,
        [(-width * 0.5, 0.0), (0.0, height), (width * 0.5, 0.0)],
        depth,
        base_z,
        material,
        center_y=center_y,
        bevel=0.07,
    )


def add_curved_eave_roof(
    root: bpy.types.Object,
    name: str,
    width: float,
    depth: float,
    base_z: float,
    height: float,
    material: bpy.types.Material,
    *,
    center_y: float = 0.0,
) -> bpy.types.Object:
    curl = min(0.42, width * 0.09)
    return add_cross_section_prism(
        root,
        name,
        [
            (-width * 0.5, 0.22),
            (-width * 0.5 + curl, 0.0),
            (0.0, height),
            (width * 0.5 - curl, 0.0),
            (width * 0.5, 0.22),
        ],
        depth,
        base_z,
        material,
        center_y=center_y,
        bevel=0.065,
    )


def add_root(
    name: str,
    footprint: tuple[float, float],
    wall_height: float,
) -> bpy.types.Object:
    root = bpy.data.objects.new(name=name, object_data=None)
    bpy.context.collection.objects.link(root)
    root.empty_display_type = "CUBE"
    root.empty_display_size = 0.5
    root["asset_id"] = name.removeprefix("Cottage_")
    root["footprint_width_m"] = footprint[0]
    root["footprint_depth_m"] = footprint[1]
    root["wall_height_m"] = wall_height
    root["runtime_front_axis"] = "+Z"
    root["source_front_axis_blender"] = "-Y"
    root["runtime_reset"] = "Set root position to (0, 0, 0), scale to 1"
    return root


def add_foundation_and_corners(
    root: bpy.types.Object,
    prefix: str,
    width: float,
    depth: float,
    wall_height: float,
    mats: dict[str, bpy.types.Material],
) -> float:
    base_z = 0.24
    add_box(
        root,
        f"{prefix}_Foundation",
        (width + 0.34, depth + 0.34, 0.34),
        (0.0, 0.0, 0.17),
        mats["MAT_StoneLight"],
        bevel=0.09,
    )
    for x in (-width * 0.5 + 0.08, width * 0.5 - 0.08):
        for y in (-depth * 0.5 + 0.08, depth * 0.5 - 0.08):
            add_box(
                root,
                f"{prefix}_Corner_{x:+.2f}_{y:+.2f}",
                (0.19, 0.19, wall_height),
                (x, y, base_z + wall_height * 0.5),
                mats["MAT_Trim_Cream"],
                bevel=0.035,
            )
    return base_z


def add_front_window(
    root: bpy.types.Object,
    prefix: str,
    x: float,
    z: float,
    front_y: float,
    mats: dict[str, bpy.types.Material],
    *,
    width: float = 0.88,
    height: float = 1.02,
) -> None:
    # Pane sits behind the raised trim while remaining just outside the wall.
    add_box(
        root,
        f"{prefix}_Pane",
        (width, 0.055, height),
        (x, front_y - 0.035, z),
        mats["MAT_WindowGlow"],
        bevel=0.085,
    )
    trim_y = front_y - 0.085
    for frame_x in (x - width * 0.54, x + width * 0.54):
        add_box(
            root,
            f"{prefix}_FrameV_{frame_x:+.2f}",
            (0.085, 0.105, height + 0.20),
            (frame_x, trim_y, z),
            mats["MAT_Trim_Cream"],
            bevel=0.025,
        )
    for frame_z in (z - height * 0.54, z + height * 0.54):
        add_box(
            root,
            f"{prefix}_FrameH_{frame_z:+.2f}",
            (width + 0.20, 0.105, 0.085),
            (x, trim_y, frame_z),
            mats["MAT_Trim_Cream"],
            bevel=0.025,
        )
    add_box(
        root,
        f"{prefix}_MullionV",
        (0.055, 0.11, height * 0.86),
        (x, trim_y - 0.006, z),
        mats["MAT_Trim_Cream"],
        bevel=0.016,
    )
    add_box(
        root,
        f"{prefix}_MullionH",
        (width * 0.86, 0.11, 0.055),
        (x, trim_y - 0.006, z),
        mats["MAT_Trim_Cream"],
        bevel=0.016,
    )
    add_box(
        root,
        f"{prefix}_Sill",
        (width + 0.34, 0.22, 0.10),
        (x, trim_y - 0.02, z - height * 0.60),
        mats["MAT_StoneLight"],
        bevel=0.035,
    )


def add_side_window(
    root: bpy.types.Object,
    prefix: str,
    side_x: float,
    y: float,
    z: float,
    mats: dict[str, bpy.types.Material],
    *,
    width: float = 0.78,
    height: float = 0.94,
) -> None:
    outward = -1.0 if side_x < 0 else 1.0
    pane_x = side_x + outward * 0.035
    trim_x = side_x + outward * 0.085
    add_box(
        root,
        f"{prefix}_Pane",
        (0.055, width, height),
        (pane_x, y, z),
        mats["MAT_WindowGlow"],
        bevel=0.075,
    )
    for frame_y in (y - width * 0.54, y + width * 0.54):
        add_box(
            root,
            f"{prefix}_FrameY_{frame_y:+.2f}",
            (0.105, 0.085, height + 0.18),
            (trim_x, frame_y, z),
            mats["MAT_Trim_Cream"],
            bevel=0.022,
        )
    for frame_z in (z - height * 0.54, z + height * 0.54):
        add_box(
            root,
            f"{prefix}_FrameZ_{frame_z:+.2f}",
            (0.105, width + 0.18, 0.085),
            (trim_x, y, frame_z),
            mats["MAT_Trim_Cream"],
            bevel=0.022,
        )
    add_box(
        root,
        f"{prefix}_Mullion",
        (0.11, 0.052, height * 0.84),
        (trim_x + outward * 0.004, y, z),
        mats["MAT_Trim_Cream"],
        bevel=0.014,
    )


def add_door(
    root: bpy.types.Object,
    prefix: str,
    x: float,
    front_y: float,
    base_z: float,
    mats: dict[str, bpy.types.Material],
    door_material: str,
    *,
    width: float = 1.0,
    height: float = 1.88,
) -> None:
    add_box(
        root,
        f"{prefix}_Door",
        (width, 0.14, height),
        (x, front_y - 0.075, base_z + height * 0.5),
        mats[door_material],
        bevel=0.10,
    )
    trim_y = front_y - 0.14
    for frame_x in (x - width * 0.60, x + width * 0.60):
        add_box(
            root,
            f"{prefix}_DoorFrame_{frame_x:+.2f}",
            (0.12, 0.16, height + 0.22),
            (frame_x, trim_y, base_z + height * 0.5),
            mats["MAT_Trim_Cream"],
            bevel=0.035,
        )
    add_box(
        root,
        f"{prefix}_DoorLintel",
        (width + 0.34, 0.16, 0.12),
        (x, trim_y, base_z + height + 0.10),
        mats["MAT_Trim_Cream"],
        bevel=0.035,
    )
    add_sphere(
        root,
        f"{prefix}_DoorKnob",
        (0.075, 0.075, 0.075),
        (x + width * 0.29, front_y - 0.19, base_z + height * 0.52),
        mats["MAT_Gold"],
    )
    add_box(
        root,
        f"{prefix}_DoorStep",
        (width + 0.52, 0.58, 0.18),
        (x, front_y - 0.34, 0.09),
        mats["MAT_StoneLight"],
        bevel=0.07,
    )


def add_flower_box(
    root: bpy.types.Object,
    prefix: str,
    x: float,
    front_y: float,
    z: float,
    mats: dict[str, bpy.types.Material],
    flower_material: str,
) -> None:
    add_box(
        root,
        f"{prefix}_Planter",
        (1.18, 0.30, 0.23),
        (x, front_y - 0.19, z),
        mats["MAT_Wood_Cocoa"],
        bevel=0.055,
    )
    for index, flower_x in enumerate((-0.42, -0.20, 0.0, 0.22, 0.43)):
        add_cylinder(
            root,
            f"{prefix}_Stem_{index}",
            0.022,
            0.28 + (index % 2) * 0.06,
            (x + flower_x, front_y - 0.20, z + 0.23),
            mats["MAT_Leaf"],
            vertices=7,
            bevel=0.0,
        )
        add_sphere(
            root,
            f"{prefix}_Bloom_{index}",
            (0.09, 0.075, 0.08),
            (x + flower_x, front_y - 0.20, z + 0.39 + (index % 2) * 0.06),
            mats[flower_material if index % 2 == 0 else "MAT_Accent_Vanilla"],
            segments=8,
            rings=6,
        )


def add_hanging_sign_support(
    root: bpy.types.Object,
    prefix: str,
    location: tuple[float, float, float],
    mats: dict[str, bpy.types.Material],
) -> None:
    x, y, z = location
    add_box(
        root,
        f"{prefix}_SignPost",
        (0.12, 0.12, 1.32),
        (x, y, z),
        mats["MAT_Wood_DarkCocoa"],
        bevel=0.035,
    )
    add_box(
        root,
        f"{prefix}_SignArm",
        (0.86, 0.12, 0.12),
        (x - 0.36, y, z + 0.60),
        mats["MAT_Wood_DarkCocoa"],
        bevel=0.035,
    )
    for chain_x in (x - 0.18, x - 0.58):
        add_cylinder(
            root,
            f"{prefix}_SignChain_{chain_x:+.2f}",
            0.018,
            0.32,
            (chain_x, y, z + 0.34),
            mats["MAT_Gold"],
            vertices=8,
            bevel=0.0,
        )


def add_round_sign(
    root: bpy.types.Object,
    prefix: str,
    location: tuple[float, float, float],
    mats: dict[str, bpy.types.Material],
    sign_material: str,
) -> None:
    add_cylinder(
        root,
        f"{prefix}_SignBoard",
        0.42,
        0.12,
        location,
        mats[sign_material],
        vertices=16,
        rotation=(math.radians(90.0), 0.0, 0.0),
        bevel=0.035,
    )


def add_roof_ridge_beads(
    root: bpy.types.Object,
    prefix: str,
    depth: float,
    ridge_z: float,
    mats: dict[str, bpy.types.Material],
    material_name: str,
) -> None:
    add_cylinder(
        root,
        f"{prefix}_Ridge",
        0.11,
        depth,
        (0.0, 0.0, ridge_z),
        mats[material_name],
        vertices=10,
        rotation=(math.radians(90.0), 0.0, 0.0),
        bevel=0.02,
    )
    for y in (-depth * 0.48, depth * 0.48):
        add_sphere(
            root,
            f"{prefix}_RidgeCharm_{y:+.2f}",
            (0.16, 0.16, 0.16),
            (0.0, y, ridge_z),
            mats["MAT_Gold"],
            segments=10,
            rings=7,
        )


def build_bakery(mats: dict[str, bpy.types.Material]) -> bpy.types.Object:
    root = add_root("Cottage_berry_bakery", (6.0, 4.5), 3.2)
    prefix = "Bakery"
    width, depth, wall_height = 6.0, 4.5, 3.2
    base_z = add_foundation_and_corners(root, prefix, width, depth, wall_height, mats)
    add_box(
        root,
        f"{prefix}_Wall",
        (width, depth, wall_height),
        (0.0, 0.0, base_z + wall_height * 0.5),
        mats["MAT_Wall_Cream"],
        bevel=0.11,
    )
    roof_base = base_z + wall_height
    add_gable_roof(
        root,
        f"{prefix}_Roof",
        6.82,
        5.25,
        roof_base,
        1.58,
        mats["MAT_Roof_Blush"],
    )
    add_roof_ridge_beads(root, prefix, 5.10, roof_base + 1.59, mats, "MAT_Trim_Cream")

    front_y = -depth * 0.5
    add_door(root, prefix, 0.0, front_y, base_z, mats, "MAT_Accent_Mint")
    for index, x in enumerate((-1.62, 1.62)):
        add_front_window(root, f"{prefix}_FrontWindow{index}", x, 1.77, front_y, mats)
        add_flower_box(
            root,
            f"{prefix}_FlowerBox{index}",
            x,
            front_y,
            1.10,
            mats,
            "MAT_Flower",
        )
    add_side_window(root, f"{prefix}_SideWindowL", -width * 0.5, 0.2, 1.72, mats)
    add_side_window(root, f"{prefix}_SideWindowR", width * 0.5, 0.2, 1.72, mats)

    # Wide berry-striped awning with a slightly dropped front edge.
    awning_y = front_y - 0.48
    add_box(
        root,
        f"{prefix}_Awning",
        (4.65, 1.10, 0.14),
        (0.0, awning_y, 2.42),
        mats["MAT_Roof_Blush"],
        rotation=(math.radians(11.0), 0.0, 0.0),
        bevel=0.055,
    )
    for index, x in enumerate((-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0)):
        add_sphere(
            root,
            f"{prefix}_AwningScallop{index}",
            (0.28, 0.12, 0.16),
            (x, front_y - 1.01, 2.29),
            mats["MAT_Roof_Blush" if index % 2 == 0 else "MAT_Accent_Vanilla"],
            segments=10,
            rings=7,
        )

    # Oversized oven chimney gives the bakery its unmistakable silhouette.
    add_box(
        root,
        f"{prefix}_Chimney",
        (0.68, 0.70, 2.05),
        (-1.92, 0.76, roof_base + 0.92),
        mats["MAT_Wood_DarkCocoa"],
        bevel=0.08,
    )
    add_box(
        root,
        f"{prefix}_ChimneyCap",
        (0.90, 0.92, 0.22),
        (-1.92, 0.76, roof_base + 1.98),
        mats["MAT_Trim_Cream"],
        bevel=0.07,
    )
    for band_z in (roof_base + 0.30, roof_base + 0.82, roof_base + 1.34):
        add_box(
            root,
            f"{prefix}_ChimneyBand_{band_z:.2f}",
            (0.74, 0.76, 0.09),
            (-1.92, 0.76, band_z),
            mats["MAT_Roof_Blush"],
            bevel=0.025,
        )

    sign_x, sign_y, sign_z = 2.82, front_y - 0.34, 2.18
    add_hanging_sign_support(root, prefix, (sign_x, sign_y, sign_z), mats)
    add_round_sign(root, prefix, (sign_x - 0.38, sign_y - 0.07, sign_z + 0.03), mats, "MAT_Accent_Mint")
    # Three warm loaves read as a bread crest without requiring a texture.
    for index, loaf_x in enumerate((-0.20, 0.0, 0.20)):
        add_sphere(
            root,
            f"{prefix}_BreadIcon{index}",
            (0.13, 0.07, 0.22),
            (sign_x - 0.38 + loaf_x, sign_y - 0.15, sign_z + 0.03),
            mats["MAT_Accent_Vanilla"],
            segments=10,
            rings=7,
        )
    return root


def build_library(mats: dict[str, bpy.types.Material]) -> bpy.types.Object:
    root = add_root("Cottage_lavender_library", (5.0, 6.0), 4.0)
    prefix = "Library"
    width, depth, wall_height = 5.0, 6.0, 4.0
    base_z = add_foundation_and_corners(root, prefix, width, depth, wall_height, mats)
    add_box(
        root,
        f"{prefix}_Wall",
        (width, depth, wall_height),
        (0.0, 0.0, base_z + wall_height * 0.5),
        mats["MAT_Wall_Vanilla"],
        bevel=0.105,
    )
    roof_base = base_z + wall_height
    add_gable_roof(
        root,
        f"{prefix}_Roof",
        5.76,
        6.76,
        roof_base,
        1.82,
        mats["MAT_Roof_Lavender"],
    )
    add_roof_ridge_beads(root, prefix, 6.58, roof_base + 1.83, mats, "MAT_Trim_Cream")

    front_y = -depth * 0.5
    add_door(root, prefix, 0.0, front_y, base_z, mats, "MAT_Accent_Teal", height=2.02)
    for index, x in enumerate((-1.42, 1.42)):
        add_front_window(
            root,
            f"{prefix}_TallWindow{index}",
            x,
            1.78,
            front_y,
            mats,
            width=0.82,
            height=1.28,
        )
    add_side_window(root, f"{prefix}_SideWindowL", -width * 0.5, -0.2, 2.08, mats, height=1.18)
    add_side_window(root, f"{prefix}_SideWindowR", width * 0.5, -0.2, 2.08, mats, height=1.18)

    # A full dormer makes the library taller and more vertical than its neighbors.
    dormer_y = front_y - 0.28
    add_box(
        root,
        f"{prefix}_DormerWall",
        (1.74, 0.84, 1.08),
        (0.0, dormer_y, roof_base + 0.54),
        mats["MAT_Wall_Vanilla"],
        bevel=0.075,
    )
    add_gable_roof(
        root,
        f"{prefix}_DormerRoof",
        2.04,
        1.22,
        roof_base + 1.05,
        0.70,
        mats["MAT_Roof_Lavender"],
        center_y=dormer_y - 0.08,
    )
    add_front_window(
        root,
        f"{prefix}_DormerWindow",
        0.0,
        roof_base + 0.59,
        dormer_y - 0.43,
        mats,
        width=0.72,
        height=0.74,
    )

    # Hanging open-book sign: teal covers, cream pages, gold hinge.
    sign_x, sign_y, sign_z = -2.30, front_y - 0.34, 2.56
    add_hanging_sign_support(root, prefix, (sign_x, sign_y, sign_z), mats)
    for page_x, angle in ((-0.16, -0.14), (0.16, 0.14)):
        add_box(
            root,
            f"{prefix}_BookPage_{page_x:+.2f}",
            (0.32, 0.08, 0.48),
            (sign_x - 0.37 + page_x, sign_y - 0.08, sign_z + 0.04),
            mats["MAT_Accent_Vanilla"],
            rotation=(0.0, angle, 0.0),
            bevel=0.045,
        )
        add_box(
            root,
            f"{prefix}_BookCover_{page_x:+.2f}",
            (0.36, 0.06, 0.54),
            (sign_x - 0.37 + page_x, sign_y - 0.01, sign_z + 0.04),
            mats["MAT_Accent_Teal"],
            rotation=(0.0, angle, 0.0),
            bevel=0.045,
        )
    add_cylinder(
        root,
        f"{prefix}_BookHinge",
        0.035,
        0.48,
        (sign_x - 0.37, sign_y - 0.14, sign_z + 0.04),
        mats["MAT_Gold"],
        vertices=8,
        bevel=0.0,
    )
    return root


def build_tea_house(mats: dict[str, bpy.types.Material]) -> bpy.types.Object:
    root = add_root("Cottage_mint_tea_house", (4.0, 4.0), 2.8)
    prefix = "TeaHouse"
    width, depth, wall_height = 4.0, 4.0, 2.8
    base_z = add_foundation_and_corners(root, prefix, width, depth, wall_height, mats)
    add_box(
        root,
        f"{prefix}_Wall",
        (width, depth, wall_height),
        (0.0, 0.0, base_z + wall_height * 0.5),
        mats["MAT_Wall_Mint"],
        bevel=0.12,
    )
    roof_base = base_z + wall_height
    add_curved_eave_roof(
        root,
        f"{prefix}_MainRoof",
        5.25,
        5.10,
        roof_base,
        1.30,
        mats["MAT_Roof_Coral"],
    )
    add_roof_ridge_beads(root, prefix, 4.92, roof_base + 1.31, mats, "MAT_Trim_Cream")

    front_y = -depth * 0.5
    add_door(root, prefix, 0.0, front_y, base_z, mats, "MAT_Accent_Lavender", width=0.92)
    for index, x in enumerate((-1.12, 1.12)):
        add_front_window(
            root,
            f"{prefix}_FrontWindow{index}",
            x,
            1.58,
            front_y,
            mats,
            width=0.72,
            height=0.90,
        )
    add_side_window(root, f"{prefix}_SideWindowL", -width * 0.5, 0.15, 1.58, mats, width=0.68)
    add_side_window(root, f"{prefix}_SideWindowR", width * 0.5, 0.15, 1.58, mats, width=0.68)

    # Wide veranda and a second shallow curled canopy give the tea house its
    # layered, pavilion-like profile.
    veranda_y = front_y - 0.70
    add_box(
        root,
        f"{prefix}_VerandaDeck",
        (5.10, 1.65, 0.22),
        (0.0, veranda_y, 0.22),
        mats["MAT_Wood_Cocoa"],
        bevel=0.075,
    )
    for x in (-2.18, 2.18):
        add_cylinder(
            root,
            f"{prefix}_VerandaPost_{x:+.2f}",
            0.12,
            2.30,
            (x, front_y - 1.33, 1.35),
            mats["MAT_Wood_DarkCocoa"],
            vertices=10,
            bevel=0.025,
        )
        add_sphere(
            root,
            f"{prefix}_VerandaPostCap_{x:+.2f}",
            (0.17, 0.17, 0.17),
            (x, front_y - 1.33, 2.53),
            mats["MAT_Gold"],
            segments=10,
            rings=7,
        )
    add_curved_eave_roof(
        root,
        f"{prefix}_VerandaCanopy",
        5.26,
        1.76,
        2.46,
        0.52,
        mats["MAT_Roof_Coral"],
        center_y=front_y - 0.73,
    )

    # Side trellis, climbing leaves, and tea blossoms.
    trellis_x = width * 0.5 + 0.52
    for y in (-0.82, 0.0, 0.82):
        add_box(
            root,
            f"{prefix}_TrellisV_{y:+.2f}",
            (0.10, 0.10, 2.18),
            (trellis_x, y, 1.24),
            mats["MAT_Wood_Cocoa"],
            bevel=0.03,
        )
    for z in (0.64, 1.20, 1.76, 2.30):
        add_box(
            root,
            f"{prefix}_TrellisH_{z:.2f}",
            (0.10, 1.78, 0.10),
            (trellis_x, 0.0, z),
            mats["MAT_Wood_Cocoa"],
            bevel=0.03,
        )
    leaf_points = (
        (-0.72, 0.65),
        (-0.40, 1.04),
        (-0.08, 1.42),
        (0.26, 1.84),
        (0.62, 2.18),
    )
    for index, (y, z) in enumerate(leaf_points):
        add_sphere(
            root,
            f"{prefix}_TrellisLeaf{index}",
            (0.10, 0.28, 0.16),
            (trellis_x + 0.08, y, z),
            mats["MAT_Leaf" if index % 2 else "MAT_LeafLight"],
            segments=10,
            rings=7,
        )
        if index in (1, 3):
            add_sphere(
                root,
                f"{prefix}_TrellisBloom{index}",
                (0.11, 0.11, 0.11),
                (trellis_x + 0.17, y - 0.06, z + 0.08),
                mats["MAT_Flower"],
                segments=9,
                rings=6,
            )
    return root


def build_post_office(mats: dict[str, bpy.types.Material]) -> bpy.types.Object:
    root = add_root("Cottage_rose_post_office", (6.0, 5.0), 3.6)
    prefix = "PostOffice"
    width, depth, wall_height = 6.0, 5.0, 3.6
    base_z = add_foundation_and_corners(root, prefix, width, depth, wall_height, mats)
    add_box(
        root,
        f"{prefix}_Wall",
        (width, depth, wall_height),
        (0.0, 0.0, base_z + wall_height * 0.5),
        mats["MAT_Wall_Blush"],
        bevel=0.105,
    )
    roof_base = base_z + wall_height
    add_gable_roof(
        root,
        f"{prefix}_Roof",
        6.82,
        5.82,
        roof_base,
        1.52,
        mats["MAT_Roof_Periwinkle"],
    )
    add_roof_ridge_beads(root, prefix, 5.64, roof_base + 1.53, mats, "MAT_Trim_Cream")

    front_y = -depth * 0.5
    add_door(root, prefix, 0.0, front_y, base_z, mats, "MAT_Wood_DarkCocoa", height=1.96)
    for index, x in enumerate((-1.62, 1.62)):
        add_front_window(root, f"{prefix}_FrontWindow{index}", x, 1.78, front_y, mats)
    add_side_window(root, f"{prefix}_SideWindowL", -width * 0.5, 0.15, 1.78, mats)
    add_side_window(root, f"{prefix}_SideWindowR", width * 0.5, 0.15, 1.78, mats)

    # Covered porch with a lower roof and rounded posts.
    porch_y = front_y - 0.58
    add_box(
        root,
        f"{prefix}_PorchDeck",
        (5.34, 1.40, 0.20),
        (0.0, porch_y, 0.20),
        mats["MAT_Wood_Cocoa"],
        bevel=0.07,
    )
    for x in (-2.32, 2.32):
        add_cylinder(
            root,
            f"{prefix}_PorchPost_{x:+.2f}",
            0.13,
            2.38,
            (x, front_y - 1.08, 1.39),
            mats["MAT_Trim_Cream"],
            vertices=10,
            bevel=0.025,
        )
    add_gable_roof(
        root,
        f"{prefix}_PorchRoof",
        5.55,
        1.62,
        2.46,
        0.62,
        mats["MAT_Roof_Periwinkle"],
        center_y=front_y - 0.60,
    )

    # Functional mail slot with a soft gold surround.
    add_box(
        root,
        f"{prefix}_MailSlot",
        (0.52, 0.07, 0.14),
        (0.0, front_y - 0.17, 1.39),
        mats["MAT_Gold"],
        bevel=0.035,
    )
    add_box(
        root,
        f"{prefix}_MailSlotInset",
        (0.40, 0.075, 0.055),
        (0.0, front_y - 0.22, 1.39),
        mats["MAT_Wood_DarkCocoa"],
        bevel=0.016,
    )

    # Parcel bench and three deliberately uneven packages.
    bench_x, bench_y = 1.62, front_y - 1.10
    add_box(
        root,
        f"{prefix}_ParcelBenchSeat",
        (1.76, 0.55, 0.16),
        (bench_x, bench_y, 0.72),
        mats["MAT_Wood_Cocoa"],
        bevel=0.06,
    )
    for x in (bench_x - 0.62, bench_x + 0.62):
        add_box(
            root,
            f"{prefix}_ParcelBenchLeg_{x:+.2f}",
            (0.14, 0.42, 0.70),
            (x, bench_y, 0.38),
            mats["MAT_Wood_DarkCocoa"],
            bevel=0.035,
        )
    parcel_specs = (
        ((bench_x - 0.47, bench_y, 1.02), (0.54, 0.44, 0.46), -0.05),
        ((bench_x + 0.12, bench_y, 1.08), (0.48, 0.40, 0.58), 0.06),
        ((bench_x + 0.58, bench_y, 0.96), (0.40, 0.34, 0.34), -0.08),
    )
    for index, (location, dimensions, yaw) in enumerate(parcel_specs):
        add_box(
            root,
            f"{prefix}_Parcel{index}",
            dimensions,
            location,
            mats["MAT_Accent_Vanilla"],
            rotation=(0.0, 0.0, yaw),
            bevel=0.055,
        )
        add_box(
            root,
            f"{prefix}_ParcelRibbon{index}",
            (0.08, dimensions[1] + 0.03, dimensions[2] + 0.03),
            (location[0], location[1] - 0.01, location[2]),
            mats["MAT_Roof_Periwinkle"],
            rotation=(0.0, 0.0, yaw),
            bevel=0.016,
        )

    # Envelope crest mounted below the porch ridge.
    sign_z = 2.62
    add_box(
        root,
        f"{prefix}_Envelope",
        (0.92, 0.09, 0.62),
        (-1.36, front_y - 1.44, sign_z),
        mats["MAT_Accent_Vanilla"],
        bevel=0.08,
    )
    for offset, angle in ((-0.22, -0.58), (0.22, 0.58)):
        add_box(
            root,
            f"{prefix}_EnvelopeFold_{offset:+.2f}",
            (0.52, 0.055, 0.075),
            (-1.36 + offset, front_y - 1.50, sign_z + 0.04),
            mats["MAT_Gold"],
            rotation=(0.0, angle, 0.0),
            bevel=0.018,
        )
    return root


def mesh_descendants(root: bpy.types.Object) -> list[bpy.types.Object]:
    result: list[bpy.types.Object] = []
    stack = list(root.children)
    while stack:
        child = stack.pop()
        stack.extend(child.children)
        if child.type == "MESH":
            result.append(child)
    return result


def safe_component(value: str) -> str:
    clean = value.removeprefix("MAT_")
    return "_".join(part for part in clean.replace("-", "_").split("_") if part)


def merge_by_material(root: bpy.types.Object) -> None:
    groups: dict[str, list[bpy.types.Object]] = defaultdict(list)
    for obj in mesh_descendants(root):
        material_name = obj.data.materials[0].name if obj.data.materials else "NoMaterial"
        groups[material_name].append(obj)

    for material_name in sorted(groups):
        objects = sorted(groups[material_name], key=lambda item: item.name)
        vertices: list[tuple[float, float, float]] = []
        triangles: list[tuple[int, int, int]] = []

        # Concatenate source meshes explicitly in lexical object-name order.
        # bpy.ops.object.join() follows internal selection order, which can vary
        # between headless sessions even when scene content is identical.
        for obj in objects:
            offset = len(vertices)
            transform = obj.matrix_local.copy()
            vertices.extend(tuple(transform @ vertex.co) for vertex in obj.data.vertices)
            for polygon in obj.data.polygons:
                indices = [offset + index for index in polygon.vertices]
                if len(indices) == 3:
                    triangles.append(tuple(indices))
                else:
                    # Fixed fan triangulation is sufficient for the simple,
                    # convex storybook primitives and authored roof profiles.
                    triangles.extend(
                        (indices[0], indices[index], indices[index + 1])
                        for index in range(1, len(indices) - 1)
                    )

        merged_name = f"{root.name}__{safe_component(material_name)}"
        merged_mesh = bpy.data.meshes.new(name=f"{merged_name}_Mesh")
        merged_mesh.from_pydata(vertices, [], triangles)
        merged_mesh.update(calc_edges=True)
        merged = bpy.data.objects.new(name=merged_name, object_data=merged_mesh)
        bpy.context.collection.objects.link(merged)
        merged.parent = root
        assign_material(merged, bpy.data.materials[material_name])
        for polygon in merged.data.polygons:
            polygon.use_smooth = True

        for obj in objects:
            old_mesh = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            if old_mesh.users == 0:
                bpy.data.meshes.remove(old_mesh)


def stage_roots(roots: list[bpy.types.Object]) -> None:
    for root in roots:
        root.location = STAGE_POSITIONS[root.name]
        root.rotation_euler = (0.0, 0.0, 0.0)
        root.scale = (1.0, 1.0, 1.0)
        root["source_stage_position"] = tuple(round(value, 3) for value in root.location)


def save_source(source_path: Path, roots: list[bpy.types.Object]) -> None:
    source_path.parent.mkdir(parents=True, exist_ok=True)
    stage_roots(roots)
    bpy.context.scene["cottage_roots"] = ",".join(root.name for root in roots)
    bpy.ops.wm.save_as_mainfile(filepath=str(source_path), compress=True)


def export_runtime(output_path: Path, roots: list[bpy.types.Object]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    staged_locations = {root.name: root.location.copy() for root in roots}
    try:
        for root in roots:
            root.location = (0.0, 0.0, 0.0)
            root.rotation_euler = (0.0, 0.0, 0.0)
            root.scale = (1.0, 1.0, 1.0)
        bpy.context.view_layer.update()
        bpy.ops.export_scene.gltf(
            filepath=str(output_path),
            export_format="GLB",
            use_selection=False,
            export_yup=True,
            export_apply=True,
            export_extras=True,
            export_cameras=False,
            export_lights=False,
            export_animations=False,
            export_materials="EXPORT",
            # The kit has no textures. Omitting generated UV attributes keeps
            # repeated headless exports byte-stable across Blender sessions.
            export_texcoords=False,
            export_normals=True,
            export_tangents=False,
        )
        canonicalize_glb_triangle_order(output_path)
    finally:
        for root in roots:
            root.location = staged_locations[root.name]
        bpy.context.view_layer.update()


def canonicalize_glb_triangle_order(glb_path: Path) -> None:
    """Make the Blender GLB byte-stable without changing rendered geometry.

    Blender 4.5 emits stable vertices and normals but may enumerate disconnected
    triangles in a different order between processes. Canonical cyclic rotation
    plus lexical triangle sorting preserves winding while stabilizing each index
    accessor in place. JSON and buffer sizes remain unchanged.
    """
    data = glb_path.read_bytes()
    magic, version, declared_length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or declared_length != len(data):
        raise RuntimeError(f"Unexpected GLB header in {glb_path}")

    json_length, json_type = struct.unpack_from("<II", data, 12)
    if json_type != 0x4E4F534A:
        raise RuntimeError(f"Missing JSON chunk in {glb_path}")
    json_start = 20
    document = json.loads(data[json_start : json_start + json_length].decode("utf-8").rstrip(" \t\r\n\0"))

    bin_header = json_start + json_length
    bin_length, bin_type = struct.unpack_from("<II", data, bin_header)
    if bin_type != 0x004E4942:
        raise RuntimeError(f"Missing BIN chunk in {glb_path}")
    bin_start = bin_header + 8
    binary = bytearray(data[bin_start : bin_start + bin_length])

    formats = {5121: "B", 5123: "H", 5125: "I"}
    processed: set[int] = set()
    for mesh in document.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4 or "indices" not in primitive:
                continue
            accessor_index = primitive["indices"]
            if accessor_index in processed:
                continue
            processed.add(accessor_index)
            accessor = document["accessors"][accessor_index]
            if accessor.get("type") != "SCALAR" or accessor["count"] % 3:
                raise RuntimeError(f"Non-triangle index accessor {accessor_index}")
            component_type = accessor["componentType"]
            format_code = formats.get(component_type)
            if not format_code:
                raise RuntimeError(f"Unsupported index component type {component_type}")
            view = document["bufferViews"][accessor["bufferView"]]
            offset = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
            count = accessor["count"]
            values = struct.unpack_from(f"<{count}{format_code}", binary, offset)
            triangles = []
            for index in range(0, count, 3):
                a, b, c = values[index : index + 3]
                triangles.append(min((a, b, c), (b, c, a), (c, a, b)))
            canonical = [value for triangle in sorted(triangles) for value in triangle]
            struct.pack_into(f"<{count}{format_code}", binary, offset, *canonical)

    glb_path.write_bytes(
        data[:bin_start] + bytes(binary) + data[bin_start + bin_length :]
    )


def object_bounds(objects: list[bpy.types.Object]) -> dict[str, list[float]]:
    points: list[Vector] = []
    for obj in objects:
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return {"min": [0.0, 0.0, 0.0], "max": [0.0, 0.0, 0.0], "size": [0.0, 0.0, 0.0]}
    minimum = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maximum = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    size = maximum - minimum
    return {
        "min": [round(value, 4) for value in minimum],
        "max": [round(value, 4) for value in maximum],
        "size": [round(value, 4) for value in size],
    }


def validate_glb(glb_path: Path) -> dict[str, object]:
    if not glb_path.exists():
        raise FileNotFoundError(glb_path)
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    bpy.context.view_layer.update()

    roots = sorted(
        (obj for obj in bpy.context.scene.objects if obj.parent is None),
        key=lambda obj: obj.name,
    )
    root_names = [root.name for root in roots]
    if root_names != sorted(EXPECTED_ROOTS):
        raise RuntimeError(f"Unexpected top-level roots: {root_names}")

    report: dict[str, object] = {
        "file": str(glb_path),
        "bytes": glb_path.stat().st_size,
        "top_level_roots": root_names,
        "cottages": {},
    }
    for root in roots:
        meshes = sorted(mesh_descendants(root), key=lambda obj: obj.name)
        if len(meshes) > 15:
            raise RuntimeError(f"{root.name} has {len(meshes)} meshes; budget is 15")
        if any(abs(value) > 1e-5 for value in root.location):
            raise RuntimeError(f"{root.name} is not exported at the origin: {tuple(root.location)}")
        if any(abs(value - 1.0) > 1e-5 for value in root.scale):
            raise RuntimeError(f"{root.name} has non-unit scale: {tuple(root.scale)}")

        triangles = 0
        vertices = 0
        materials: set[str] = set()
        for obj in meshes:
            obj.data.calc_loop_triangles()
            triangles += len(obj.data.loop_triangles)
            vertices += len(obj.data.vertices)
            materials.update(material.name for material in obj.data.materials if material)
        report["cottages"][root.name] = {
            "mesh_count": len(meshes),
            "mesh_names": [obj.name for obj in meshes],
            "vertices": vertices,
            "triangles": triangles,
            "materials": sorted(materials),
            "bounds_blender_xyz_m": object_bounds(meshes),
            "runtime_front_axis": root.get("runtime_front_axis", "+Z"),
            "unit_scale": [round(value, 5) for value in root.scale],
            "origin": [round(value, 5) for value in root.location],
        }
    print("VALIDATION_JSON=" + json.dumps(report, indent=2, sort_keys=True))
    return report


def build(source_path: Path, output_path: Path) -> None:
    random.seed(713)
    reset_scene()
    configure_scene()
    materials = make_materials()
    roots = [
        build_bakery(materials),
        build_library(materials),
        build_tea_house(materials),
        build_post_office(materials),
    ]
    for root in roots:
        merge_by_material(root)
    stage_roots(roots)
    save_source(source_path, roots)
    export_runtime(output_path, roots)

    summary = {
        "source": str(source_path),
        "source_bytes": source_path.stat().st_size,
        "runtime": str(output_path),
        "runtime_bytes": output_path.stat().st_size,
        "roots": [
            {
                "name": root.name,
                "source_stage_position": list(STAGE_POSITIONS[root.name]),
                "mesh_count": len(mesh_descendants(root)),
            }
            for root in roots
        ],
    }
    print("BUILD_JSON=" + json.dumps(summary, indent=2, sort_keys=True))


def main() -> None:
    args = parse_args()
    if args.validate_only:
        validate_glb(Path(args.validate_only).expanduser().resolve())
        return
    source_path = Path(args.source).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    build(source_path, output_path)


if __name__ == "__main__":
    main()
