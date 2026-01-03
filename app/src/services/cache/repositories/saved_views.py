from __future__ import annotations

import os
import re
import uuid
from typing import Any, Dict, List, Optional

from .diagram_view import _normalize_ids
from .json import JsonRepo


class SavedViewRepo:
    """
    Maneja persistencia LOCAL de una vista guardada en AppData/cache.

    Archivos:
      - diagram_view.json  (snapshot de la vista)
      - meta.json          (metadata)
    """

    def __init__(
        self,
        data_dir: str,
        *,
        view_dirname: str,
        view_filename: str = "diagram_view.json",
        meta_filename: str = "meta.json",
    ) -> None:
        self.data_dir = data_dir
        self.view_dir = os.path.join(data_dir, view_dirname)
        self.view = JsonRepo(path=os.path.join(self.view_dir, view_filename))
        self.meta = JsonRepo(path=os.path.join(self.view_dir, meta_filename), add_saved_at=True)

    def paths(self) -> Dict[str, str]:
        return {
            "view_dir": self.view_dir,
            "view": self.view.path,
            "meta": self.meta.path,
        }

    def exists_any(self) -> bool:
        p = self.paths()
        return os.path.exists(p["view"]) or os.path.exists(p["meta"])

    def load_view(self) -> Dict[str, Any]:
        data = self.view.load({})
        collapsed = data.get("collapsedGateIds", []) if isinstance(data, dict) else []
        return {"collapsedGateIds": _normalize_ids(collapsed)}

    def save_view(self, view: Dict[str, Any], *, name: Optional[str] = None) -> None:
        os.makedirs(self.view_dir, exist_ok=True)
        collapsed = []
        if isinstance(view, dict):
            collapsed = view.get("collapsedGateIds", [])
        payload = {"collapsedGateIds": _normalize_ids(collapsed)}
        self.view.save(payload)

        existing_meta = self.load_meta()
        view_name = name if name is not None else existing_meta.get("name")
        if isinstance(view_name, str):
            view_name = view_name.strip() or None

        meta: Dict[str, Any] = {
            "schema": 1,
        }
        if view_name:
            meta["name"] = view_name
        self.save_meta(meta)

    def load_meta(self) -> Dict[str, Any]:
        meta = self.meta.load({})
        return meta if isinstance(meta, dict) else {}

    def save_meta(self, meta: Dict[str, Any]) -> None:
        os.makedirs(self.view_dir, exist_ok=True)
        self.meta.save(dict(meta or {}))

    def rename_view(self, name: str) -> Dict[str, Any]:
        meta = self.load_meta()
        meta = dict(meta or {})
        cleaned = (name or "").strip()
        if cleaned:
            meta["name"] = cleaned
        self.save_meta(meta)
        return meta

    def delete_view(self) -> None:
        p = self.paths()
        for key in ("view", "meta"):
            try:
                if os.path.exists(p[key]):
                    os.remove(p[key])
            except Exception:
                pass

        try:
            if os.path.isdir(p["view_dir"]) and not os.listdir(p["view_dir"]):
                os.rmdir(p["view_dir"])
        except Exception:
            pass


class SavedViewsRepo:
    """Maneja múltiples vistas guardadas en subdirectorios view_<id>."""

    def __init__(
        self,
        data_dir: str,
        *,
        views_dirname: str = "views",
        view_prefix: str = "view",
    ) -> None:
        self.data_dir = data_dir
        self.views_dirname = views_dirname
        self.view_prefix = view_prefix
        self.views_dir = os.path.join(data_dir, views_dirname)

    def _sanitize_id(self, view_id: str) -> Optional[str]:
        if not isinstance(view_id, str):
            return None
        cleaned = re.sub(r"[^a-zA-Z0-9_-]", "", view_id.strip())
        return cleaned or None

    def _view_dirname(self, view_id: str) -> str:
        return f"{self.view_prefix}_{view_id}"

    def _repo_for(self, view_id: str) -> SavedViewRepo:
        dirname = os.path.join(self.views_dirname, self._view_dirname(view_id))
        return SavedViewRepo(data_dir=self.data_dir, view_dirname=dirname)

    def _iter_view_ids(self) -> List[str]:
        if not os.path.isdir(self.views_dir):
            return []
        prefix = f"{self.view_prefix}_"
        ids: List[str] = []
        for entry in os.listdir(self.views_dir):
            if not entry.startswith(prefix):
                continue
            view_id = entry[len(prefix):]
            if view_id:
                ids.append(view_id)
        return ids

    def list_views(self) -> List[Dict[str, Any]]:
        views: List[Dict[str, Any]] = []
        for view_id in self._iter_view_ids():
            repo = self._repo_for(view_id)
            if not repo.exists_any():
                continue
            meta = repo.load_meta()
            name = None
            if isinstance(meta, dict):
                name = meta.get("name")
            if not isinstance(name, str) or not name.strip():
                name = "Vista sin nombre"
            views.append(
                {
                    "id": view_id,
                    "name": name,
                    "saved_at": meta.get("saved_at") if isinstance(meta, dict) else None,
                }
            )
        views.sort(key=lambda entry: entry.get("saved_at") or "", reverse=True)
        return views

    def _generate_id(self) -> str:
        return uuid.uuid4().hex

    def create_view(self, *, view: Dict[str, Any], name: Optional[str] = None) -> Dict[str, Any]:
        os.makedirs(self.views_dir, exist_ok=True)
        view_id = self._generate_id()
        while os.path.exists(os.path.join(self.views_dir, self._view_dirname(view_id))):
            view_id = self._generate_id()
        repo = self._repo_for(view_id)
        repo.save_view(view, name=name)
        meta = repo.load_meta()
        return {"id": view_id, "meta": meta}

    def save_view(
        self,
        *,
        view_id: str,
        view: Dict[str, Any],
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        normalized = self._sanitize_id(view_id)
        if not normalized:
            raise ValueError("invalid view id")
        repo = self._repo_for(normalized)
        repo.save_view(view, name=name)
        return {"id": normalized, "meta": repo.load_meta()}

    def rename_view(self, view_id: str, name: str) -> Dict[str, Any]:
        normalized = self._sanitize_id(view_id)
        if not normalized:
            raise ValueError("invalid view id")
        repo = self._repo_for(normalized)
        meta = repo.rename_view(name)
        return {"id": normalized, "meta": meta}

    def delete_view(self, view_id: str) -> bool:
        normalized = self._sanitize_id(view_id)
        if not normalized:
            return False
        repo = self._repo_for(normalized)
        had_any = repo.exists_any()
        repo.delete_view()
        return had_any

    def load_view(self, *, view_id: str) -> Dict[str, Any]:
        normalized = self._sanitize_id(view_id)
        if not normalized:
            return {"status": "missing"}
        repo = self._repo_for(normalized)
        if not repo.exists_any():
            return {"status": "missing"}
        view = repo.load_view()
        meta = repo.load_meta()
        return {
            "status": "ok",
            "view": {"id": normalized, "meta": meta},
            "data": view,
        }