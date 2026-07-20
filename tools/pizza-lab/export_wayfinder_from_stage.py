"""Export the Wayfinder candidate from a saved Pizza Lab World Stage."""

from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "blender_addon"))

from pizza_lab.core import execute, load_adapter  # noqa: E402


def main() -> int:
    adapter = load_adapter(ROOT / "adapters/thornvale.json")
    result = execute("asset.wayfinder-candidate.export", {}, adapter)["result"]
    print("PIZZA_LAB_WAYFINDER_EXPORT=" + json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
