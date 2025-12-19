from __future__ import annotations
from typing import List, Optional

from .event_log import EventLogRepo
from ....model.eventsourcing.events import Event
from ....model.eventsourcing.ports import EventStorePort
from ....model.eventsourcing.in_memory_store import InMemoryEventStore


class JsonlEventStore(EventStorePort):
    """
    Store persistente (infra).
    - InMemoryEventStore: undo/redo + head + versionado (sin IO)
    - EventLogRepo: IO JSONL
    NO conoce LocalWorkspaceStore: recibe un repo (o sea, DI puro).
    """

    def __init__(self, log: EventLogRepo):
        self._log = log
        initial = self._log.load_all()
        self._mem = InMemoryEventStore(initial=initial)

    # --- atributos del puerto ---
    @property
    def base_version(self) -> Optional[int]:
        return self._mem.base_version

    @base_version.setter
    def base_version(self, v: Optional[int]) -> None:
        self._mem.base_version = v if v is None else int(v)

    @property
    def head(self) -> int:
        return self._mem.head

    @head.setter
    def head(self, v: int) -> None:
        self._mem.head = int(v)

    # --- API ---
    def append(self, ev: Event) -> None:
        had_redo_tail = self._mem.head < (len(self._mem.events) - 1)

        self._mem.append(ev)

        # Persistencia:
        if had_redo_tail:
            self._log.replace_all(self._mem.active())
        else:
            self._log.append_one(ev)

    def all(self) -> List[Event]:
        return self._mem.all()

    def active(self) -> List[Event]:
        return self._mem.active()

    def replace(self, events: List[Event]) -> None:
        self._mem.replace(events)
        self._log.replace_all(self._mem.active())

    def clear(self) -> None:
        self._mem.clear()
        self._log.clear()

    def resequence_versions(self, start_from: int) -> None:
        self._mem.resequence_versions(start_from)
        self._log.replace_all(self._mem.active())

    def set_head_to_end(self) -> None:
        self._mem.set_head_to_end()

    # --- undo/redo ---
    def can_undo(self) -> bool:
        return self._mem.can_undo()

    def can_redo(self) -> bool:
        return self._mem.can_redo()

    def undo(self) -> bool:
        return self._mem.undo()

    def redo(self) -> bool:
        return self._mem.redo()

