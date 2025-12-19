import pytest

from app.src.model.eventsourcing.service import GraphES
from app.src.model.eventsourcing.in_memory_store import InMemoryEventStore
from app.src.model.eventsourcing.events import (
    AddRootComponentEvent,
    AddComponentRelativeEvent,
    RemoveNodeEvent,
    EditComponentEvent,
    EditGateEvent,
    SnapshotEvent,
    SetHeadEvent,
    SetIgnoreRangeEvent,
)
from app.src.model.graph.dist import Dist
from app.src.model.graph.graph import ReliabilityGraph


def test_set_head_appends_event_when_store_present():
    store = InMemoryEventStore()
    es = GraphES(store=store, actor="me")
    es.set_head(3)
    assert isinstance(store.all()[-1], SetHeadEvent)
    assert store.all()[-1].upto == 3
    assert store.all()[-1].actor == "me"


def test_set_head_no_store_no_crash():
    es = GraphES(store=None)
    es.set_head(2)  # should do nothing


def test_add_root_component_mutates_graph_and_appends_event():
    store = InMemoryEventStore()
    es = GraphES(store=store, actor="me")
    es.graph.clear()

    es.add_root_component("A", Dist(kind="exponential"), unit_type="Pump")

    assert es.graph.root == "A"
    assert "A" in es.graph.nodes
    ev = store.all()[-1]
    assert isinstance(ev, AddRootComponentEvent)
    assert ev.new_comp_id == "A"
    assert ev.dist["kind"] == "exponential"
    assert ev.unit_type == "Pump"
    assert ev.actor == "me"


def test_add_series_appends_add_component_relative_series():
    store = InMemoryEventStore()
    es = GraphES(store=store, actor="me")
    es.graph.clear()
    es.add_root_component("A", Dist("exponential"))

    es.add_series("A", "B", Dist("weibull"), unit_type="Valve")

    assert "B" in es.graph.nodes
    ev = store.all()[-1]
    assert isinstance(ev, AddComponentRelativeEvent)
    assert ev.relation == "series"
    assert ev.target_id == "A"
    assert ev.new_comp_id == "B"
    assert ev.dist["kind"] == "weibull"
    assert ev.unit_type == "Valve"


def test_add_parallel_appends_add_component_relative_parallel():
    store = InMemoryEventStore()
    es = GraphES(store=store, actor="me")
    es.graph.clear()
    es.add_root_component("A", Dist("exponential"))

    es.add_parallel("A", "B", Dist("exponential"))

    assert "B" in es.graph.nodes
    ev = store.all()[-1]
    assert isinstance(ev, AddComponentRelativeEvent)
    assert ev.relation == "parallel"


def test_add_koon_requires_k_ge_1_and_appends_event():
    store = InMemoryEventStore()
    es = GraphES(store=store, actor="me")
    es.graph.clear()
    es.add_root_component("A", Dist("exponential"))

    with pytest.raises(ValueError, match="k must be >= 1"):
        es.add_koon("A", "B", Dist("exponential"), k=0)

    es.add_koon("A", "B", Dist("exponential"), k=2)
    ev = store.all()[-1]
    assert isinstance(ev, AddComponentRelativeEvent)
    assert ev.relation == "koon"
    assert ev.k == 2


def test_remove_node_appends_event():
    store = InMemoryEventStore()
    es = GraphES(store=store, actor="me")
    es.graph.clear()
    es.add_root_component("A", Dist("exponential"))

    es.remove_node("A")

    ev = store.all()[-1]
    assert isinstance(ev, RemoveNodeEvent)
    assert ev.node_id == "A"


def test_edit_component_appends_event():
    store = InMemoryEventStore()
    es = GraphES(store=store, actor="me")
    es.graph.clear()
    es.add_root_component("A", Dist("exponential"))

    es.edit_component("A", "B", Dist("weibull"))

    ev = store.all()[-1]
    assert isinstance(ev, EditComponentEvent)
    assert ev.old_id == "A"
    assert ev.new_id == "B"
    assert ev.dist["kind"] == "weibull"


def test_edit_gate_appends_event():
    store = InMemoryEventStore()
    es = GraphES(store=store, actor="me")
    es.graph.clear()

    # make a gate root: easiest via add_root + add_parallel => root becomes OR gate
    es.add_root_component("A", Dist("exponential"))
    es.add_parallel("A", "B", Dist("exponential"))
    gid = es.graph.root
    assert es.graph.nodes[gid].is_gate()

    es.edit_gate(gid, {"subtype": "AND"})
    ev = store.all()[-1]
    assert isinstance(ev, EditGateEvent)
    assert ev.node_id == gid
    assert ev.params["subtype"] == "AND"


def test_snapshot_appends_snapshot_event_and_contains_graph_data():
    store = InMemoryEventStore()
    es = GraphES(store=store, actor="me")
    es.graph.clear()
    es.add_root_component("A", Dist("exponential"))

    es.snapshot()
    ev = store.all()[-1]
    assert isinstance(ev, SnapshotEvent)
    assert isinstance(ev.data, dict)
    assert "nodes" in ev.data and "edges" in ev.data


def test_snapshot_no_store_no_crash():
    es = GraphES(store=None)
    es.snapshot()  # should do nothing


def test_effective_indices_set_head_ignores_after_upto():
    # 3 events + set_head upto index 0 => only first should remain active
    e1 = AddRootComponentEvent.create(new_comp_id="A", dist={"kind": "exponential"})
    e2 = AddComponentRelativeEvent.create(target_id="A", new_comp_id="B", relation="parallel", dist={"kind": "exponential"})
    e3 = RemoveNodeEvent.create(node_id="B")
    h = SetHeadEvent.create(upto=0)

    evts = [e1, e2, e3, h]
    active_idx = GraphES._effective_indices(evts)

    # e2,e3 should be ignored by head policy
    assert active_idx == [0, 3]


def test_effective_indices_ignore_range_disables_versions():
    # versioned events so ignore_range is deterministic
    e1 = AddRootComponentEvent.create(new_comp_id="A", dist={"kind": "exponential"}); e1.version = 1
    e2 = AddComponentRelativeEvent.create(target_id="A", new_comp_id="B", relation="parallel", dist={"kind": "exponential"}); e2.version = 2
    e3 = RemoveNodeEvent.create(node_id="B"); e3.version = 3
    ign = SetIgnoreRangeEvent.create(start_v=2, end_v=3); ign.version = 4

    evts = [e1, e2, e3, ign]
    active_idx = GraphES._effective_indices(evts)

    # only version 1 and ignore event itself (v4) remain
    assert active_idx == [0, 3]


def test_rebuild_applies_events_and_is_robust_to_missing_nodes():
    # remove missing node should be ignored (try/except in rebuild)
    e1 = AddRootComponentEvent.create(new_comp_id="A", dist={"kind": "exponential"})
    e2 = RemoveNodeEvent.create(node_id="X")  # doesn't exist
    e3 = AddComponentRelativeEvent.create(target_id="A", new_comp_id="B", relation="parallel", dist={"kind": "exponential"})
    g = GraphES.rebuild([e1, e2, e3])

    assert isinstance(g, ReliabilityGraph)
    assert g.root is not None
    assert "A" in g.nodes and "B" in g.nodes


def test_rebuild_respects_snapshot_over_prior_events():
    # event before snapshot should effectively be overwritten by snapshot data
    base = ReliabilityGraph(auto_normalize=False)
    base.clear()
    base.add_node(__import__("app.src.model.graph.node", fromlist=["Node"]).Node(id="X", type="component", dist=Dist("exponential")))

    snap = SnapshotEvent.create(data=base.to_data())
    e_after = AddRootComponentEvent.create(new_comp_id="A", dist={"kind": "exponential"})

    g = GraphES.rebuild([e_after, snap])  # snapshot should win at its position
    assert "X" in g.nodes
