from __future__ import annotations
from typing import Optional

from .local_store import LocalWorkspaceStore
from .repositories.event_log import EventLogRepo
from .repositories.event_store_jsonl import JsonlEventStore


class EventStore(JsonlEventStore):
    """
    EventStore real (infra).
    Construye el repo con la ruta decidida por LocalWorkspaceStore (APPDATA),
    y entrega una implementación EventStorePort lista para inyectar en GraphES.
    """

    def __init__(
        self,
        local: LocalWorkspaceStore,
        *,
        base_version: int,
        filename: str = "events.local.jsonl",
        path_override: Optional[str] = None,
    ):
        path = path_override or local.eventsourcing_events_path(filename=filename)
        log = EventLogRepo(path=path)
        super().__init__(log, base_version=base_version)
