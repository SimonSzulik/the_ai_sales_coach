#!/usr/bin/env python3
"""Quick check that OPENAI_API_KEY works (GET /v1/models — no chat tokens).

Uses only the Python standard library. Loads a project `.env` if present.
"""

from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path


def _find_dotenv() -> Path | None:
    here = Path(__file__).resolve().parent
    for _ in range(6):
        candidate = here / ".env"
        if candidate.is_file():
            return candidate
        if here.parent == here:
            break
        here = here.parent
    return None


def _load_dotenv(path: Path) -> None:
    """Minimal KEY=VALUE loader; does not override existing env vars."""
    try:
        text = path.read_text(encoding="utf-8")
    except OSError:
        return
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        if not key or key in os.environ:
            continue
        val = val.strip()
        if (val.startswith("'") and val.endswith("'")) or (
            val.startswith('"') and val.endswith('"')
        ):
            val = val[1:-1]
        os.environ[key] = val


def main() -> int:
    env_path = _find_dotenv()
    if env_path:
        _load_dotenv(env_path)

    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        print(
            "OPENAI_API_KEY is not set. Export it or add it to a .env file.",
            file=sys.stderr,
        )
        return 1

    req = urllib.request.Request(
        "https://api.openai.com/v1/models",
        headers={"Authorization": f"Bearer {api_key}"},
        method="GET",
    )
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
            body = resp.read().decode("utf-8")
            status = resp.status
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}", file=sys.stderr)
        err_body = e.read().decode("utf-8", errors="replace")
        print(err_body[:800], file=sys.stderr)
        return 1
    except OSError as e:
        print(f"Request failed: {e}", file=sys.stderr)
        return 1

    if status != 200:
        print(f"Unexpected status {status}", file=sys.stderr)
        return 1

    try:
        data = json.loads(body)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON: {e}", file=sys.stderr)
        return 1

    models = data.get("data") or []
    sample = [m.get("id", "?") for m in models[:5]]
    print(f"OK: OpenAI API accepted the key ({len(models)} models). Examples: {sample}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
