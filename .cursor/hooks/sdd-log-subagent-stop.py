#!/usr/bin/env python3
"""Log Cursor subagent completion events for SDD workflows.

Cursor hooks pass event details as JSON on stdin. This script keeps logging
best-effort and fail-open so observability issues do not block agent work.
"""

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


def truncate(value: str, limit: int = 240) -> str:
    normalized = " ".join(value.split())
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 3]}..."


def main() -> None:
    payload = read_payload()
    project_dir = Path(os.environ.get("CURSOR_PROJECT_DIR") or os.getcwd())
    log_path = project_dir / ".cursor" / "logs" / "sdd-subagents.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    subagent_type = payload.get("subagent_type") or payload.get("description") or "unknown"
    status = payload.get("status") or "unknown"
    task = truncate(str(payload.get("task") or "unspecified"))
    duration_ms = payload.get("duration_ms")
    modified_files = payload.get("modified_files") or []

    fields = [
        f"[SDD] {timestamp}",
        f"Subagent: {subagent_type}",
        f"Status: {status}",
        f"Task: {task}",
    ]

    if isinstance(duration_ms, (int, float)):
        fields.append(f"Duration: {int(duration_ms)}ms")

    if isinstance(modified_files, list) and modified_files:
        files = ", ".join(str(path) for path in modified_files[:8])
        if len(modified_files) > 8:
            files = f"{files}, +{len(modified_files) - 8} more"
        fields.append(f"Files: {files}")

    with log_path.open("a", encoding="utf-8") as log_file:
        log_file.write(" | ".join(fields) + "\n")

    sys.stdout.write("{}\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # pragma: no cover - hook must fail open.
        print(f"[SDD hook] subagent logging failed: {error}", file=sys.stderr)
        sys.stdout.write("{}\n")
