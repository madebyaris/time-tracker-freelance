#!/usr/bin/env python3
"""Log Cursor agent stop events for SDD workflows."""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def read_payload() -> dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        return {}

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return {"_raw": raw}

    return payload if isinstance(payload, dict) else {"_payload": payload}


def main() -> None:
    payload = read_payload()
    project_dir = Path(os.environ.get("CURSOR_PROJECT_DIR") or os.getcwd())
    log_path = project_dir / ".cursor" / "logs" / "sdd-sessions.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    status = payload.get("status") or "unknown"
    loop_count = payload.get("loop_count")

    fields = [f"[SDD] Session ended at {timestamp}", f"Status: {status}"]
    if isinstance(loop_count, int):
        fields.append(f"Loop: {loop_count}")

    with log_path.open("a", encoding="utf-8") as log_file:
        log_file.write(" | ".join(fields) + "\n")

    sys.stdout.write("{}\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # pragma: no cover - hook must fail open.
        print(f"[SDD hook] session logging failed: {error}", file=sys.stderr)
        sys.stdout.write("{}\n")
