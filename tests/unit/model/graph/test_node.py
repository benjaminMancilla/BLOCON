import pytest

from app.src.model.graph.node import ComponentNode, AndGateNode
from app.src.model.graph.dist import Dist


def test_node_component_helpers():
    n = ComponentNode(id="C1")
    assert n.is_component() is True
    assert n.is_gate() is False


def test_node_gate_helpers():
    n = AndGateNode(id="G1")
    assert n.is_component() is False
    assert n.is_gate() is True


def test_node_defaults():
    n = ComponentNode(id="C1")
    assert n.dist is None
    assert n.unit_type is None
    assert n.reliability is None
    assert n.conflict is False
    assert n.type == "component"


def test_gate_defaults():
    n = AndGateNode(id="G1")
    assert n.subtype == "AND"
    assert n.name == "G1"
    assert n.label == "G1"
    assert n.reliability is None
    assert n.type == "gate"


def test_node_accepts_dist():
    d = Dist(kind="exponential")
    n = ComponentNode(id="C1", dist=d)
    assert n.dist is d
