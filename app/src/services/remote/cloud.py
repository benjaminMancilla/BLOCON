from __future__ import annotations
import os, json, time
from typing import Dict, Any, List, Tuple

from .clients import (
    SharePointSnapshotClient,
    SharePointComponentsClient,
    SharePointEventsClient,
)

from ..cache.local_store import LocalWorkspaceStore


ISO = lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

class CloudClient:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.local = LocalWorkspaceStore()
        
        self._sp_components_checked = False
        self._sp_components_client = None
        self._sp_events_checked = False
        self._sp_events_client = None
        self._sp_snapshot_checked = False
        self._sp_snapshot_client = None


    def _sp_components(self):
        if self._sp_components_checked:
            return self._sp_components_client
        self._sp_components_checked = True
        try:
            self._sp_components_client = SharePointComponentsClient.from_env(
                project_root=self.base_dir
            )
        except Exception:
            self._sp_components_client = None
        return self._sp_components_client

    def _sp_events(self):
        """Lazy init del cliente de eventos en SharePoint."""
        if self._sp_events_checked:
            return self._sp_events_client
        self._sp_events_checked = True
        try:
            self._sp_events_client = SharePointEventsClient.from_env(
                project_root=self.base_dir
            )
        except Exception:
            self._sp_events_client = None
        return self._sp_events_client

    def _sp_snapshot(self):
        """Lazy init del cliente para snapshot global en SharePoint."""
        if self._sp_snapshot_checked:
            return self._sp_snapshot_client
        self._sp_snapshot_checked = True
        try:
            self._sp_snapshot_client = SharePointSnapshotClient.from_env(
                project_root=self.base_dir
            )
        except Exception:
            self._sp_snapshot_client = None
        return self._sp_snapshot_client


    # -------- Server read helpers --------

    def load_manifest(self) -> Dict[str, Any]:
        return self.local.load_manifest()

    def load_snapshot(self) -> Dict[str, Any]:
        sp = self._sp_snapshot()
        if sp is not None:
            try:
                snap = sp.load_snapshot()
                # opcional: mantener cache local al día
                if isinstance(snap, dict):
                    self.local.save_snapshot(snap)
                return snap
            except Exception:
                pass
        return self.local.load_snapshot()

    def fetch_components(self, ids):
        sp = self._sp_components()
        if sp is not None:
            data = sp.fetch_components_by_ids(ids)
            # opcional: cache write-through
            self.local.upsert_components_cache([{"id": k, **v} for k, v in data.items()])
            return data
        return self.local.fetch_components(ids)

    def search_components(self, query, page=1, page_size=20):
        sp = self._sp_components()
        if sp is not None:
            return sp.search_components(query=query, page=page, page_size=page_size)
        return self.local.search_components(query=query, page=page, page_size=page_size)


    # -------- Save snapshot + manifest (server) --------
    def save_snapshot(self, snapshot: Dict[str, Any]) -> None:
        snapshot = dict(snapshot or {})
        snapshot["saved_at"] = ISO()

        # siempre guarda local (workspace)
        self.local.save_snapshot(snapshot)

        sp = self._sp_snapshot()
        if sp is not None:
            try:
                sp.save_snapshot(snapshot)
            except Exception:
                pass

    def save_manifest(self, manifest: Dict[str, Any]) -> None:
        manifest = dict(manifest or {})
        manifest["saved_at"] = ISO()
        self.local.save_manifest(manifest)

    def load_events(self) -> list[dict]:
        sp = self._sp_events()
        if sp is not None:
            try:
                evs = sp.load_events()
                # opcional: write-through local
                self.local.replace_events(evs)
                return evs
            except Exception:
                pass
        return self.local.load_events()

    def append_events(self, events: list[dict]) -> int:
        if not events:
            return 0

        sp = self._sp_events()
        if sp is not None:
            try:
                n = sp.append_events(events)
                # mantener local al día
                self.local.append_events(events)
                return n
            except Exception:
                pass
        return self.local.append_events(events)

    def search_events_by_version(self, *, version: int, offset: int = 0, limit: int = 50) -> tuple[list[dict], int]:
        sp = self._sp_events()
        if sp is not None:
            return sp.search_events_by_version(version, offset=offset, limit=limit)

        events = self.local.load_events()
        filtered = []
        for ev in events:
            try:
                if int(ev.get("version")) == int(version):
                    filtered.append(ev)
            except Exception:
                continue
        total = len(filtered)
        return filtered[offset : offset + limit], total

    def search_events_by_kind(
        self,
        *,
        kind_prefix: str | None = None,
        kinds: list[str] | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[dict], int]:
        sp = self._sp_events()
        if sp is not None:
            return sp.search_events_by_kind(
                kind_prefix=kind_prefix, kinds=kinds, offset=offset, limit=limit
            )

        prefix = (kind_prefix or "").strip().lower()
        kinds_set = {str(kind).strip().lower() for kind in (kinds or []) if kind}

        def matches(event: dict) -> bool:
            kind = str(event.get("kind") or "").strip().lower()
            if prefix and kind.startswith(prefix):
                return True
            if kinds_set and kind in kinds_set:
                return True
            return False

        filtered = [ev for ev in self.local.load_events() if matches(ev)]
        total = len(filtered)
        return filtered[offset : offset + limit], total

    def search_events_by_timestamp(
        self, *, timestamp_prefix: str, offset: int = 0, limit: int = 50
    ) -> tuple[list[dict], int]:
        sp = self._sp_events()
        if sp is not None:
            return sp.search_events_by_timestamp(
                timestamp_prefix, offset=offset, limit=limit
            )

        prefix = (timestamp_prefix or "").strip()
        if not prefix:
            return [], 0
        filtered = [
            ev
            for ev in self.local.load_events()
            if str(ev.get("ts") or "").startswith(prefix)
        ]
        total = len(filtered)
        return filtered[offset : offset + limit], total

    def fetch_failures_by_ids(self, component_ids, page=1, page_size=200):
        sp = getattr(self, "_sp_failures", lambda: None)()
        if sp is not None:
            # si tu SP client devuelve lista completa, pagínala aquí o en el repo
            rows = sp.fetch_failures_for_components(component_ids)
            total = len(rows)
            start = (max(1, page)-1) * max(1, page_size)
            return rows[start:start+page_size], total
        return self.local.fetch_failures_by_ids(component_ids, page=page, page_size=page_size)
