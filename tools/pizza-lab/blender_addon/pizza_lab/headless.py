"""Blender entry point for one Pizza Lab command."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .core import PizzaLabError, execute, load_adapter


def _args() -> argparse.Namespace:
    tail = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--adapter", required=True)
    parser.add_argument("--request", required=True)
    return parser.parse_args(tail)


def main() -> int:
    args = _args()
    try:
        adapter = load_adapter(args.adapter)
        request = json.loads(Path(args.request).read_text(encoding="utf-8"))
        result = execute(str(request.get("command")), request.get("payload"), adapter)
    except (OSError, ValueError, PizzaLabError) as exc:
        result = {"ok": False, "error": str(exc)}
        print("PIZZA_LAB_RESULT=" + json.dumps(result, separators=(",", ":")))
        return 1
    print("PIZZA_LAB_RESULT=" + json.dumps(result, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
