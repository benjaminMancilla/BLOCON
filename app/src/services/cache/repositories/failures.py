from __future__ import annotations

import json
from typing import Any, Dict, List, Tuple

from ..cache import failures_cache_path

from ..utils import _atomic_write_text, _read_json_file

class FailuresCacheRepo:
    """
    Repo para components_failures.cache.json.
    No dependemos de la vieja “DB simulada”; esto es solo cache.
    Formato recomendado (el tuyo en failure.py también calza bien):
      { "items": { cid: { "rows": [(date, type)], "last_update": ISO }, ... } }
    """

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.path = failures_cache_path(data_dir=self.data_dir)

    def load(self) -> Dict[str, Any]:
        data = _read_json_file(self.path, {})
        return data if isinstance(data, dict) else {}

    def save(self, data: Dict[str, Any]) -> None:
        text = json.dumps(data if isinstance(data, dict) else {}, ensure_ascii=False, indent=2)
        _atomic_write_text(self.path, text)

    def load_failures_cache(self, project_root: str | None = None) -> Dict[str, Any]:
        _ = project_root
        return self.load()

    def save_failures_cache(self, cache: Dict[str, Any], project_root: str | None = None) -> None:
        _ = project_root
        self.save(cache)

    def _rows_for_component(self, entry: Any) -> List[Any]:
        # soporta:
        # - {"rows": [...], "last_update": "..."}
        # - lista directa (formato viejo)
        if isinstance(entry, dict):
            r = entry.get("rows", [])
            return r if isinstance(r, list) else []
        if isinstance(entry, list):
            return entry
        return []

    def _row_to_dict(self, cid: str, r: Any) -> Dict[str, Any] | None:
        # soporta (date, type) en lista/tupla o dict ya normalizado
        if isinstance(r, (list, tuple)) and len(r) >= 2:
            date = str(r[0] or "").strip()
            typ = str(r[1] or "").strip()
        elif isinstance(r, dict):
            date = str(r.get("failure_date") or r.get("date") or "").strip()
            typ = str(r.get("type_failure") or r.get("type") or "").strip()
        else:
            return None

        if len(date) >= 10:
            date = date[:10]

        return {"Component_ID": cid, "failure_date": date, "type_failure": typ}

    def fetch_failures_by_ids(
        self,
        component_ids: List[str],
        page: int = 1,
        page_size: int = 200,
    ) -> Tuple[List[Dict[str, Any]], int]:
        cache = self.load()
        items = cache.get("items", {})
        if not isinstance(items, dict):
            items = {}

        cid_set = [str(c).strip() for c in (component_ids or []) if str(c).strip()]
        cid_set = sorted(set(cid_set))

        rows: List[Dict[str, Any]] = []
        for cid in cid_set:
            entry = items.get(cid)
            for r in self._rows_for_component(entry):
                d = self._row_to_dict(cid, r)
                if d:
                    rows.append(d)

        rows.sort(key=lambda d: (d.get("Component_ID", ""), d.get("failure_date", ""), d.get("type_failure", "")))

        total = len(rows)
        page = max(1, int(page))
        page_size = max(1, int(page_size))
        start = (page - 1) * page_size
        end = start + page_size
        return rows[start:end], total