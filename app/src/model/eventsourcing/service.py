from __future__ import annotations
from typing import Optional, List
from ..graph.graph import ReliabilityGraph
from ..graph.node import ComponentNode
from ..graph.guid import deterministic_gate_guid
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

    def _map_relation_type(self, relation_type: str | None, target_id: str, host_type: str) -> str:
        gate_map = {
            "AND": "series",
            "OR": "parallel",
            "KOON": "koon",
        }
        if relation_type is None:
            if host_type == "gate":
                node = self.graph.nodes.get(target_id)
                if node is None or not node.is_gate():
                    raise ValueError(f"Target gate '{target_id}' not found")
                subtype = getattr(node, "subtype", None)
                if subtype in gate_map:
                    return gate_map[subtype]
            raise ValueError("relation_type is required for component host")
        if relation_type in gate_map:
            return gate_map[relation_type]
        if relation_type in ("series", "parallel", "koon"):
            return relation_type
        raise ValueError(f"Unknown relation_type '{relation_type}'")

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

    @staticmethod
    def _normalize_children_order(
        children_order: list[str] | None,
        current_children: list[str],
    ) -> list[str] | None:
        if children_order is None or not isinstance(children_order, list):
            return None

        seen: set[str] = set()
        ordered: list[str] = []
        for child_id in children_order:
            if child_id in current_children and child_id not in seen:
                ordered.append(child_id)
                seen.add(child_id)

        for child_id in current_children:
            if child_id not in seen:
                ordered.append(child_id)
                seen.add(child_id)

        if len(ordered) != len(current_children):
            return None

        return ordered

    # ---------- Mutadores + registro de eventos (sin params, sólo kind) ----------

    def add_root_component(self, new_id: str, dist: Dist, unit_type: str | None = None) -> None:
        self.graph.add_node(ComponentNode(id=new_id, dist=dist, unit_type=unit_type))
        if self.store:
            self.store.append(AddRootComponentEvent.create(
                new_comp_id=new_id,
                dist={"kind": dist.kind},
                unit_type=unit_type,
                actor=self.actor
            ))

    def add_series(self, target_id: str, new_id: str, dist: Dist, unit_type: str | None = None) -> None:
        gate_id = self.graph.add_component_relative(
            target_id,
            new_id,
            "series",
            dist,
            unit_type=unit_type,
        )
        if self.store:
            gate_guid = None
            if gate_id:
                gate_node = self.graph.nodes.get(gate_id)
                gate_guid = getattr(gate_node, "guid", None)
            self.store.append(AddComponentRelativeEvent.create(
                target_id=target_id,
                new_comp_id=new_id,
                relation="series",
                dist={"kind": dist.kind},
                unit_type=unit_type,
                new_gate_id=gate_id,
                new_gate_guid=gate_guid,
                actor=self.actor
            ))

    def add_parallel(self, target_id: str, new_id: str, dist: Dist, unit_type: str | None = None) -> None:
        gate_id = self.graph.add_component_relative(
            target_id,
            new_id,
            "parallel",
            dist,
            unit_type=unit_type,
        )
        if self.store:
            gate_guid = None
            if gate_id:
                gate_node = self.graph.nodes.get(gate_id)
                gate_guid = getattr(gate_node, "guid", None)
            self.store.append(AddComponentRelativeEvent.create(
                target_id=target_id,
                new_comp_id=new_id,
                relation="parallel",
                dist={"kind": dist.kind},
                unit_type=unit_type,
                new_gate_id=gate_id,
                new_gate_guid=gate_guid,
                actor=self.actor
            ))

    def add_koon(self, target_id: str, new_id: str, dist: Dist, k: int) -> None:
        if k < 1:
            raise ValueError("k must be >= 1 for KOON gate")
        gate_id = self.graph.add_component_relative(target_id, new_id, "koon", dist, k=k)
        if self.store:
            gate_guid = None
            if gate_id:
                gate_node = self.graph.nodes.get(gate_id)
                gate_guid = getattr(gate_node, "guid", None)
            self.store.append(AddComponentRelativeEvent.create(
                target_id=target_id,
                new_comp_id=new_id,
                relation="koon",
                dist={"kind": dist.kind},
                k=k,
                new_gate_id=gate_id,
                new_gate_guid=gate_guid,
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

    def add_component_organization(
        self,
        new_comp_id: str,
        calculation_type: str,
        target_id: str | None,
        host_type: str | None,
        relation_type: str | None,
        position_index: int | None = None,
        position_reference_id: str | None = None,
        children_order: list[str] | None = None,
        k: int | None = None,
        unit_type: str | None = None,
    ) -> None:
        dist = Dist(kind=calculation_type)
        if target_id is None or host_type is None:
            self.add_root_component(new_comp_id, dist, unit_type=unit_type)
            return

        effective_position_index = position_index
        effective_position_reference_id = position_reference_id
        if children_order is not None:
            effective_position_index = None
            effective_position_reference_id = None

        relation = self._map_relation_type(relation_type, target_id, host_type)

        gate_id: str | None = None
        if host_type == "gate":
            gate_id = self.graph.add_component_relative(
                target_id,
                new_comp_id,
                relation,
                dist,
                k=k,
                unit_type=unit_type,
                position_index=effective_position_index,
                position_reference_id=effective_position_reference_id,
            )
        elif host_type == "component":
            gate_id = self.graph.add_component_relative(
                target_id,
                new_comp_id,
                relation,
                dist,
                k=k,
                unit_type=unit_type,
                position_index=effective_position_index,
                position_reference_id=effective_position_reference_id,
            )
        else:
            raise ValueError(f"Unknown host_type '{host_type}'")

        if children_order is not None:
            gate_id = self.graph.parent.get(new_comp_id)
            if gate_id is None:
                raise ValueError("Inserted component has no parent gate for reorder")
            if not self.graph.nodes[gate_id].is_gate():
                raise ValueError(f"Parent '{gate_id}' is not a gate")
            self.graph.reorder_children(gate_id, children_order)

        if self.store:
            gate_guid = None
            if gate_id:
                gate_node = self.graph.nodes.get(gate_id)
                gate_guid = getattr(gate_node, "guid", None)
            self.store.append(AddComponentRelativeEvent.create(
                target_id=target_id,
                new_comp_id=new_comp_id,
                relation=relation,
                dist={"kind": dist.kind},
                k=k,
                unit_type=unit_type,
                position_index=effective_position_index,
                position_reference_id=effective_position_reference_id,
                children_order=children_order,
                new_gate_id=gate_id,
                new_gate_guid=gate_guid,
                actor=self.actor
            ))

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
                g.add_node(ComponentNode(
                    id=ev.new_comp_id,
                    dist=dist,
                    unit_type=getattr(ev, 'unit_type', None)
                ))
            elif isinstance(ev, AddComponentRelativeEvent):
                d = ev.dist or {}
                kind = d.get("kind", "exponential")
                dist = Dist(kind=kind)
                children_order = getattr(ev, "children_order", None)
                effective_position_index = getattr(ev, "position_index", None)
                effective_position_reference_id = getattr(ev, "position_reference_id", None)
                if children_order is not None:
                    effective_position_index = None
                    effective_position_reference_id = None
                gate_guid = getattr(ev, "new_gate_guid", None)
                gate_guid_factory = None
                if gate_guid is None:
                    gate_guid_factory = lambda gate_id: deterministic_gate_guid(
                        event_kind=ev.kind,
                        event_version=getattr(ev, "version", None),
                        gate_id=gate_id,
                        event_ts=getattr(ev, "ts", None),
                    )
                gate_id = g.add_component_relative(
                    ev.target_id,
                    ev.new_comp_id,
                    ev.relation,
                    dist,
                    k=getattr(ev, "k", None),
                    unit_type=getattr(ev, 'unit_type', None),
                    position_index=effective_position_index,
                    position_reference_id=effective_position_reference_id,
                    gate_guid=gate_guid,
                    gate_guid_factory=gate_guid_factory,
                )
                if children_order is not None:
                    gate_id = None
                    if ev.target_id in g.nodes and g.nodes[ev.target_id].is_gate():
                        gate_id = ev.target_id
                    else:
                        gate_id = g.parent.get(ev.new_comp_id)
                    if gate_id is not None and gate_id in g.nodes and g.nodes[gate_id].is_gate():
                        normalized_order = GraphES._normalize_children_order(
                            children_order,
                            g.children.get(gate_id, []),
                        )
                        if normalized_order is not None:
                            g.reorder_children(gate_id, normalized_order)
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
