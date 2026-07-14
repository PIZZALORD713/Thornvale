#!/usr/bin/env python3
"""Convert one exact-rig Mixamo FBX into a deterministic animation-only GLB.

Run through Blender, not the system Python. The animated FBX scene wrapper is
an authoring/export concern and is intentionally excluded. The canonical
20-bone armature action remains in place; unexpected Root-bone motion rejects
the clip instead of being silently flattened.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import struct
import sys

import bpy
from mathutils import Matrix


BONE_PATH = re.compile(r'^pose\.bones\["([^"]+)"\]\.(location|rotation_quaternion|scale)$')
ROOT_TOLERANCE = 1e-5
MAX_BAKED_ROOT_ROTATION = math.radians(75)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--clip-name", required=True)
    parser.add_argument("--rig-profile", required=True)
    parser.add_argument("--report", required=True)
    return parser.parse_args(argv)


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_glb_json(path: Path) -> dict:
    with path.open("rb") as handle:
        magic, version, _length = struct.unpack("<4sII", handle.read(12))
        if magic != b"glTF" or version != 2:
            raise RuntimeError(f"Unexpected GLB header: {path}")
        chunk_length, chunk_type = struct.unpack("<II", handle.read(8))
        if chunk_type != 0x4E4F534A:
            raise RuntimeError(f"First GLB chunk is not JSON: {path}")
        return json.loads(handle.read(chunk_length).decode("utf-8").rstrip("\x00 \t\r\n"))


def find_armature(profile: dict):
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    preferred = str(profile.get("sourceArmature") or "")
    if preferred:
        for armature in armatures:
            if armature.name == preferred:
                return armature
    if len(armatures) == 1:
        return armatures[0]
    if not armatures:
        raise RuntimeError("FBX contains no armature")
    return max(armatures, key=lambda item: len(item.data.bones))


def bone_contract(armature) -> list[dict]:
    return [
        {
            "name": normalize_name(bone.name),
            "parent": normalize_name(bone.parent.name) if bone.parent else None,
        }
        for bone in armature.data.bones
    ]


def validate_rig(armature, profile: dict) -> None:
    actual = bone_contract(armature)
    expected = [
        {
            "name": normalize_name(item["name"]),
            "parent": normalize_name(item["parent"]) if item.get("parent") else None,
        }
        for item in profile["bones"]
    ]
    if actual != expected:
        raise RuntimeError(
            "Source rig does not match friendsies-humanoid-v1:\n"
            f"expected={json.dumps(expected)}\nactual={json.dumps(actual)}"
        )


def source_action_for(armature):
    action = armature.animation_data.action if armature.animation_data else None
    if action:
        return action
    prefix = f"{armature.name}|"
    matches = [action for action in bpy.data.actions if action.name.startswith(prefix)]
    if len(matches) == 1:
        return matches[0]
    raise RuntimeError(f"Could not resolve one action for armature {armature.name}")


def curve_span(fcurve, frame_start: float, frame_end: float) -> float:
    frames = {frame_start, frame_end}
    frames.update(point.co.x for point in fcurve.keyframe_points)
    values = [float(fcurve.evaluate(frame)) for frame in sorted(frames)]
    return max(values) - min(values) if values else 0.0


def action_curve_spans(action) -> dict:
    """Measure every source-space curve that will not reach the runtime clip."""
    frame_start, frame_end = action.frame_range
    return {
        f"{fcurve.data_path}[{fcurve.array_index}]": curve_span(
            fcurve,
            frame_start,
            frame_end,
        )
        for fcurve in action.fcurves
    }


def sanitize_action(action, root_bone: str) -> dict:
    removed_paths = []
    removed_curve_spans = {}
    root_spans = {}
    root_key = normalize_name(root_bone)

    for fcurve in list(action.fcurves):
        match = BONE_PATH.match(fcurve.data_path)
        if not match:
            removed_paths.append(fcurve.data_path)
            removed_curve_spans[f"{fcurve.data_path}[{fcurve.array_index}]"] = curve_span(
                fcurve,
                action.frame_range[0],
                action.frame_range[1],
            )
            action.fcurves.remove(fcurve)
            continue

        bone_name, property_name = match.groups()
        if normalize_name(bone_name) == root_key:
            span = curve_span(fcurve, action.frame_range[0], action.frame_range[1])
            root_spans[f"{property_name}[{fcurve.array_index}]"] = span
            if span > ROOT_TOLERANCE:
                raise RuntimeError(
                    f"Root-bone motion violates in-place policy: {fcurve.data_path}"
                    f"[{fcurve.array_index}] span={span}"
                )

    if not action.fcurves:
        raise RuntimeError("Sanitization removed every animation curve")
    return {
        "removedObjectCurvePaths": sorted(set(removed_paths)),
        "removedObjectCurveSpans": dict(sorted(removed_curve_spans.items())),
        "rootComponentSpans": dict(sorted(root_spans.items())),
        "retainedFcurves": len(action.fcurves),
    }


def preserve_terminal_pose(action, frame_start: float, frame_end: float, frame_step: int) -> dict:
    """Pad to the output sample grid without dropping an odd terminal source frame."""
    span = frame_end - frame_start
    sample_intervals = math.ceil(span / frame_step)
    padded_end = frame_start + sample_intervals * frame_step
    if padded_end > frame_end:
        for fcurve in action.fcurves:
            terminal_value = float(fcurve.evaluate(frame_end))
            fcurve.keyframe_points.insert(padded_end, terminal_value, options={"FAST"})
        action.update_tag()
    return {
        "endpointPolicy": "include-terminal-pose-with-one-grid-hold-when-needed",
        "sourceFrameEnd": frame_end,
        "exportFrameEnd": padded_end,
        "paddedFrames": padded_end - frame_end,
    }


def capture_in_place_root_rotation(
    armature,
    root_bone: str,
    frame_start: float,
    frame_end: float,
    frame_step: int,
) -> tuple[list[dict], dict]:
    """Capture wrapper-authored rotation while deliberately discarding translation."""
    scene = bpy.context.scene
    root = armature.pose.bones.get(root_bone)
    if root is None:
        raise RuntimeError(f"Missing pose bone for wrapper rotation bake: {root_bone}")

    sample_count = int(round((frame_end - frame_start) / frame_step)) + 1
    frames = [frame_start + index * frame_step for index in range(sample_count)]
    world_samples = []
    for frame in frames:
        scene.frame_set(int(round(frame)))
        world_samples.append((frame, armature.matrix_world.copy() @ root.matrix.copy()))

    base_world = armature.matrix_world.copy()
    scene.frame_set(int(round(frame_start)))
    base_world = armature.matrix_world.copy()
    base_pose = base_world.inverted_safe() @ world_samples[0][1]
    base_location, base_rotation, base_scale = base_pose.decompose()
    baked = []
    rotation_deltas = []
    for frame, world_root in world_samples:
        desired_pose = base_world.inverted_safe() @ world_root
        desired_rotation = desired_pose.to_quaternion().normalized()
        delta = base_rotation.rotation_difference(desired_rotation).angle
        rotation_deltas.append(float(delta))
        baked.append({
            "frame": frame,
            "matrix": Matrix.LocRotScale(base_location, desired_rotation, base_scale),
        })

    maximum = max(rotation_deltas, default=0.0)
    if maximum > MAX_BAKED_ROOT_ROTATION:
        raise RuntimeError(
            "Wrapper rotation exceeds the bounded in-place policy: "
            f"{math.degrees(maximum):.3f} degrees"
        )
    scene.frame_set(int(round(frame_start)))
    return baked, {
        "policy": "strip-wrapper-translation-bake-bounded-root-rotation",
        "sampleCount": len(baked),
        "maximumRotationRadians": maximum,
        "maximumRotationDegrees": math.degrees(maximum),
        "finalRotationRadians": rotation_deltas[-1] if rotation_deltas else 0.0,
        "translationPolicy": "constant-canonical-root-location",
    }


def detach_and_prune(armature, action) -> dict:
    source_parent_chain = []
    current = armature.parent
    while current:
        source_parent_chain.append(current.name)
        current = current.parent

    world = armature.matrix_world.copy()
    static_world_matrix = [float(value) for row in world for value in row]
    armature.parent = None
    armature.matrix_world = world
    armature.name = "friendsies-humanoid-v1"
    armature.data.name = "friendsies-humanoid-v1-armature"

    removed_objects = []
    for obj in list(bpy.data.objects):
        if obj != armature:
            removed_objects.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)

    removed_actions = []
    removed_action_curve_spans = {}
    for other in list(bpy.data.actions):
        if other != action:
            removed_actions.append(other.name)
            removed_action_curve_spans[other.name] = dict(sorted(action_curve_spans(other).items()))
            bpy.data.actions.remove(other, do_unlink=True)

    return {
        "sourceParentChain": source_parent_chain,
        "retainedStaticArmatureWorldMatrix": static_world_matrix,
        "runtimeBindingNote": (
            "The GLB armature node preserves the source frame-one basis for clean re-import; "
            "Thornvale loads only AnimationClip tracks and binds them by canonical bone name."
        ),
        "removedObjects": sorted(removed_objects),
        "removedActions": sorted(removed_actions),
        "removedActionCurveSpans": dict(sorted(removed_action_curve_spans.items())),
    }


def bake_root_rotation(armature, action, root_bone: str, samples: list[dict]) -> None:
    root_key = normalize_name(root_bone)
    for fcurve in list(action.fcurves):
        match = BONE_PATH.match(fcurve.data_path)
        if match and normalize_name(match.group(1)) == root_key:
            action.fcurves.remove(fcurve)

    armature.animation_data_create()
    armature.animation_data.action = action
    root = armature.pose.bones[root_bone]
    root.rotation_mode = "QUATERNION"
    scene = bpy.context.scene
    for sample in samples:
        frame = sample["frame"]
        scene.frame_set(int(round(frame)))
        root.matrix = sample["matrix"]
        root.keyframe_insert(data_path="location", frame=frame, group=root.name)
        root.keyframe_insert(data_path="rotation_quaternion", frame=frame, group=root.name)
        root.keyframe_insert(data_path="scale", frame=frame, group=root.name)

    for fcurve in action.fcurves:
        match = BONE_PATH.match(fcurve.data_path)
        if match and normalize_name(match.group(1)) == root_key:
            for point in fcurve.keyframe_points:
                point.interpolation = "LINEAR"
    scene.frame_set(int(round(samples[0]["frame"])))


def export_glb(armature, action, output_path: Path, frame_step: int) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    armature.animation_data_create()
    armature.animation_data.action = action

    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        check_existing=False,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_texcoords=False,
        export_normals=False,
        export_tangents=False,
        export_attributes=False,
        export_materials="NONE",
        export_skins=False,
        export_morph=False,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_anim_single_armature=True,
        export_armature_object_remove=False,
        export_nla_strips=False,
        export_merge_animation="ACTION",
        export_frame_range=True,
        export_frame_step=frame_step,
        export_anim_slide_to_zero=True,
        export_optimize_animation_size=True,
        export_optimize_animation_keep_anim_armature=True,
        export_optimize_animation_keep_anim_object=False,
        export_force_sampling=True,
        export_draco_mesh_compression_enable=False,
    )


def validate_glb(path: Path, profile: dict, clip_name: str) -> dict:
    document = parse_glb_json(path)
    for field in ("meshes", "materials", "textures", "images", "skins", "cameras"):
        if document.get(field):
            raise RuntimeError(f"Animation-only output unexpectedly contains {field}")
    if any(node.get("camera") is not None for node in document.get("nodes") or []):
        raise RuntimeError("Animation-only output unexpectedly contains a camera node")
    if any("KHR_lights_punctual" in (node.get("extensions") or {}) for node in document.get("nodes") or []):
        raise RuntimeError("Animation-only output unexpectedly contains a light node")

    animations = document.get("animations") or []
    if len(animations) != 1 or animations[0].get("name") != clip_name:
        raise RuntimeError(
            f"Expected one animation named {clip_name}; got "
            f"{[item.get('name') for item in animations]}"
        )

    nodes = document.get("nodes") or []
    channels = animations[0].get("channels") or []
    samplers = animations[0].get("samplers") or []
    if len(channels) != 60 or len(samplers) != 60:
        raise RuntimeError(
            f"Expected exactly 60 animation channels/samplers; got {len(channels)}/{len(samplers)}"
        )
    targets = {
        normalize_name(nodes[channel["target"]["node"]].get("name"))
        for channel in channels
    }
    expected = {normalize_name(item["name"]) for item in profile["bones"]}
    if targets != expected:
        raise RuntimeError(
            "Animation targets do not match canonical rig: "
            f"missing={sorted(expected - targets)} extra={sorted(targets - expected)}"
        )

    expected_paths = {
        (normalize_name(item["name"]), path)
        for item in profile["bones"]
        for path in ("translation", "rotation", "scale")
    }
    actual_paths = {
        (
            normalize_name(nodes[channel["target"]["node"]].get("name")),
            channel["target"].get("path"),
        )
        for channel in channels
    }
    if actual_paths != expected_paths:
        raise RuntimeError(
            "Animation channel properties do not match the canonical 20 x TRS contract: "
            f"missing={sorted(expected_paths - actual_paths)} "
            f"extra={sorted(actual_paths - expected_paths)}"
        )

    accessors = document.get("accessors") or []
    duration_seconds = max(
        (
            float((accessors[sampler["input"]].get("max") or [0])[0])
            for sampler in samplers
        ),
        default=0.0,
    )

    return {
        "nodes": len(nodes),
        "animationChannels": len(channels),
        "animationSamplers": len(samplers),
        "durationSeconds": duration_seconds,
        "targetBones": sorted(targets),
    }


def clean_reimport(path: Path, clip_name: str) -> dict:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    action_names = sorted(action.name for action in bpy.data.actions)
    if not any(normalize_name(name) == normalize_name(clip_name) for name in action_names):
        raise RuntimeError(f"Clean re-import did not recover {clip_name}: {action_names}")
    return {
        "objects": sorted(obj.name for obj in bpy.context.scene.objects),
        "actions": action_names,
    }


def main() -> None:
    args = parse_args()
    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    report_path = Path(args.report).resolve()
    profile_path = Path(args.rig_profile).resolve()
    profile = json.loads(profile_path.read_text(encoding="utf-8"))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(
        filepath=str(input_path),
        use_anim=True,
        automatic_bone_orientation=False,
    )
    armature = find_armature(profile)
    validate_rig(armature, profile)
    action = source_action_for(armature)
    source_action_name = action.name
    frame_start = float(action.frame_range[0])
    frame_end = float(action.frame_range[1])
    sample_rate = int(profile.get("sampleRate") or 60)
    output_sample_rate = int(profile.get("outputSampleRate") or sample_rate)
    if sample_rate % output_sample_rate != 0:
        raise RuntimeError(
            f"Source sample rate {sample_rate} must divide evenly by output rate "
            f"{output_sample_rate}"
        )
    export_frame_step = sample_rate // output_sample_rate
    duration_seconds = (frame_end - frame_start) / sample_rate
    blender_version = bpy.app.version_string
    bpy.context.scene.render.fps = sample_rate
    bpy.context.scene.render.fps_base = 1.0
    bpy.context.scene.frame_start = math.floor(frame_start)

    endpoint = preserve_terminal_pose(action, frame_start, frame_end, export_frame_step)
    bpy.context.scene.frame_end = math.ceil(endpoint["exportFrameEnd"])
    baked_root, root_bake_report = capture_in_place_root_rotation(
        armature,
        profile["rootBone"],
        frame_start,
        endpoint["exportFrameEnd"],
        export_frame_step,
    )
    sanitation = sanitize_action(action, profile["rootBone"])
    action.name = args.clip_name
    pruned = detach_and_prune(armature, action)
    bake_root_rotation(armature, action, profile["rootBone"], baked_root)
    export_glb(armature, action, output_path, export_frame_step)
    glb = validate_glb(output_path, profile, args.clip_name)
    reimport = clean_reimport(output_path, args.clip_name)

    report = {
        "schemaVersion": "friendsies-motion-build-result-v1",
        "clipName": args.clip_name,
        "blenderVersion": blender_version,
        "source": {
            "filename": input_path.name,
            "bytes": input_path.stat().st_size,
            "sha256": sha256(input_path),
            "action": source_action_name,
            "frameStart": frame_start,
            "frameEnd": frame_end,
            "sampleRate": sample_rate,
            "durationSeconds": duration_seconds,
        },
        "transform": {
            "rootMotionPolicy": "strip-wrapper-translation-bake-bounded-root-rotation",
            **sanitation,
            **endpoint,
            "rootRotationBake": root_bake_report,
            **pruned,
        },
        "output": {
            "filename": output_path.name,
            "bytes": output_path.stat().st_size,
            "sha256": sha256(output_path),
            "sampleRate": output_sample_rate,
            **glb,
        },
        "cleanReimport": reimport,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print("STORY_ACTION_RESULT=" + json.dumps(report, sort_keys=True))


if __name__ == "__main__":
    main()
