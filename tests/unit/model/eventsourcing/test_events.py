from datetime import datetime, timezone
import pytest

from app.src.model.eventsourcing.events import (
    now_iso,
    event_from_dict,
    SnapshotEvent,
    AddComponentRelativeEvent,
    RemoveNodeEvent,
    AddRootComponentEvent,
    SetHeadEvent,
    EditComponentEvent,
    EditGateEvent,
    SetIgnoreRangeEvent,
)


def test_now_iso_is_parseable_and_utc():
    s = now_iso()
    dt = datetime.fromisoformat(s)
    # debe tener tzinfo
    assert dt.tzinfo is not None
    # y ser UTC
    assert dt.utcoffset() == timezone.utc.utcoffset(dt)


def test_create_factories_set_correct_kind_regression_against_add_root_bug():
    """
    REGRESION (relacionada a tu bug):
    - add_component_relative siempre debe crear kind='add_component_relative'
    - add_root_component siempre debe crear kind='add_root_component'
    Esto atrapa el típico bug de handler/mapper que llama la factory equivocada.
    """
    ev1 = AddComponentRelativeEvent.create(
        target_id="A",
        new_comp_id="B",
        relation="parallel",   # OR
        dist={"kind": "exponential"},
        actor="me",
    )
    assert ev1.kind == "add_component_relative"
    assert ev1.relation == "parallel"
    assert ev1.k is None

    ev2 = AddComponentRelativeEvent.create(
        target_id="K1",
        new_comp_id="C",
        relation="koon",
        dist={"kind": "weibull"},
        k=2,
    )
    assert ev2.kind == "add_component_relative"
    assert ev2.relation == "koon"
    assert ev2.k == 2

    ev3 = AddRootComponentEvent.create(
        new_comp_id="ROOT",
        dist={"kind": "exponential"},
        unit_type="Pump",
    )
    assert ev3.kind == "add_root_component"
    assert ev3.new_comp_id == "ROOT"


def test_event_to_dict_contains_kind_ts_actor_and_optional_version():
    ev = RemoveNodeEvent.create("A", actor="x")
    d = ev.to_dict()
    assert d["kind"] == "remove_node"
    assert d["actor"] == "x"
    assert "ts" in d
    # version existe como campo (None por defecto)
    assert "version" in d
    assert d["version"] is None


@pytest.mark.parametrize(
    "payload",
    [
        # snapshot
        {"kind": "snapshot", "ts": "2025-01-01T00:00:00+00:00", "actor": "a", "data": {"x": 1}, "version": 10},
        # add_component_relative (OR)
        {"kind": "add_component_relative", "ts": "2025-01-01T00:00:00+00:00", "actor": "a",
         "target_id": "A", "new_comp_id": "B", "relation": "parallel", "dist": {"kind": "exponential"}, "version": "11"},
        # add_component_relative with ordering
        {"kind": "add_component_relative", "ts": "2025-01-01T00:00:00+00:00", "actor": "a",
         "target_id": "G1", "new_comp_id": "C", "relation": "series", "dist": {"kind": "weibull"},
         "position_index": 1, "position_reference_id": "A", "children_order": ["A", "C"], "version": 11},
        # add_component_relative (KOON)
        {"kind": "add_component_relative", "ts": "2025-01-01T00:00:00+00:00", "actor": "a",
         "target_id": "K1", "new_comp_id": "C", "relation": "koon", "dist": {"kind": "weibull"}, "k": 2, "version": 12},
        # remove_node
        {"kind": "remove_node", "ts": "2025-01-01T00:00:00+00:00", "actor": "a", "node_id": "X", "version": 13},
        # add_root_component
        {"kind": "add_root_component", "ts": "2025-01-01T00:00:00+00:00", "actor": "a",
         "new_comp_id": "R", "dist": {"kind": "exponential"}, "unit_type": "Valve", "version": 14},
        # set_head
        {"kind": "set_head", "ts": "2025-01-01T00:00:00+00:00", "actor": "a", "upto": 3, "version": 15},
        # edit_component
        {"kind": "edit_component", "ts": "2025-01-01T00:00:00+00:00", "actor": "a",
         "old_id": "A", "new_id": "B", "dist": {"kind": "weibull"}, "version": 16},
        # edit_gate
        {"kind": "edit_gate", "ts": "2025-01-01T00:00:00+00:00", "actor": "a",
         "node_id": "G1", "params": {"k": 2}, "version": 17},
        # set_ignore_range (incluye cast int)
        {"kind": "set_ignore_range", "ts": "2025-01-01T00:00:00+00:00", "actor": "a",
         "start_v": "1", "end_v": 5, "version": 18},
    ],
)
def test_event_from_dict_roundtrip_types_and_version(payload):
    ev = event_from_dict(payload)
    assert ev.kind == payload["kind"]
    assert ev.ts == payload["ts"]
    assert ev.actor == payload.get("actor", "anonymous")
    # version debe quedar int si se puede parsear
    assert getattr(ev, "version", None) == int(payload["version"])

    # el dict re-creado debe conservar kind
    d2 = ev.to_dict()
    assert d2["kind"] == payload["kind"]


def test_event_from_dict_unknown_kind_raises():
    with pytest.raises(ValueError, match="Unknown event kind"):
        event_from_dict({"kind": "wat", "ts": "x", "actor": "a"})


def test_event_from_dict_missing_version_keeps_none():
    ev = event_from_dict({"kind": "remove_node", "ts": "2025-01-01T00:00:00+00:00", "actor": "a", "node_id": "X"})
    assert ev.version is None


def test_edit_component_event_create_returns_expected_fields():
    ev = EditComponentEvent.create(
        old_id="A",
        new_id="B",
        dist={"kind": "weibull"},
        actor="tester",
    )

    assert isinstance(ev, EditComponentEvent)
    assert ev.kind == "edit_component"
    assert ev.old_id == "A"
    assert ev.new_id == "B"
    assert ev.dist == {"kind": "weibull"}
    assert ev.actor == "tester"
    assert isinstance(ev.ts, str) and len(ev.ts) > 0
    assert ev.version is None


def test_edit_gate_event_create_returns_expected_fields():
    ev = EditGateEvent.create(
        node_id="G1",
        params={"k": 2, "subtype": "KOON"},
        actor="tester",
    )

    assert isinstance(ev, EditGateEvent)
    assert ev.kind == "edit_gate"
    assert ev.node_id == "G1"
    assert ev.params == {"k": 2, "subtype": "KOON"}
    assert ev.actor == "tester"
    assert isinstance(ev.ts, str) and len(ev.ts) > 0
    assert ev.version is None
