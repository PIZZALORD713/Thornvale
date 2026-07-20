"""Pizza Lab Blender add-on."""

from __future__ import annotations

import bpy
from bpy.props import IntProperty, StringProperty

from .bridge import Bridge
from .core import execute, load_adapter


bl_info = {
    "name": "Pizza Lab",
    "author": "Pizza Lab",
    "version": (0, 3, 0),
    "blender": (4, 5, 0),
    "location": "View3D > Sidebar > Pizza Lab",
    "description": "Authenticated, typed Blender control for Codex and headless production",
    "category": "Pipeline",
}

_bridge: Bridge | None = None


class PIZZALAB_Preferences(bpy.types.AddonPreferences):
    bl_idname = __package__
    port: IntProperty(name="Port", default=9877, min=1024, max=65535)
    session_token: StringProperty(name="Session token", subtype="PASSWORD")
    adapter_path: StringProperty(name="Project adapter", subtype="FILE_PATH")

    def draw(self, context):
        layout = self.layout
        layout.prop(self, "port")
        layout.prop(self, "session_token")
        layout.prop(self, "adapter_path")


class PIZZALAB_OT_Start(bpy.types.Operator):
    bl_idname = "pizza_lab.start"
    bl_label = "Start Pizza Lab"

    def execute(self, context):
        global _bridge
        if _bridge and _bridge.server:
            self.report({"WARNING"}, "Pizza Lab is already running")
            return {"CANCELLED"}
        prefs = context.preferences.addons[__package__].preferences
        try:
            candidate = Bridge(prefs.port, prefs.session_token, prefs.adapter_path)
            candidate.start()
            _bridge = candidate
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Pizza Lab listening on 127.0.0.1:{prefs.port}")
        return {"FINISHED"}


class PIZZALAB_OT_Stop(bpy.types.Operator):
    bl_idname = "pizza_lab.stop"
    bl_label = "Stop Pizza Lab"

    def execute(self, context):
        global _bridge
        if _bridge:
            _bridge.stop()
        _bridge = None
        return {"FINISHED"}


class PIZZALAB_OT_LoadStage(bpy.types.Operator):
    bl_idname = "pizza_lab.load_stage"
    bl_label = "Load ThornVale Stage"

    def execute(self, context):
        prefs = context.preferences.addons[__package__].preferences
        try:
            result = execute("stage.load", {"replace": True}, load_adapter(prefs.adapter_path))
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Loaded {len(result['result']['objects'])} staged objects")
        return {"FINISHED"}


class PIZZALAB_OT_PublishStage(bpy.types.Operator):
    bl_idname = "pizza_lab.publish_stage"
    bl_label = "Publish Placement Candidate"

    def execute(self, context):
        prefs = context.preferences.addons[__package__].preferences
        try:
            result = execute("stage.publish", {}, load_adapter(prefs.adapter_path))
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Published {len(result['result']['changes'])} placement candidate")
        return {"FINISHED"}


class PIZZALAB_OT_LoadWorldStage(bpy.types.Operator):
    bl_idname = "pizza_lab.load_world_stage"
    bl_label = "Load Full World Stage"

    def execute(self, context):
        prefs = context.preferences.addons[__package__].preferences
        try:
            result = execute("world-stage.load", {"replace": True}, load_adapter(prefs.adapter_path))
        except Exception as exc:
            self.report({"ERROR"}, str(exc))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Loaded {result['result']['assetCount']} World Stage assets")
        return {"FINISHED"}


class PIZZALAB_PT_Panel(bpy.types.Panel):
    bl_label = "Pizza Lab"
    bl_idname = "PIZZALAB_PT_panel"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "Pizza Lab"

    def draw(self, context):
        layout = self.layout
        layout.label(text="Connected" if _bridge and _bridge.server else "Stopped")
        row = layout.row(align=True)
        row.operator("pizza_lab.start", icon="PLAY")
        row.operator("pizza_lab.stop", icon="PAUSE")
        layout.separator()
        layout.operator("pizza_lab.load_world_stage", icon="WORLD_DATA")
        layout.operator("pizza_lab.load_stage", icon="IMPORT")
        layout.operator("pizza_lab.publish_stage", icon="EXPORT")
        selected = context.active_object
        if selected:
            layout.label(text=f"Object: {selected.name}")
            layout.label(text=f"Game ID: {selected.get('pizza_lab_game_id', 'not assigned')}")


CLASSES = (
    PIZZALAB_Preferences,
    PIZZALAB_OT_Start,
    PIZZALAB_OT_Stop,
    PIZZALAB_OT_LoadStage,
    PIZZALAB_OT_LoadWorldStage,
    PIZZALAB_OT_PublishStage,
    PIZZALAB_PT_Panel,
)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)


def unregister():
    global _bridge
    if _bridge:
        _bridge.stop()
    _bridge = None
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)
