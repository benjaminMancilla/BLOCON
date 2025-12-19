from __future__ import annotations
from typing import Any, Dict, List, Tuple

from ..cache import load_cache, save_cache, upsert_many, failures_cache_path

class ComponentsCacheRepo:
    """
    Repo para components.cache.json (usa tu cache.py existente).
    Estructura esperada: Dict[id, Dict]
    """

    def __init__(self, data_dir: str):
        self.data_dir = data_dir

    def load(self) -> Dict[str, Dict]:
        return load_cache(data_dir=self.data_dir)

    def save(self, data: Dict[str, Dict]) -> None:
        save_cache(data, data_dir=self.data_dir)

    def upsert_many(self, items: List[Dict[str, Any]]) -> Dict[str, Dict]:
        base = self.load()
        upsert_many(base, items)
        self.save(base)
        return base
    
    def get_many(self, ids: List[str]) -> Dict[str, Dict[str, Any]]:
        data = self.load()
        out: Dict[str, Dict[str, Any]] = {}
        for raw in ids or []:
            cid = str(raw).strip()
            if not cid:
                continue
            if cid in data:
                out[cid] = dict(data[cid] or {})
        return out

    def search(self, query: str, page: int = 1, page_size: int = 20) -> Tuple[List[Dict[str, Any]], int]:
        data = self.load()
        q = (query or "").strip().lower()
        page = max(1, int(page))
        page_size = max(1, int(page_size))

        keys = sorted(data.keys())
        matches: List[Dict[str, Any]] = []

        for cid in keys:
            item = dict(data.get(cid) or {})
            item.setdefault("id", cid)

            if not q:
                matches.append(item)
                continue

            # Match conservador: id o campos típicos si existen
            hay = [cid]
            for k in ("kks_name", "title", "name", "SubType", "Subtype_Text", "Type_text", "type", "Type"):
                v = item.get(k)
                if isinstance(v, str) and v:
                    hay.append(v)

            if any(q in s.lower() for s in hay if isinstance(s, str)):
                matches.append(item)

        total = len(matches)
        start = (page - 1) * page_size
        end = start + page_size
        return matches[start:end], total