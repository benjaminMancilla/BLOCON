from __future__ import annotations
from typing import Optional, List
from ..graph.graph import ReliabilityGraph
from ..graph.node import Node
from ..graph.dist import Dist
from .events import (
    Event, SnapshotEvent, AddComponentRelativeEvent, RemoveNodeEvent,
    AddRootComponentEvent, SetHeadEvent, EditComponentEvent, EditGateEvent,
    SetIgnoreRangeEvent
)
from .ports import EventStorePort

class GraphES:
    def __init__(self, graph: Optional[ReliabilityGraph]=None, store: Optional[EventStorePort]=None, actor: str="anonymous"):
        self.graph = graph or ReliabilityGraph(auto_normalize=True)
        self.store = store
        self.actor = actor

    def set_actor(self, actor: str) -> None:
        self.actor = actor

    def set_store(self, store: Optional[EventStorePort]) -> None:
        self.store = store

    def set_head(self, upto: int) -> None:
        if not self.store:
            return
        self.store.append(SetHeadEvent.create(upto=upto, actor=self.actor))

    @staticmethod
    def _effective_indices(evts: list[Event]) -> list[int]:
        n = len(evts)
        versions = [(getattr(e, "version", None) or (i + 1)) for i, e in enumerate(evts)]
        max_version = max(versions) if versions else 0

        # (idx, ver, ev)
        triples = [(i, versions[i], evts[i]) for i in range(n)]
        triples.sort(key=lambda t: t[1], reverse=True)

        ignored_versions: set[int] = set()

        # Recorrido descendente (la política "último manda")
        for idx, ver, ev in triples:
            if ver in ignored_versions:
                # Este evento ya quedó inhabilitado por una regla más nueva
                continue

            if isinstance(ev, SetIgnoreRangeEvent):
                a = int(getattr(ev, "start_v", 0) or 0)
                b = int(getattr(ev, "end_v", 0) or 0)
                if a > 0 and b > 0 and a <= b:
                    ignored_versions.update(range(a, b + 1))
                    # Si el propio evento cae en su rango, también queda ignorado:
                    if a <= ver <= b:
                        ignored_versions.add(ver)

            elif isinstance(ev, SetHeadEvent):
                # Compatibilidad local (undo/redo por índice)
                upto_idx = max(0, min(int(getattr(ev, "upto", 0) or 0), n - 1))
                upto_ver = versions[upto_idx]
                if upto_ver < max_version:
                    ignored_versions.update(range(upto_ver + 1, max_version + 1))

        # Índices activos = aquellos cuya versión NO quedó ignorada
        active = [i for i, v in enumerate(versions) if v not in ignored_versions]
        return active

    # ---------- Mutadores + registro de eventos (sin params, sólo kind) ----------

    def add_root_component(self, new_id: str, dist: Dist, unit_type: str | None = None) -> None:
        self.graph.add_node(Node(id=new_id, type="component", dist=dist, unit_type=unit_type))
        if self.store:
            self.store.append(AddRootComponentEvent.create(
                new_comp_id=new_id,
                dist={"kind": dist.kind},
                unit_type=unit_type,
                actor=self.actor
            ))

    def add_series(self, target_id: str, new_id: str, dist: Dist, unit_type: str | None = None) -> None:
        self.graph.add_component_relative(target_id, new_id, "series", dist, unit_type=unit_type)
        if self.store:
            self.store.append(AddComponentRelativeEvent.create(
                target_id=target_id,
                new_comp_id=new_id,
                relation="series",
                dist={"kind": dist.kind},
                unit_type=unit_type,
                actor=self.actor
            ))

    def add_parallel(self, target_id: str, new_id: str, dist: Dist, unit_type: str | None = None) -> None:
        self.graph.add_component_relative(target_id, new_id, "parallel", dist, unit_type=unit_type)
        if self.store:
            self.store.append(AddComponentRelativeEvent.create(
                target_id=target_id,
                new_comp_id=new_id,
                relation="parallel",
                dist={"kind": dist.kind},
                unit_type=unit_type,
                actor=self.actor
            ))

    def add_koon(self, target_id: str, new_id: str, dist: Dist, k: int) -> None:
        if k < 1:
            raise ValueError("k must be >= 1 for KOON gate")
        self.graph.add_component_relative(target_id, new_id, "koon", dist, k=k)
        if self.store:
            self.store.append(AddComponentRelativeEvent.create(
                target_id=target_id,
                new_comp_id=new_id,
                relation="koon",
                dist={"kind": dist.kind},
                k=k,
                actor=self.actor
            ))

    def remove_node(self, node_id: str) -> None:
        self.graph.remove_node(node_id)
        if self.store:
            self.store.append(RemoveNodeEvent.create(node_id=node_id, actor=self.actor))

    def edit_component(self, old_id: str, new_id: str, dist: Dist) -> None:
        self.graph.edit_component(old_id, new_id, dist)
        if self.store:
            self.store.append(EditComponentEvent.create(
                old_id=old_id,
                new_id=new_id,
                dist={"kind": dist.kind},
                actor=self.actor
            ))

    def edit_gate(self, node_id: str, params: dict) -> None:
        self.graph.edit_gate(node_id, params)
        if self.store:
            self.store.append(EditGateEvent.create(node_id=node_id, params=dict(params), actor=self.actor))

    def snapshot(self) -> None:
        if not self.store:
            return
        data = self.graph.to_data()
        self.store.append(SnapshotEvent.create(data=data, actor=self.actor))

    # ---------- Lecturas ----------

    def evaluate(self) -> float:
        return self.graph.evaluate()

    def to_expression(self) -> str:
        return self.graph.to_expression()

    # ---------- Rebuild desde evento ----------

    @staticmethod
    def rebuild(events: List[Event]) -> ReliabilityGraph:
        g = ReliabilityGraph(auto_normalize=True)
        for i in GraphES._effective_indices(events):
            ev = events[i]
            if isinstance(ev, SnapshotEvent):
                g = ReliabilityGraph.from_data(ev.data)
            elif isinstance(ev, AddRootComponentEvent):
                d = ev.dist or {}
                kind = d.get("kind", "exponential")
                dist = Dist(kind=kind)
                g.add_node(Node(
                    id=ev.new_comp_id,
                    type="component",
                    dist=dist,
                    unit_type=getattr(ev, 'unit_type', None)
                ))
            elif isinstance(ev, AddComponentRelativeEvent):
                d = ev.dist or {}
                kind = d.get("kind", "exponential")
                dist = Dist(kind=kind)
                g.add_component_relative(
                    ev.target_id,
                    ev.new_comp_id,
                    ev.relation,
                    dist,
                    k=getattr(ev, "k", None),
                    unit_type=getattr(ev, 'unit_type', None)
                )
            elif isinstance(ev, RemoveNodeEvent):
                try:
                    g.remove_node(ev.node_id)
                except KeyError:
                    pass
            elif isinstance(ev, SetHeadEvent):
                # manejado en _effective_indices
                pass
            elif isinstance(ev, EditComponentEvent):
                d = ev.dist or {}
                kind = d.get("kind", "exponential")
                dist = Dist(kind=kind)
                try:
                    g.edit_component(ev.old_id, ev.new_id, dist)
                except KeyError:
                    pass
            elif isinstance(ev, EditGateEvent):
                try:
                    g.edit_gate(ev.node_id, ev.params)
                except KeyError:
                    pass
        return g

