from __future__ import annotations

from dataclasses import asdict, is_dataclass
from typing import List

from .jsonl import JsonlRepo
from ....model.eventsourcing.events import Event, event_from_dict  # ajusta el import según tu árbol real


def _event_to_dict(ev: Event) -> dict:
    if hasattr(ev, "to_dict"):
        try:
            return ev.to_dict()
        except Exception:
            pass

    try:
        if is_dataclass(ev):
            return asdict(ev)
    except Exception:
        pass

    try:
        return dict(getattr(ev, "__dict__", {}) or {})
    except Exception:
        return {}


class EventLogRepo:
    """
    Repo infra: persiste Event en JSONL.
    NO conoce LocalWorkspaceStore. Solo recibe un path.
    """
    def __init__(self, path: str):
        self._repo = JsonlRepo(path=path)

    @property
    def path(self) -> str:
        return self._repo.path

    def load_all(self) -> List[Event]:
        out: List[Event] = []
        for d in self._repo.load_all():
            if not isinstance(d, dict):
                continue
            try:
                out.append(event_from_dict(d))
            except Exception:
                continue
        return out

    def replace_all(self, events: List[Event]) -> None:
        self._repo.replace_all([_event_to_dict(e) for e in (events or [])])

    def append_one(self, ev: Event) -> None:
        self._repo.append_many([_event_to_dict(ev)])

    def clear(self) -> None:
        self._repo.replace_all([])

