"""Authenticated localhost bridge that schedules all bpy work on the main thread."""

from __future__ import annotations

import hmac
import json
import queue
import socketserver
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import bpy

from .core import PizzaLabError, execute, load_adapter


MAX_REQUEST_BYTES = 1024 * 1024


@dataclass
class Job:
    request: dict[str, Any]
    done: threading.Event = field(default_factory=threading.Event)
    response: dict[str, Any] | None = None
    cancelled: bool = False


class _RequestHandler(socketserver.StreamRequestHandler):
    def handle(self) -> None:
        raw = self.rfile.readline(MAX_REQUEST_BYTES + 1)
        if len(raw) > MAX_REQUEST_BYTES:
            self._write({"ok": False, "error": "Request exceeds 1 MiB limit"})
            return
        try:
            request = json.loads(raw.decode("utf-8"))
        except (UnicodeError, json.JSONDecodeError):
            self._write({"ok": False, "error": "Request must be valid UTF-8 JSON"})
            return
        bridge: Bridge = self.server.bridge  # type: ignore[attr-defined]
        if not hmac.compare_digest(str(request.get("token") or ""), bridge.token):
            self._write({"ok": False, "error": "Authentication failed"})
            return
        job = Job(request=request)
        bridge.jobs.put(job)
        if not job.done.wait(timeout=bridge.timeout):
            job.cancelled = True
            self._write({"ok": False, "error": "Blender main-thread command timed out"})
            return
        self._write(job.response or {"ok": False, "error": "Command returned no response"})

    def _write(self, response: dict[str, Any]) -> None:
        self.wfile.write(json.dumps(response, separators=(",", ":")).encode("utf-8") + b"\n")


class _Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


class Bridge:
    def __init__(self, port: int, token: str, adapter_path: str, timeout: float = 30.0):
        if not token:
            raise PizzaLabError("A non-empty session token is required")
        self.port = int(port)
        self.token = token
        self.adapter_path = str(Path(adapter_path).expanduser().resolve())
        self.timeout = timeout
        self.jobs: queue.Queue[Job] = queue.Queue()
        self.server: _Server | None = None
        self.thread: threading.Thread | None = None
        self.timer_callback = self._drain

    def start(self) -> None:
        if self.server:
            return
        self.server = _Server(("127.0.0.1", self.port), _RequestHandler)
        self.server.bridge = self  # type: ignore[attr-defined]
        self.thread = threading.Thread(target=self.server.serve_forever, name="PizzaLabBridge", daemon=True)
        self.thread.start()
        if not bpy.app.timers.is_registered(self.timer_callback):
            bpy.app.timers.register(self.timer_callback, first_interval=0.05, persistent=True)

    def stop(self) -> None:
        if self.server:
            self.server.shutdown()
            self.server.server_close()
        self.server = None
        self.thread = None
        while True:
            try:
                job = self.jobs.get_nowait()
            except queue.Empty:
                break
            job.cancelled = True
            job.response = {"ok": False, "error": "Pizza Lab bridge stopped"}
            job.done.set()
        if bpy.app.timers.is_registered(self.timer_callback):
            bpy.app.timers.unregister(self.timer_callback)

    def _drain(self) -> float | None:
        if not self.server:
            return None
        try:
            adapter = load_adapter(self.adapter_path)
        except (OSError, json.JSONDecodeError) as exc:
            adapter_error = f"Unable to load Pizza Lab adapter: {exc}"
            adapter = None
        else:
            adapter_error = None

        for _ in range(8):
            try:
                job = self.jobs.get_nowait()
            except queue.Empty:
                break
            if job.cancelled:
                job.done.set()
                continue
            try:
                if adapter_error:
                    raise PizzaLabError(adapter_error)
                job.response = execute(str(job.request.get("command")), job.request.get("payload"), adapter)
            except Exception as exc:
                job.response = {"ok": False, "error": str(exc)}
            finally:
                job.done.set()
        return 0.05
