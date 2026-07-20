"""Seed the editable Pizza Lab Wayfinder source from ThornVale's generator."""

from __future__ import annotations

import sys
from pathlib import Path

import bpy


ROOT = Path(__file__).resolve().parent
REPO_ROOT = ROOT.parent.parent
sys.path.insert(0, str(ROOT))
OUTPUT_PATH = (
    REPO_ROOT
    / "assets-src"
    / "pizza-lab"
    / "wayfinder-v1"
    / "thornvale-wayfinder-authoring.blend"
)


from wayfinder_authoring import build_editable_wayfinder  # noqa: E402


def main() -> int:
    arguments = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if OUTPUT_PATH.exists() and "--acknowledge-overwrite" not in arguments:
        raise RuntimeError(
            "Refusing to replace the editable Wayfinder source without --acknowledge-overwrite"
        )

    from wayfinder_authoring import load_generator

    generator = load_generator(REPO_ROOT)
    generator.clean_scene()
    bpy.context.preferences.filepaths.save_version = 0
    generator, root, assemblies = build_editable_wayfinder(REPO_ROOT)

    component_names = []
    for component in sorted(root.children_recursive, key=lambda obj: obj.name):
        component["pizza_lab_component_name"] = component.name
        component["pizza_lab_component_editable"] = component in assemblies
        component_names.append(component.name)
    root["pizza_lab_component_count"] = len(component_names)

    used_materials = {
        material
        for component in root.children_recursive
        for material in getattr(component.data, "materials", [])
        if material is not None
    }
    for material in list(bpy.data.materials):
        if material not in used_materials:
            bpy.data.materials.remove(material)

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene.unit_settings.scale_length = 1.0
    scene["pizza_lab_family"] = "thornvale-wayfinder-pizza-lab-v1"
    scene["pizza_lab_seed_generator"] = "scripts/build-village-dressing.py"
    scene["pizza_lab_component_names"] = "\n".join(component_names)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_PATH), compress=True)
    print(f"PIZZA_LAB_WAYFINDER_SOURCE={OUTPUT_PATH}")
    print(f"PIZZA_LAB_WAYFINDER_COMPONENTS={len(component_names)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
