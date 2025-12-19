from __future__ import annotations

import os
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

    def save_draft(self, *, snapshot: Dict[str, Any], events: List[dict], base_version: int) -> None:
        """
        Guarda draft completo: snapshot + events + meta(base_version).
        La lógica de "resequence_versions" NO va aquí: eso ocurre antes (service/store).
        """
        os.makedirs(self.draft_dir, exist_ok=True)

        self.save_snapshot(snapshot)
        self.save_events(events)

        meta = {
            "schema": 1,
            "base_version": int(base_version),
            "events_count": len(events or []),
        }
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
