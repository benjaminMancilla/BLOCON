from __future__ import annotations

import os
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple

from .json import JsonRepo
from .jsonl import JsonlRepo


class DraftRepo:
    """
    Maneja persistencia LOCAL de un borrador (draft) en AppData (vía data_dir).

    Archivos:
      - snapshot.local.json     (snapshot del grafo)
      - events.local.jsonl      (eventos activos del store)
      - meta.json               (base_version + metadata)

    NOTA: Este repo NO llama a la nube. Solo usa 'cloud_head' que le pases
    para validar conflictos (base_version != cloud_head).
    """

    def __init__(
        self,
        data_dir: str,
        *,
        draft_dirname: str = "draft",
        snapshot_filename: str = "snapshot.local.json",
        events_filename: str = "events.local.jsonl",
        meta_filename: str = "meta.json",
    ):
        self.data_dir = data_dir
        self.draft_dir = os.path.join(data_dir, draft_dirname)

        # Repos de archivos (guardan en draft_dir)
        self.snapshot = JsonRepo(
            path=os.path.join(self.draft_dir, snapshot_filename),
            add_saved_at=True,
        )
        self.events = JsonlRepo(
            path=os.path.join(self.draft_dir, events_filename),
        )
        self.meta = JsonRepo(
            path=os.path.join(self.draft_dir, meta_filename),
            add_saved_at=True,
        )

    # ---------------- Paths / existence ----------------

    def paths(self) -> Dict[str, str]:
        return {
            "draft_dir": self.draft_dir,
            "snapshot": self.snapshot.path,
            "events": self.events.path,
            "meta": self.meta.path,
        }

    def exists_any(self) -> bool:
        p = self.paths()
        return (
            os.path.exists(p["snapshot"]) or
            os.path.exists(p["events"]) or
            os.path.exists(p["meta"])
        )

    def exists_complete(self) -> bool:
        p = self.paths()
        return os.path.exists(p["snapshot"]) and os.path.exists(p["events"]) and os.path.exists(p["meta"])

    # ---------------- Meta ----------------

    def load_meta(self) -> Dict[str, Any]:
        v = self.meta.load({})
        return v if isinstance(v, dict) else {}

    def save_meta(self, meta: Dict[str, Any]) -> None:
        os.makedirs(self.draft_dir, exist_ok=True)
        self.meta.save(dict(meta or {}))

    def get_base_version(self) -> Optional[int]:
        m = self.load_meta()
        try:
            bv = m.get("base_version", None)
            return int(bv) if bv is not None else None
        except Exception:
            return None

    # ---------------- Snapshot ----------------

    def load_snapshot(self) -> Dict[str, Any]:
        v = self.snapshot.load({})
        return v if isinstance(v, dict) else {}

    def save_snapshot(self, snapshot: Dict[str, Any]) -> None:
        os.makedirs(self.draft_dir, exist_ok=True)
        self.snapshot.save(dict(snapshot or {}))

    # ---------------- Events ----------------

    def load_events(self) -> List[dict]:
        return self.events.load_all()

    def save_events(self, events: List[dict]) -> None:
        os.makedirs(self.draft_dir, exist_ok=True)
        self.events.replace_all(events or [])

    # ---------------- High-level CRUD ----------------

    def save_draft(
        self,
        *,
        snapshot: Dict[str, Any],
        events: List[dict],
        base_version: int,
        name: Optional[str] = None,
    ) -> None:
        """
        Guarda draft completo: snapshot + events + meta(base_version).
        La lógica de "resequence_versions" NO va aquí: eso ocurre antes (service/store).
        """
        os.makedirs(self.draft_dir, exist_ok=True)

        self.save_snapshot(snapshot)
        self.save_events(events)

        existing_meta = self.load_meta()
        draft_name = name if name is not None else existing_meta.get("name")
        if isinstance(draft_name, str):
            draft_name = draft_name.strip() or None

        meta = {
            "schema": 1,
            "base_version": int(base_version),
            "events_count": len(events or []),
        }
        if draft_name:
            meta["name"] = draft_name
        self.save_meta(meta)

    def load_draft(self) -> Tuple[Dict[str, Any], List[dict], Dict[str, Any]]:
        """
        Devuelve (snapshot, events, meta).
        Si faltan archivos, devuelve estructuras vacías.
        """
        snap = self.load_snapshot()
        evs = self.load_events()
        meta = self.load_meta()
        return snap, evs, meta

    def delete_draft(self) -> None:
        """
        Elimina snapshot/events/meta si existen. Si la carpeta queda vacía, intenta borrarla.
        """
        p = self.paths()
        for k in ("snapshot", "events", "meta"):
            try:
                if os.path.exists(p[k]):
                    os.remove(p[k])
            except Exception:
                pass

        # intenta borrar directorio si quedó vacío
        try:
            if os.path.isdir(p["draft_dir"]) and not os.listdir(p["draft_dir"]):
                os.rmdir(p["draft_dir"])
        except Exception:
            pass

    # ---------------- Version / conflict helpers ----------------

    def check_against_cloud_head(self, cloud_head: int) -> Dict[str, Any]:
        """
        Retorna un dict con status:
          - missing: no hay draft
          - incomplete: hay residuos pero falta algo
          - ok: base_version == cloud_head
          - conflict: base_version != cloud_head
          - unknown: meta sin base_version
        """
        if not self.exists_any():
            return {"status": "missing", "base_version": None, "cloud_head": int(cloud_head)}

        if not self.exists_complete():
            return {"status": "incomplete", "base_version": self.get_base_version(), "cloud_head": int(cloud_head)}

        bv = self.get_base_version()
        if bv is None:
            return {"status": "unknown", "base_version": None, "cloud_head": int(cloud_head)}

        if int(bv) == int(cloud_head):
            return {"status": "ok", "base_version": int(bv), "cloud_head": int(cloud_head)}

        return {"status": "conflict", "base_version": int(bv), "cloud_head": int(cloud_head)}

    def delete_if_conflict(self, cloud_head: int) -> bool:
        """
        Borra el draft si hay conflicto. Retorna True si borró.
        """
        chk = self.check_against_cloud_head(cloud_head)
        if chk.get("status") in ("conflict", "incomplete"):
            self.delete_draft()
            return True
        return False
    
    def rename_draft(self, name: str) -> Dict[str, Any]:
        meta = self.load_meta()
        meta = dict(meta or {})
        cleaned = (name or "").strip()
        if cleaned:
            meta["name"] = cleaned
        self.save_meta(meta)
        return meta


class DraftsRepo:
    """
    Maneja múltiples borradores guardados en subdirectorios draft_<id>.
    """

    def __init__(
        self,
        data_dir: str,
        *,
        drafts_dirname: str = "drafts",
        draft_prefix: str = "draft",
    ) -> None:
        self.data_dir = data_dir
        self.drafts_dirname = drafts_dirname
        self.draft_prefix = draft_prefix
        self.drafts_dir = os.path.join(data_dir, drafts_dirname)

    def _sanitize_id(self, draft_id: str) -> Optional[str]:
        if not isinstance(draft_id, str):
            return None
        cleaned = re.sub(r"[^a-zA-Z0-9_-]", "", draft_id.strip())
        return cleaned or None

    def _draft_dirname(self, draft_id: str) -> str:
        return f"{self.draft_prefix}_{draft_id}"

    def _repo_for(self, draft_id: str) -> DraftRepo:
        dirname = os.path.join(self.drafts_dirname, self._draft_dirname(draft_id))
        return DraftRepo(data_dir=self.data_dir, draft_dirname=dirname)

    def _iter_draft_ids(self) -> List[str]:
        if not os.path.isdir(self.drafts_dir):
            return []
        prefix = f"{self.draft_prefix}_"
        ids: List[str] = []
        for entry in os.listdir(self.drafts_dir):
            if not entry.startswith(prefix):
                continue
            draft_id = entry[len(prefix):]
            if draft_id:
                ids.append(draft_id)
        return ids

    def list_drafts(self) -> List[Dict[str, Any]]:
        drafts: List[Dict[str, Any]] = []
        for draft_id in self._iter_draft_ids():
            repo = self._repo_for(draft_id)
            if not repo.exists_any():
                continue
            meta = repo.load_meta()
            name = None
            if isinstance(meta, dict):
                name = meta.get("name")
            if not isinstance(name, str) or not name.strip():
                name = "Borrador sin nombre"
            drafts.append(
                {
                    "id": draft_id,
                    "name": name,
                    "saved_at": meta.get("saved_at") if isinstance(meta, dict) else None,
                    "base_version": meta.get("base_version") if isinstance(meta, dict) else None,
                    "events_count": meta.get("events_count") if isinstance(meta, dict) else None,
                }
            )
        drafts.sort(key=lambda entry: entry.get("saved_at") or "", reverse=True)
        return drafts

    def _generate_id(self) -> str:
        return uuid.uuid4().hex

    def create_draft(
        self,
        *,
        snapshot: Dict[str, Any],
        events: List[dict],
        base_version: int,
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        os.makedirs(self.drafts_dir, exist_ok=True)
        draft_id = self._generate_id()
        while os.path.exists(
            os.path.join(self.drafts_dir, self._draft_dirname(draft_id))
        ):
            draft_id = self._generate_id()
        repo = self._repo_for(draft_id)
        repo.save_draft(
            snapshot=snapshot,
            events=events,
            base_version=base_version,
            name=name,
        )
        meta = repo.load_meta()
        return {"id": draft_id, "meta": meta}

    def save_draft(
        self,
        *,
        draft_id: str,
        snapshot: Dict[str, Any],
        events: List[dict],
        base_version: int,
        name: Optional[str] = None,
    ) -> Dict[str, Any]:
        normalized = self._sanitize_id(draft_id)
        if not normalized:
            raise ValueError("invalid draft id")
        repo = self._repo_for(normalized)
        repo.save_draft(
            snapshot=snapshot,
            events=events,
            base_version=base_version,
            name=name,
        )
        return {"id": normalized, "meta": repo.load_meta()}

    def rename_draft(self, draft_id: str, name: str) -> Dict[str, Any]:
        normalized = self._sanitize_id(draft_id)
        if not normalized:
            raise ValueError("invalid draft id")
        repo = self._repo_for(normalized)
        meta = repo.rename_draft(name)
        return {"id": normalized, "meta": meta}

    def delete_draft(self, draft_id: str) -> bool:
        normalized = self._sanitize_id(draft_id)
        if not normalized:
            return False
        repo = self._repo_for(normalized)
        had_any = repo.exists_any()
        repo.delete_draft()
        return had_any

    def load_draft(self, *, draft_id: str, cloud_head: int) -> Dict[str, Any]:
        normalized = self._sanitize_id(draft_id)
        if not normalized:
            return {"status": "missing"}
        repo = self._repo_for(normalized)
        if not repo.exists_any():
            return {"status": "missing"}
        chk = repo.check_against_cloud_head(cloud_head)
        status = chk.get("status")
        if status != "ok":
            repo.delete_draft()
            return {"status": "conflict", "deleted": True}
        snap, events, meta = repo.load_draft()
        return {
            "status": "ok",
            "draft": {"id": normalized, "meta": meta},
            "snapshot": snap,
            "events": events,
        }
