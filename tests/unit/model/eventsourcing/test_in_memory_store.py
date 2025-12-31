import pytest

from app.src.model.eventsourcing.in_memory_store import InMemoryEventStore
from app.src.model.eventsourcing.events import (
    RemoveNodeEvent,
    AddComponentRelativeEvent,
    AddRootComponentEvent,
)


def test_init_sets_head_and_base_version():
    s = InMemoryEventStore()
    assert s.base_version is None
    assert s.head == -1
    assert s.all() == []

    e1 = RemoveNodeEvent.create("A")
    e2 = RemoveNodeEvent.create("B")
    s2 = InMemoryEventStore([e1, e2])
    assert s2.head == 1
    assert len(s2.all()) == 2


def test_append_discards_redo_tail():
    s = InMemoryEventStore()
    s.append(RemoveNodeEvent.create("A"))
    s.append(RemoveNodeEvent.create("B"))
    s.append(RemoveNodeEvent.create("C"))

    assert len(s.all()) == 3
    assert s.head == 2

    # undo una vez => head=1
    assert s.undo() is True
    assert s.head == 1
    assert s.can_redo() is True

    # append debe truncar tail (el "C")
    s.append(RemoveNodeEvent.create("D"))
    assert [e.node_id for e in s.all()] == ["A", "B", "D"]
    assert s.head == 2
    assert s.can_redo() is False


def test_undo_redo_boundaries():
    s = InMemoryEventStore()
    assert s.undo() is False
    assert s.redo() is False

    s.append(RemoveNodeEvent.create("A"))
    s.append(RemoveNodeEvent.create("B"))
    assert s.can_undo() is True
    assert s.can_redo() is False

    assert s.undo() is True
    assert s.head == 0
    assert s.can_redo() is True

    assert s.undo() is True
    assert s.head == -1
    assert s.can_undo() is False

    assert s.redo() is True
    assert s.head == 0

    assert s.redo() is True
    assert s.head == 1

    assert s.redo() is False


def test_active_returns_events_upto_head():
    s = InMemoryEventStore()
    s.append(RemoveNodeEvent.create("A"))
    s.append(RemoveNodeEvent.create("B"))
    s.append(RemoveNodeEvent.create("C"))

    assert [e.node_id for e in s.active()] == ["A", "B", "C"]
    s.undo()
    assert [e.node_id for e in s.active()] == ["A", "B"]


def test_resequence_versions_sets_versions_for_active_and_clears_tail():
    s = InMemoryEventStore()
    e1 = RemoveNodeEvent.create("A")
    e2 = RemoveNodeEvent.create("B")
    e3 = RemoveNodeEvent.create("C")
    s.append(e1)
    s.append(e2)
    s.append(e3)

    # undo deja e3 como tail
    s.undo()
    assert s.head == 1

    s.resequence_versions(start_from=100)

    # activos: e1,e2 => 101,102
    assert e1.version == 101
    assert e2.version == 102
    # tail: e3 version None
    assert e3.version is None


def test_append_auto_assigns_version_when_base_version_set_and_event_has_none():
    s = InMemoryEventStore()
    e1 = RemoveNodeEvent.create("A")
    e2 = RemoveNodeEvent.create("B")
    s.append(e1)
    s.append(e2)

    # s.head=1, len=2
    s.resequence_versions(start_from=10)  # e1=11, e2=12 y base_version=10
    assert e1.version == 11
    assert e2.version == 12
    assert s.base_version == 10

    # nuevo evento sin version => auto
    e3 = RemoveNodeEvent.create("C")
    assert e3.version is None
    s.append(e3)
    # fórmula: base + (head+1)+1, donde head era 1 antes del append => 10+(2)+1=13
    assert e3.version == 13

def test_append_assigns_version_when_base_version_missing():
    s = InMemoryEventStore()
    e1 = RemoveNodeEvent.create("A")
    assert e1.version is None
    s.append(e1)
    assert e1.version == 1
    assert s.base_version == 0
    
def test_replace_sets_head_to_end():
    s = InMemoryEventStore()
    s.append(RemoveNodeEvent.create("A"))
    s.undo()
    assert s.head == -1

    s.replace([RemoveNodeEvent.create("X"), RemoveNodeEvent.create("Y")])
    assert s.head == 1
    assert len(s.active()) == 2


def test_clear_empties_store_and_head_minus_one():
    s = InMemoryEventStore()
    s.append(RemoveNodeEvent.create("A"))
    s.resequence_versions(start_from=1)
    assert s.base_version == 1

    s.clear()
    assert s.all() == []
    assert s.head == -1
    # base_version NO se resetea por diseño actual
    assert s.base_version == 1


def test_regression_store_does_not_mutate_event_kind_between_add_component_and_add_root():
    """
    Esto NO prueba el handler, pero asegura que el store no 're-etiqueta' eventos.
    Útil dado tu bug: el kind incorrecto no viene del store.
    """
    s = InMemoryEventStore()

    ev_rel = AddComponentRelativeEvent.create(
        target_id="A", new_comp_id="B",
        relation="parallel",
        dist={"kind": "exponential"}
    )
    ev_root = AddRootComponentEvent.create(
        new_comp_id="R",
        dist={"kind": "exponential"}
    )

    s.append(ev_rel)
    s.append(ev_root)

    kinds = [e.kind for e in s.all()]
    assert kinds == ["add_component_relative", "add_root_component"]
