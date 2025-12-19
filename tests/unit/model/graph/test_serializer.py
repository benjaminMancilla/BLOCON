import pytest

from app.src.model.graph.graph import ReliabilityGraph
from app.src.model.graph.node import Node
from app.src.model.graph.dist import Dist
from app.src.model.graph.serializer import GraphSerializer


def test_to_data_serializes_nodes_edges_root_and_totals():
    g = ReliabilityGraph()
    g.clear()

    a = Node(id="A", type="component", dist=Dist(kind="exponential"), unit_type="Pump")
    b = Node(id="B", type="component", dist=Dist(kind="weibull"))
    gate = Node(id="G1", type="gate", subtype="AND")

    g.add_node(gate)
    g.add_node(a)
    g.add_node(b)
    g.add_edge("G1", "A")
    g.add_edge("G1", "B")

    # add some evaluation artifacts
    g.nodes["A"].reliability = 0.9
    g.nodes["A"].conflict = True
    g.nodes["B"].reliability = 0.8
    g.reliability_total = 0.72

    data = GraphSerializer.to_data(g)

    assert data["root"] == g.root
    assert "nodes" in data and "edges" in data
    assert data["reliability_total"] == 0.72

    nodes_by_id = {n["id"]: n for n in data["nodes"]}
    assert nodes_by_id["G1"]["type"] == "gate"
    assert nodes_by_id["G1"]["subtype"] == "AND"

    assert nodes_by_id["A"]["type"] == "component"
    assert nodes_by_id["A"]["unit_type"] == "Pump"
    assert nodes_by_id["A"]["dist"]["kind"] == "exponential"
    assert nodes_by_id["A"]["reliability"] == 0.9
    assert nodes_by_id["A"]["conflict"] is True

    assert nodes_by_id["B"]["dist"]["kind"] == "weibull"
    assert nodes_by_id["B"]["reliability"] == 0.8

    # edges
    assert {"from": "G1", "to": "A"} in data["edges"]
    assert {"from": "G1", "to": "B"} in data["edges"]


def test_from_data_roundtrip_restores_graph():
    payload = {
        "nodes": [
            {"id": "G1", "type": "gate", "subtype": "OR", "k": None, "reliability": 0.95},
            {"id": "C1", "type": "component", "unit_type": "Valve", "dist": {"kind": "exponential"}, "reliability": 0.9, "conflict": True},
            {"id": "C2", "type": "component", "unit_type": None, "dist": {"kind": "weibull"}},
        ],
        "edges": [{"from": "G1", "to": "C1"}, {"from": "G1", "to": "C2"}],
        "root": "G1",
        "reliability_total": 0.97,
    }

    g = GraphSerializer.from_data(payload)

    assert isinstance(g, ReliabilityGraph)
    assert g.root == "G1"
    assert g.reliability_total == 0.97

    assert g.nodes["G1"].is_gate()
    assert g.nodes["G1"].subtype == "OR"
    assert g.nodes["G1"].reliability == 0.95

    assert g.nodes["C1"].is_component()
    assert g.nodes["C1"].unit_type == "Valve"
    assert g.nodes["C1"].dist is not None and g.nodes["C1"].dist.kind == "exponential"
    assert g.nodes["C1"].reliability == 0.9
    assert g.nodes["C1"].conflict is True

    assert g.children["G1"] == ["C1", "C2"]
    assert g.parent["C1"] == "G1"
    assert g.parent["C2"] == "G1"
