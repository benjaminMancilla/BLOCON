from __future__ import annotations
import logging
import time
from typing import Dict, Any, TYPE_CHECKING

if TYPE_CHECKING:
    from .client import CloudClient

from ...model.eventsourcing.events import SetIgnoreRangeEvent

ISO = lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
LOG = logging.getLogger(__name__)


class CloudAtomicOperation:
    """Operación atómica que coordina escrituras a eventos y snapshot."""
    
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
        """Retorna la versión máxima en SharePoint."""
        return self._sp_events.get_max_version()

    def append_events(self, events: list[dict]) -> int:
        if not events:
            return 0
        if self._head_before is None:
            self._head_before = self.head_version()
        self._expected_events = len(events)
        self._events_payload = [dict(ev) for ev in events]
        return len(events)

    def save_snapshot(self, snapshot: Dict[str, Any]) -> None:
        snapshot = dict(snapshot or {})
        self._snapshot_payload = snapshot

    def _validate_consistency_with_retry(
        self, 
        max_attempts: int = 4,
        base_delay: float = 2.2
    ) -> None:
        """Valida consistencia con reintentos para permitir propagación."""
        for attempt in range(1, max_attempts + 1):
            try:
                self._validate_consistency()
                return
            except RuntimeError as exc:
                if attempt == max_attempts:
                    raise

                delay = base_delay * (2 ** (attempt - 1))
                LOG.info(
                    "Consistency validation attempt %s/%s failed, retrying in %.2fs",
                    attempt, max_attempts, delay
                )
                time.sleep(delay)

    def commit(self) -> None:
        """Escribe eventos y snapshot a SharePoint de forma coordinada."""
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

        # Delay para esperar SP a propagar
        time.sleep(0.5)

        try:
            self._validate_consistency_with_retry()
        except Exception as exc:
            LOG.warning("Consistency check failed for %s: %s", self.name, exc)
            self._repair_with_retry()
            self._validate_consistency_with_retry()
        
        self._committed = True

    def _validate_consistency(self) -> None:
        """Valida que eventos y snapshot estén sincronizados."""
        if not self._coordination_id:
            raise RuntimeError(f"{self.name} missing coordination id")
        
        # Validar snapshot
        snapshot = self._sp_snapshot.load_snapshot()
        if not isinstance(snapshot, dict):
            raise RuntimeError(f"{self.name} snapshot missing after commit")
        
        snapshot_coord = snapshot.get("coordination") or {}
        if snapshot_coord.get("id") != self._coordination_id:
            raise RuntimeError(f"{self.name} snapshot coordination mismatch")
        
        if int(snapshot_coord.get("expected_events") or 0) != int(self._expected_events):
            raise RuntimeError(f"{self.name} snapshot expected_events mismatch")
        
        if self._expected_events <= 0:
            return
        
        head = self._sp_events.get_max_version()
        from_version = max(1, head - self._expected_events)
        events = self._sp_events.load_events(from_version=from_version)
        
        if len(events) < self._expected_events:
            raise RuntimeError(f"{self.name} events missing after commit")
        
        tail = events[-self._expected_events:]
        coord_ids = {
            (ev.get("coordination") or {}).get("id")
            for ev in tail
        }
        
        if coord_ids != {self._coordination_id}:
            raise RuntimeError(f"{self.name} events coordination mismatch")

    def _repair_with_retry(
        self,
        max_attempts: int = 3,
        base_delay: float = 1.2
    ) -> None:
        """Intenta reparar snapshot si falló la validación."""
        if not self._coordination_id:
            raise RuntimeError(f"{self.name} missing coordination id for repair")
        
        # Detectar qué falló
        events = self._sp_events.load_events()
        events_written = False
        
        if self._expected_events > 0 and len(events) >= self._expected_events:
            tail = events[-self._expected_events:]
            events_written = all(
                (ev.get("coordination") or {}).get("id") == self._coordination_id
                for ev in tail
            )
        
        snapshot = self._sp_snapshot.load_snapshot()
        snapshot_coord = (
            snapshot.get("coordination") if isinstance(snapshot, dict) else {}
        )
        snapshot_written = (
            snapshot_coord and
            snapshot_coord.get("id") == self._coordination_id
        )
        
        # Casos de error
        if snapshot_written and not events_written:
            raise RuntimeError(
                f"{self.name} snapshot written but events missing; aborting"
            )
        
        if not events_written:
            raise RuntimeError(
                f"{self.name} events missing; cannot repair snapshot"
            )
        
        # Reintentar snapshot con exponential backoff
        for attempt in range(1, max_attempts + 1):
            delay = base_delay * (2 ** (attempt - 1))
            LOG.warning(
                "Repair attempt %s/%s for %s (snapshot)",
                attempt, max_attempts, self.name
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
                LOG.info("Repair successful for %s", self.name)
                return
            except Exception:
                continue
        
        raise RuntimeError(
            f"{self.name} failed to repair snapshot after {max_attempts} attempts"
        )

    def commit_local(self) -> None:
        """Guarda el snapshot y eventos en cache local."""
        if self._snapshot_payload is not None:
            self.cloud.local.save_snapshot(self._snapshot_payload)
        if self._events_payload:
            self.cloud.local.append_events(self._events_payload)

    def rollback(self) -> None:
        """Marca los eventos como ignorados si ya fueron escritos."""
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
        
        try:
            self._sp_events.append_events([ignore_dict])
        except Exception as exc:
            LOG.error("Failed to append rollback event: %s", exc)