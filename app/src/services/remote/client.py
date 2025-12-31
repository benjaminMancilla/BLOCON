"""Cliente principal para operaciones cloud con SharePoint."""
from __future__ import annotations
import logging
from contextlib import contextmanager
from typing import Dict, Any
import time

from .clients import (
    SharePointSnapshotClient,
    SharePointComponentsClient,
    SharePointEventsClient,
)
from ..cache.local_store import LocalWorkspaceStore
from .atomic import CloudAtomicOperation
from .fallback import try_cloud_with_fallback, require_cloud_client
from .errors import normalize_cloud_error

ISO = lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
LOG = logging.getLogger(__name__)


class CloudClient:
    """Cliente para operaciones con SharePoint."""
    
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.local = LocalWorkspaceStore()
        
        # Lazy-loaded clients
        self._sp_components_checked = False
        self._sp_components_client = None
        self._sp_events_checked = False
        self._sp_events_client = None
        self._sp_snapshot_checked = False
        self._sp_snapshot_client = None

    # ========== Context manager para operaciones atómicas ==========

    @contextmanager
    def atomic_operation(self, name: str):
        """Context manager para operaciones atómicas en cloud."""
        op = CloudAtomicOperation(self, name)
        try:
            yield op
            op.commit()
            op.commit_local()
        except Exception as exc:
            print(f"[atomic] Exception caught: {exc}")
            try:
                op.rollback()
            except Exception as rollback_exc:
                raise normalize_cloud_error(
                    name,
                    RuntimeError(f"{name} failed and rollback failed: {rollback_exc}"),
                ) from exc
            raise normalize_cloud_error(name, exc) from exc

    # ========== Lazy initialization de clientes ==========

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

    # ========== Operaciones de snapshot ==========

    def load_snapshot(
        self,
        *,
        update_local: bool = True,
        allow_local_fallback: bool = True,
        operation: str = "cloud-load",
    ) -> Dict[str, Any]:
        """Carga snapshot desde SharePoint o fallback local."""
        sp = self._sp_snapshot()
        
        if sp is None:
            if not allow_local_fallback:
                require_cloud_client(sp, operation)
            return self.local.load_snapshot()
        
        def cloud_fn():
            return sp.load_snapshot()
        
        def local_fn():
            return self.local.load_snapshot()
        
        def update_fn(snap):
            if isinstance(snap, dict):
                self.local.save_snapshot(snap)
        
        return try_cloud_with_fallback(
            operation,
            cloud_fn,
            local_fn,
            allow_fallback=allow_local_fallback,
            update_local=update_fn if update_local else None,
        )

    def save_snapshot(self, snapshot: Dict[str, Any]) -> None:
        """Guarda snapshot en local y opcionalmente en SharePoint."""
        snapshot = dict(snapshot or {})
        snapshot["saved_at"] = ISO()
        
        self.local.save_snapshot(snapshot)
        
        sp = self._sp_snapshot()
        if sp is not None:
            try:
                sp.save_snapshot(snapshot)
            except Exception as exc:
                LOG.warning("Failed to save snapshot to SharePoint: %s", exc)

    # ========== Operaciones de componentes ==========

    def fetch_components(
        self,
        ids,
        *,
        update_local: bool = True,
        allow_local_fallback: bool = True,
        operation: str = "fetch-components",
    ):
        """Obtiene componentes por IDs desde SharePoint o fallback local."""
        sp = self._sp_components()
        
        if sp is None:
            if not allow_local_fallback:
                require_cloud_client(sp, operation)
            return self.local.fetch_components(ids)
        
        def cloud_fn():
            return sp.fetch_components_by_ids(ids)
        
        def local_fn():
            return self.local.fetch_components(ids)
        
        def update_fn(data):
            entries = [{"id": k, **v} for k, v in data.items()]
            self.local.upsert_components_cache(entries)
        
        return try_cloud_with_fallback(
            operation,
            cloud_fn,
            local_fn,
            allow_fallback=allow_local_fallback,
            update_local=update_fn if update_local else None,
        )

    def search_components(
        self,
        query,
        page=1,
        page_size=20,
        *,
        allow_local_fallback: bool = True,
        operation: str = "search-components",
    ):
        """Busca componentes en SharePoint o fallback local."""
        sp = self._sp_components()
        
        if sp is None:
            if not allow_local_fallback:
                require_cloud_client(sp, operation)
            return self.local.search_components(query, page=page, page_size=page_size)
        
        def cloud_fn():
            return sp.search_components(query=query, page=page, page_size=page_size)
        
        def local_fn():
            return self.local.search_components(query, page=page, page_size=page_size)
        
        return try_cloud_with_fallback(
            operation,
            cloud_fn,
            local_fn,
            allow_fallback=allow_local_fallback,
        )

    # ========== Operaciones de eventos ==========

    def load_events(
        self,
        *,
        update_local: bool = True,
        allow_local_fallback: bool = True,
        operation: str = "cloud-load",
    ) -> list[dict]:
        """Carga eventos desde SharePoint o fallback local."""
        sp = self._sp_events()
        
        if sp is None:
            if not allow_local_fallback:
                require_cloud_client(sp, operation)
            return self.local.load_events()
        
        def cloud_fn():
            return sp.load_events()
        
        def local_fn():
            return self.local.load_events()
        
        def update_fn(evs):
            self.local.replace_events(evs)
        
        return try_cloud_with_fallback(
            operation,
            cloud_fn,
            local_fn,
            allow_fallback=allow_local_fallback,
            update_local=update_fn if update_local else None,
        )

    def append_events(
        self,
        events: list[dict],
        *,
        allow_local_fallback: bool = True,
        operation: str = "cloud-save",
    ) -> int:
        """Agrega eventos a SharePoint o fallback local."""
        if not events:
            return 0
        
        sp = self._sp_events()
        
        if sp is None:
            if not allow_local_fallback:
                require_cloud_client(sp, operation)
            return self.local.append_events(events)
        
        def cloud_fn():
            n = sp.append_events(events)
            self.local.append_events(events)
            return n
        
        def local_fn():
            return self.local.append_events(events)
        
        return try_cloud_with_fallback(
            operation,
            cloud_fn,
            local_fn,
            allow_fallback=allow_local_fallback,
        )

    # ========== Búsqueda de eventos ==========

    def search_events_by_version(
        self,
        *,
        version: int,
        offset: int = 0,
        limit: int = 50,
        allow_local_fallback: bool = True,
        operation: str = "event-history",
    ) -> tuple[list[dict], int]:
        """Busca eventos por versión."""
        sp = self._sp_events()
        
        if sp is None:
            if not allow_local_fallback:
                require_cloud_client(sp, operation)
            return self._search_events_by_version_local(version, offset, limit)
        
        def cloud_fn():
            return sp.search_events_by_version(version, offset=offset, limit=limit)
        
        def local_fn():
            return self._search_events_by_version_local(version, offset, limit)
        
        return try_cloud_with_fallback(
            operation,
            cloud_fn,
            local_fn,
            allow_fallback=allow_local_fallback,
        )

    def _search_events_by_version_local(
        self, version: int, offset: int, limit: int
    ) -> tuple[list[dict], int]:
        """Implementación local de búsqueda por versión."""
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
        allow_local_fallback: bool = True,
        operation: str = "event-history",
    ) -> tuple[list[dict], int]:
        """Busca eventos por kind."""
        sp = self._sp_events()
        
        if sp is None:
            if not allow_local_fallback:
                require_cloud_client(sp, operation)
            return self._search_events_by_kind_local(
                kind_prefix, kinds, offset, limit
            )
        
        def cloud_fn():
            return sp.search_events_by_kind(
                kind_prefix=kind_prefix, kinds=kinds, offset=offset, limit=limit
            )
        
        def local_fn():
            return self._search_events_by_kind_local(
                kind_prefix, kinds, offset, limit
            )
        
        return try_cloud_with_fallback(
            operation,
            cloud_fn,
            local_fn,
            allow_fallback=allow_local_fallback,
        )

    def _search_events_by_kind_local(
        self,
        kind_prefix: str | None,
        kinds: list[str] | None,
        offset: int,
        limit: int,
    ) -> tuple[list[dict], int]:
        """Implementación local de búsqueda por kind."""
        prefix = (kind_prefix or "").strip().lower()
        kinds_set = {str(k).strip().lower() for k in (kinds or []) if k}

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
        self,
        *,
        timestamp_prefix: str,
        offset: int = 0,
        limit: int = 50,
        allow_local_fallback: bool = True,
        operation: str = "event-history",
    ) -> tuple[list[dict], int]:
        """Busca eventos por timestamp."""
        sp = self._sp_events()
        
        if sp is None:
            if not allow_local_fallback:
                require_cloud_client(sp, operation)
            return self._search_events_by_timestamp_local(
                timestamp_prefix, offset, limit
            )
        
        def cloud_fn():
            return sp.search_events_by_timestamp(
                timestamp_prefix, offset=offset, limit=limit
            )
        
        def local_fn():
            return self._search_events_by_timestamp_local(
                timestamp_prefix, offset, limit
            )
        
        return try_cloud_with_fallback(
            operation,
            cloud_fn,
            local_fn,
            allow_fallback=allow_local_fallback,
        )

    def _search_events_by_timestamp_local(
        self, timestamp_prefix: str, offset: int, limit: int
    ) -> tuple[list[dict], int]:
        """Implementación local de búsqueda por timestamp."""
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

    # ========== Manifest ==========

    def load_manifest(self) -> Dict[str, Any]:
        return self.local.load_manifest()

    def save_manifest(self, manifest: Dict[str, Any]) -> None:
        manifest = dict(manifest or {})
        manifest["saved_at"] = ISO()
        self.local.save_manifest(manifest)

    # ========== Failures (legacy?) ==========

    def fetch_failures_by_ids(self, component_ids, page=1, page_size=200):
        sp = getattr(self, "_sp_failures", lambda: None)()
        if sp is not None:
            rows = sp.fetch_failures_for_components(component_ids)
            total = len(rows)
            start = (max(1, page) - 1) * max(1, page_size)
            return rows[start : start + page_size], total
        return self.local.fetch_failures_by_ids(
            component_ids, page=page, page_size=page_size
        )