from __future__ import annotations

import os
from typing import Any, Dict, List

from .json import JsonRepo


class DiagramViewRepo:
    """Repo para diagram_view.json (lista de IDs de gates colapsadas)."""

    def __init__(self, data_dir: str):
        self.path = os.path.join(data_dir, "views", "diagram_view.json")
        self._repo = JsonRepo(path=self.path, add_saved_at=True)

    def load(self) -> Dict[str, Any]:
        data = self._repo.load({})
        collapsed = data.get("collapsedGateIds", []) if isinstance(data, dict) else []
        return {"collapsedGateIds": _normalize_ids(collapsed)}

    def save(self, view: Dict[str, Any]) -> None:
        collapsed = []
        if isinstance(view, dict):
            collapsed = view.get("collapsedGateIds", [])
        payload = {"collapsedGateIds": _normalize_ids(collapsed)}
        self._repo.save(payload)


def _normalize_ids(values: Any) -> List[str]:
    if not isinstance(values, list):
        return []
    seen = set()
    normalized: List[str] = []
    for value in values:
        if not isinstance(value, str) or not value:
            continue
        if value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized