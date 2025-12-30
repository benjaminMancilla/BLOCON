from __future__ import annotations

from typing import List, Optional

from .events import Event


class InMemoryEventStore:
    """
    Store en memoria:
      - mantiene lista de eventos + head (undo/redo)
      - resequence_versions / base_version
    NO hace persistencia.
    """

    def __init__(self, initial: Optional[List[Event]] = None):
        self.events: List[Event] = list(initial or [])
        self.base_version: Optional[int] = None
        self.head: int = len(self.events) - 1

    def append(self, ev: Event) -> None:
        # si hay "redo tail", se descarta al append (comportamiento típico)
        if self.head < len(self.events) - 1:
            self.events = self.events[: self.head + 1]

        # auto-asignación de versión si corresponde
        if getattr(ev, "version", None) is None and self.base_version is not None:
            # base_version + 1, base_version + 2, ...
            ev.version = int(self.base_version) + (self.head + 1) + 1

        self.events.append(ev)
        self.head = len(self.events) - 1

    def all(self) -> List[Event]:
        return list(self.events)

    def clear(self) -> None:
        self.events.clear()
        self.head = -1
        self.base_version = None

    def replace(self, events: List[Event]) -> None:
        self.events = list(events or [])
        self.set_head_to_end()

    def resequence_versions(self, start_from: int) -> None:
        """
        Sella version para los eventos ACTIVOS como:
          start_from+1, start_from+2, ...
        """
        self.base_version = int(start_from)
        v = int(start_from)

        for ev in self.active():
            v += 1
            ev.version = v

        # los eventos "no activos" (undo tail) quedan sin version sellada
        for ev in self.events[self.head + 1 :]:
            try:
                ev.version = None
            except Exception:
                pass

    def set_head_to_end(self) -> None:
        self.head = len(self.events) - 1

    # ----- Undo/Redo -----

    def can_undo(self) -> bool:
        return self.head >= 0

    def can_redo(self) -> bool:
        return self.head < len(self.events) - 1

    def undo(self) -> bool:
        if not self.can_undo():
            return False
        self.head -= 1
        return True

    def redo(self) -> bool:
        if not self.can_redo():
            return False
        self.head += 1
        return True

    def active(self) -> List[Event]:
        if self.head < 0:
            return []
        return self.events[: self.head + 1]
