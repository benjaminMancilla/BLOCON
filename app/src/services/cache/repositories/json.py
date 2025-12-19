from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from ..utils import iso_utc, _atomic_write_text, _read_json_file

@dataclass
class JsonRepo:
    """Repo genérico para 1 archivo JSON."""
    path: str
    add_saved_at: bool = False

    def load(self, default: Any) -> Any:
        return _read_json_file(self.path, default)

    def save(self, obj: Any) -> None:
        payload = obj
        if isinstance(payload, dict) and self.add_saved_at:
            payload = dict(payload)
            payload["saved_at"] = iso_utc()
        text = json.dumps(payload, ensure_ascii=False, indent=2)
        _atomic_write_text(self.path, text)