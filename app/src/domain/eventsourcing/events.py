
from __future__ import annotations
from dataclasses import dataclass, asdict, field
from typing import Literal, Dict, Any, Union
from datetime import datetime, timezone

EventKind = Literal[
    "snapshot", "add_component_relative", "remove_node",
    "add_root_component", "set_head", "edit_component", "edit_gate",
    "set_ignore_range"
]

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

@dataclass
class BaseEvent:
    kind: EventKind
    ts: str
    actor: str
    version: int | None = field(default=None, init=False)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["kind"] = self.kind
        return d

@dataclass
class SnapshotEvent(BaseEvent):
    data: Dict[str, Any]

    @staticmethod
    def create(data: Dict[str, Any], actor: str = "anonymous") -> "SnapshotEvent":
        return SnapshotEvent(kind="snapshot", ts=now_iso(), actor=actor, data=data)

@dataclass
class AddComponentRelativeEvent(BaseEvent):
    target_id: str
    new_comp_id: str
    relation: Literal["series", "parallel", "koon"]
    dist: Dict[str, Any]
    k: int | None = None
    unit_type: str | None = None

    @staticmethod
    def create(target_id: str, new_comp_id: str, relation: str, 
               dist: Dict[str, Any], k: int | None = None, unit_type: str | None = None,
               actor: str="anonymous") -> "AddComponentRelativeEvent":
        return AddComponentRelativeEvent(kind="add_component_relative", 
                                         ts=now_iso(), actor=actor,
                                         target_id=target_id, new_comp_id=new_comp_id, 
                                         relation=relation, dist=dist, k=k, unit_type=unit_type
        )

@dataclass
class RemoveNodeEvent(BaseEvent):
    node_id: str

    @staticmethod
    def create(node_id: str, actor: str="anonymous") -> "RemoveNodeEvent":
        return RemoveNodeEvent(kind="remove_node", ts=now_iso(), actor=actor, node_id=node_id)

@dataclass
class AddRootComponentEvent(BaseEvent):
    new_comp_id: str
    dist: Dict[str, Any]
    unit_type: str | None = None

    @staticmethod
    def create(new_comp_id: str, dist: Dict[str, Any], unit_type: str | None = None, actor: str="anonymous") -> "AddRootComponentEvent":
        return AddRootComponentEvent(kind="add_root_component", ts=now_iso(), actor=actor,
                                     new_comp_id=new_comp_id, dist=dist, unit_type=unit_type)

@dataclass
class SetHeadEvent(BaseEvent):
    upto: int

    @staticmethod
    def create(upto: int, actor: str="anonymous") -> "SetHeadEvent":
        return SetHeadEvent(kind="set_head", ts=now_iso(), actor=actor, upto=upto)
    

@dataclass
class EditComponentEvent(BaseEvent):
    old_id: str
    new_id: str
    dist: Dict[str, Any]

    @staticmethod
    def create(old_id: str, new_id: str, dist: Dict[str, Any], actor: str="anonymous") -> "EditComponentEvent":
        return EditComponentEvent(kind="edit_component", ts=now_iso(), actor=actor,
                                  old_id=old_id, new_id=new_id, dist=dist)

@dataclass
class EditGateEvent(BaseEvent):
    node_id: str
    params: Dict[str, Any]

    @staticmethod
    def create(node_id: str, params: Dict[str, Any], actor: str="anonymous") -> "EditGateEvent":
        return EditGateEvent(kind="edit_gate", ts=now_iso(), actor=actor,
                             node_id=node_id, params=params)
    
@dataclass
class SetIgnoreRangeEvent(BaseEvent):
    start_v: int
    end_v: int

    @staticmethod
    def create(start_v: int, end_v: int, actor: str = "anonymous") -> "SetIgnoreRangeEvent":
        return SetIgnoreRangeEvent(
            kind="set_ignore_range",
            ts=now_iso(),
            actor=actor,
            start_v=start_v,
            end_v=end_v
        )

Event = Union[
    SnapshotEvent, AddComponentRelativeEvent, RemoveNodeEvent, 
    AddRootComponentEvent, SetHeadEvent, EditComponentEvent, EditGateEvent,
    SetIgnoreRangeEvent
]

def event_from_dict(d: Dict[str, Any]) -> Event:
    k = d.get("kind")
    common = {"ts": d["ts"], "actor": d.get("actor","anonymous")}
    ver = d.get("version")
    if k == "snapshot":
        ev = SnapshotEvent(kind="snapshot", **common, data=d["data"])
    elif k == "add_component_relative":
        ev = AddComponentRelativeEvent(kind="add_component_relative", **common,
                                       target_id=d["target_id"], new_comp_id=d["new_comp_id"],
                                       relation=d["relation"], dist=d["dist"], k=d.get("k"),
                                       unit_type=d.get("unit_type"))
    elif k == "remove_node":
        ev = RemoveNodeEvent(kind="remove_node", **common, node_id=d["node_id"])
    elif k == "add_root_component":
        ev = AddRootComponentEvent(kind="add_root_component", **common,
                                   new_comp_id=d["new_comp_id"], dist=d["dist"],
                                   unit_type=d.get("unit_type"))
    elif k == "set_head":
        ev = SetHeadEvent(kind="set_head", **common, upto=d["upto"])
    elif k == "edit_component":
        ev = EditComponentEvent(kind="edit_component", **common,
                                old_id=d["old_id"], new_id=d["new_id"], dist=d["dist"])
    elif k == "edit_gate":
        ev = EditGateEvent(kind="edit_gate", **common, node_id=d["node_id"], params=d.get("params", {}))
    elif k == "set_ignore_range":
        ev = SetIgnoreRangeEvent(
            kind="set_ignore_range", **common,
            start_v=int(d["start_v"]), end_v=int(d["end_v"])
        )
    else:
        raise ValueError(f"Unknown event kind: {k}")
    # asigna version si existe en el dict
    try:
        ev.version = int(ver) if ver is not None else None
    except Exception:
        ev.version = None
    return ev
