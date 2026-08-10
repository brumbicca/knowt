"""Smoke: chat Discovery intent on VPS/local."""
from __future__ import annotations

import os
from pathlib import Path

from knowt.answers import answer_chat
from knowt.sources import SourceRegistry, seed_tiny_draft


def main() -> None:
    data = Path(os.environ.get("KNOWT_DATA_DIR", "/root/knowt-data"))
    registry = SourceRegistry(data / "sources.json")
    seed_tiny_draft(registry, org_id="default")
    out = answer_chat(
        registry,
        message="O que ja conhecemos do Tiny?",
        source_id="tinyerp",
        data_dir=data,
    )
    print(out["enforcement"]["capability_id"])
    print((out.get("answer") or "")[:500])


if __name__ == "__main__":
    main()
