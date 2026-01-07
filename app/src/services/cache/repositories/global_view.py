from __future__ import annotations

import os
from typing import Any, Dict, List

from .diagram_view import _normalize_ids
from .json import JsonRepo


class GlobalDiagramViewRepo:
    """Repo para diagram_view.global.json (vista global cacheada)."""

    def __init__(self, data_dir: str, *, filename: str = "diagram_view.global.json") -> None:
        self.path = os.path.join(data_dir, "views", filename)
        self._repo = JsonRepo(path=self.path, add_saved_at=True)

    def exists(self) -> bool:
        return os.path.exists(self.path)

    def load(self) -> Dict[str, Any] | None:
        if not self.exists():
            return None
        data = self._repo.load({})
        collapsed = data.get("collapsedGateIds", []) if isinstance(data, dict) else []
        return {"collapsedGateIds": _normalize_ids(collapsed)}

    def save(self, view: Dict[str, Any] | None) -> None:
        if view is None:
            self.clear()
            return
        collapsed: List[str] = []
        if isinstance(view, dict):
            collapsed = view.get("collapsedGateIds", [])
        payload = {"collapsedGateIds": _normalize_ids(collapsed)}
        self._repo.save(payload)

    def clear(self) -> None:
        try:
            if os.path.exists(self.path):
                os.remove(self.path)
        except Exception:
            pass