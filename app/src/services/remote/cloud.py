from __future__ import annotations
import logging
import time
from contextlib import contextmanager
from typing import Dict, Any, List, Tuple

from .clients import (
    SharePointSnapshotClient,
    SharePointComponentsClient,
    SharePointEventsClient,
)

from ..cache.local_store import LocalWorkspaceStore
from ...model.eventsourcing.events import SetIgnoreRangeEvent


ISO = lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
LOG = logging.getLogger(__name__)

class CloudAtomicOperation:
    def __init__(self, cloud: "CloudClient", name: str):
        self.cloud = cloud
        self.name = name
        self._sp_events = cloud._sp_events()
        self._sp_snapshot = cloud._sp_snapshot()
        if self._sp_events is None or self._sp_snapshot is None:
            raise RuntimeError("SharePoint clients not configured")
        self._head_before: int | None = None
        self._expected_events = 0
        self._events_payload: list[dict] = []
        self._snapshot_payload: dict | None = None
        self._coordination_id: str | None = None
        self._committed = False
        self._events_committed = False

    def head_version(self) -> int:
        return len(self._sp_events.load_events())

    def append_events(self, events: list[dict]) -> int:
        if not events:
            return 0
        self._expected_events = len(events)
        self._events_payload = [dict(ev) for ev in events]
        if self._head_before is None:
            self._head_before = self.head_version()
        return len(events)

    def save_snapshot(self, snapshot: Dict[str, Any]) -> None:
        snapshot = dict(snapshot or {})
        self._snapshot_payload = snapshot

    def commit(self) -> None:
        if self._committed:
            return
        if not self._events_payload or self._snapshot_payload is None:
            raise RuntimeError(f"{self.name} is missing events or snapshot payload")
        if self._head_before is None:
            self._head_before = self.head_version()
        coordination = {
            "id": f"{self.name}-{ISO()}-{self._head_before}",
            "timestamp": ISO(),
            "expected_events": self._expected_events,
            "head_before": self._head_before,
            "operation": self.name,
        }
        self._coordination_id = coordination["id"]
        for event in self._events_payload:
            event["coordination"] = dict(coordination)
        snapshot = dict(self._snapshot_payload or {})
        snapshot["saved_at"] = ISO()
        snapshot["coordination"] = {
            **coordination,
            "events_appended": self._expected_events,
        }
        self._snapshot_payload = snapshot
        count = self._sp_events.append_events(self._events_payload)
        if count != len(self._events_payload):
            raise RuntimeError(
                f"Partial event append ({count}/{len(self._events_payload)}) during {self.name}"
            )
        self._events_committed = True
        self._sp_snapshot.save_snapshot(snapshot)
        try:
            self._validate_consistency()
        except Exception as exc:
            LOG.warning("Consistency check failed for %s: %s", self.name, exc)
            self._repair_with_retry()
            self._validate_consistency()
        self._committed = True

    def _validate_consistency(self) -> None:
        if not self._coordination_id:
            raise RuntimeError(f"{self.name} missing coordination id")
        snapshot = self._sp_snapshot.load_snapshot()
        if not isinstance(snapshot, dict):
            raise RuntimeError(f"{self.name} snapshot missing after commit")
        snapshot_coord = snapshot.get("coordination") or {}
        if snapshot_coord.get("id") != self._coordination_id:
            raise RuntimeError(
                f"{self.name} snapshot coordination mismatch ({snapshot_coord.get('id')})"
            )
        if int(snapshot_coord.get("expected_events") or 0) != int(self._expected_events):
            raise RuntimeError(
                f"{self.name} snapshot expected_events mismatch ({snapshot_coord.get('expected_events')})"
            )
        if self._expected_events <= 0:
            return
        events = self._sp_events.load_events()
        if len(events) < self._expected_events:
            raise RuntimeError(f"{self.name} events missing after commit")
        tail = events[-self._expected_events :]
        coord_ids = {
            (ev.get("coordination") or {}).get("id")
            for ev in tail
        }
        if coord_ids != {self._coordination_id}:
            raise RuntimeError(
                f"{self.name} events coordination mismatch ({coord_ids})"
            )

    def _repair_with_retry(self, max_attempts: int = 3, base_delay: float = 0.2) -> None:
        if not self._coordination_id:
            raise RuntimeError(f"{self.name} missing coordination id for repair")
        events = self._sp_events.load_events()
        events_written = False
        if self._expected_events > 0 and len(events) >= self._expected_events:
            tail = events[-self._expected_events :]
            events_written = all(
                (ev.get("coordination") or {}).get("id") == self._coordination_id
                for ev in tail
            )
        snapshot = self._sp_snapshot.load_snapshot()
        snapshot_coord = snapshot.get("coordination") if isinstance(snapshot, dict) else {}
        snapshot_written = snapshot_coord and snapshot_coord.get("id") == self._coordination_id
        if snapshot_written and not events_written:
            raise RuntimeError(f"{self.name} snapshot written but events missing; aborting")
        if not events_written:
            raise RuntimeError(f"{self.name} events missing; cannot repair snapshot")
        for attempt in range(1, max_attempts + 1):
            delay = base_delay * (2 ** (attempt - 1))
            LOG.warning(
                "Repair attempt %s/%s for %s (snapshot)", attempt, max_attempts, self.name
            )
            snapshot_payload = dict(self._snapshot_payload or {})
            snapshot_payload["repair"] = {
                "attempt": attempt,
                "attempted_at": ISO(),
                "operation": self.name,
            }
            self._sp_snapshot.save_snapshot(snapshot_payload)
            time.sleep(delay)
            try:
                self._validate_consistency()
                return
            except Exception:
                continue
        raise RuntimeError(f"{self.name} failed to repair snapshot after {max_attempts} attempts")

    def commit_local(self) -> None:
        if self._snapshot_payload is not None:
            self.cloud.local.save_snapshot(self._snapshot_payload)
        if self._events_payload:
            self.cloud.local.append_events(self._events_payload)

    def rollback(self) -> None:
        if not self._events_payload or not self._events_committed:
            return
        if self._head_before is None:
            return
        start_v = self._head_before + 1
        end_v = self._head_before + self._expected_events
        if end_v < start_v:
            return
        ignore_event = SetIgnoreRangeEvent.create(
            start_v=start_v, end_v=end_v, actor=f"{self.name}-rollback"
        )
        ignore_dict = ignore_event.to_dict()
        ignore_dict["version"] = end_v + 1
        self._sp_events.append_events([ignore_dict])


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

    @contextmanager
    def atomic_operation(self, name: str):
        op = CloudAtomicOperation(self, name)
        try:
            yield op
            op.commit()
            op.commit_local()
        except Exception as exc:
            try:
                op.rollback()
            except Exception as rollback_exc:
                raise RuntimeError(
                    f"{name} failed and rollback failed: {rollback_exc}"
                ) from exc
            raise


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
