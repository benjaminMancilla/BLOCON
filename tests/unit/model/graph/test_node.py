import pytest

from app.src.model.graph.node import Node
from app.src.model.graph.dist import Dist


def test_node_component_helpers():
    n = Node(id="C1", type="component")
    assert n.is_component() is True
    assert n.is_gate() is False


def test_node_gate_helpers():
    n = Node(id="G1", type="gate", subtype="AND", k=2)
    assert n.is_component() is False
    assert n.is_gate() is True


def test_node_defaults():
    n = Node(id="C1", type="component")
    assert n.dist is None
    assert n.subtype is None
    assert n.k is None
    assert n.unit_type is None
    assert n.reliability is None
    assert n.conflict is False


def test_node_accepts_dist():
    d = Dist(kind="exponential")
    n = Node(id="C1", type="component", dist=d)
    assert n.dist is d
