from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import List

from ..utils import _safe_makedirs, _atomic_write_text

@dataclass
class JsonlRepo:
    """Repo genérico para 1 archivo JSONL (una entidad por línea)."""
    path: str

    def load_all(self) -> List[dict]:
        out: List[dict] = []
        try:
            if not os.path.exists(self.path):
                return out
            with open(self.path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                        if isinstance(obj, dict):
                            out.append(obj)
                    except Exception:
                        continue
        except Exception:
            return out
        return out

    def append_many(self, items: List[dict]) -> int:
        if not items:
            return 0
        _safe_makedirs(self.path)
        ok = 0
        with open(self.path, "a", encoding="utf-8") as f:
            for it in items:
                try:
                    f.write(json.dumps(it, ensure_ascii=False) + "\n")
                    ok += 1
                except Exception:
                    continue
        return ok

    def replace_all(self, items: List[dict]) -> None:
        # útil si luego quieres cache “write-through”
        _safe_makedirs(self.path)
        lines = []
        for it in items or []:
            if isinstance(it, dict):
                try:
                    lines.append(json.dumps(it, ensure_ascii=False))
                except Exception:
                    pass
        _atomic_write_text(self.path, "\n".join(lines) + ("\n" if lines else ""))