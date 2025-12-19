import pytest
import math

from app.src.model.graph.graph import ReliabilityGraph
from app.src.model.graph.node import Node
from app.src.model.graph.dist import Dist

def assert_graph_invariants(graph: ReliabilityGraph) -> None:
    if graph.root is not None:
        assert graph.root in graph.nodes
        assert graph.parent[graph.root] is None

    for parent, children in graph.children.items():
        assert parent in graph.nodes
        for child in children:
            assert child in graph.nodes
            assert graph.parent[child] == parent

    for node_id, parent in graph.parent.items():
        assert node_id in graph.nodes
        if parent is None:
            assert graph.root == node_id
        else:
            assert node_id in graph.children[parent]
            


def test_add_node_sets_root_first_time():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    assert g.root == "A"


def test_add_edge_sets_parent_and_children():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))

    g.add_edge("G1", "A")
    assert g.children["G1"] == ["A"]
    assert g.parent["A"] == "G1"


def test_add_edge_raises_if_dst_already_has_parent():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="AND"))
    g.add_node(Node(id="G2", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))

    g.add_edge("G1", "A")
    with pytest.raises(ValueError, match="already has a parent"):
        g.add_edge("G2", "A")


def test_remove_gate_with_more_than_one_child_raises():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))
    g.add_edge("G1", "A")
    g.add_edge("G1", "B")

    with pytest.raises(ValueError, match="Cannot remove a gate with >1 child"):
        g.remove_node("G1")


def test_remove_gate_with_one_child_adopts_child_as_root():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_edge("G1", "A")

    g.remove_node("G1")

    assert g.root == "A"
    assert "G1" not in g.nodes
    assert g.parent["A"] is None


def test_remove_component_under_gate_defers_collapse_until_normalize():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_edge("G1", "A")

    g.remove_node("A")

    # G1 queda vacío, pero no se colapsa hasta normalize()
    assert g.root == "G1"
    assert "A" not in g.nodes
    assert "G1" in g.nodes
    assert g.children["G1"] == []
    assert_graph_invariants(g)

    g.normalize()

    assert g.root is None
    assert "G1" not in g.nodes


def test_edit_gate_koon_k_validation():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="KOON", k=1))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_edge("G1", "A")

    # n=1 => k debe estar entre 1 y 1
    with pytest.raises(ValueError, match="k must be between 1 and 1"):
        g.edit_gate("G1", {"k": 2})

    g.edit_gate("G1", {"k": 1})
    assert g.nodes["G1"].k == 1


def test_edit_component_updates_dist_and_rename_updates_references():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_edge("G1", "A")

    new_dist = Dist(kind="weibull")
    g.edit_component("A", "B", new_dist)

    assert "A" not in g.nodes
    assert "B" in g.nodes
    assert g.nodes["B"].dist.kind == "weibull"
    assert g.children["G1"] == ["B"]
    assert g.parent["B"] == "G1"


def test_to_expression_formats_and_or_koon():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))
    g.add_edge("G1", "A")
    g.add_edge("G1", "B")

    assert g.to_expression() == "(A & B)"


def test_add_component_relative_series_interposes_and_gate():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))

    g.add_component_relative(
        target_id="A",
        new_comp_id="B",
        relation="series",
        dist=Dist(kind="exponential"),
    )

    # root debería ser un AND gate interpuesto
    assert g.root is not None
    root_node = g.nodes[g.root]
    assert root_node.is_gate()
    assert root_node.subtype == "AND"

    kids = g.children[g.root]
    assert set(kids) == {"A", "B"}


def test_add_component_relative_parallel_interposes_or_gate():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))

    g.add_component_relative(
        target_id="A",
        new_comp_id="B",
        relation="parallel",
        dist=Dist(kind="exponential"),
    )

    root_node = g.nodes[g.root]
    assert root_node.is_gate()
    assert root_node.subtype == "OR"
    assert set(g.children[g.root]) == {"A", "B"}


def test_add_component_relative_koon_requires_k():
    g = ReliabilityGraph()
    g.clear()
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))

    with pytest.raises(ValueError, match="KOON insertion requires k"):
        g.add_component_relative(
            target_id="A",
            new_comp_id="B",
            relation="koon",
            dist=Dist(kind="exponential"),
            k=None,
        )


def test_evaluate_sets_total_and_uses_evaluator(monkeypatch):
    g = ReliabilityGraph()
    g.clear()
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))

    g.project_root = "/tmp/project"
    g.failures_cache = object()

    # mock evaluator
    monkeypatch.setattr(g._evaluator, "evaluate", lambda: 0.55)

    out = g.evaluate()
    assert out == 0.55
    assert g.reliability_total == 0.55
    assert g._evaluator.project_root == "/tmp/project"
    assert g._evaluator.failures_cache is g.failures_cache


def test_to_data_from_data_roundtrip_smoke():
    g = ReliabilityGraph()
    g.clear()
    g.add_node(Node(id="G1", type="gate", subtype="OR"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential"), unit_type="Pump"))
    g.add_edge("G1", "A")
    g.reliability_total = 0.9
    g.nodes["A"].reliability = 0.9

    data = g.to_data()
    g2 = ReliabilityGraph.from_data(data)

    assert g2.root == g.root
    assert set(g2.nodes.keys()) == set(g.nodes.keys())
    assert g2.nodes["A"].dist is not None and g2.nodes["A"].dist.kind == "exponential"
    assert g2.reliability_total == 0.9


def test_add_component_relative_case1_parent_is_desired_gate_inserts_after_target():
    """
    Case 1:
    target_parent is not None and is already the desired gate type => insert after target
    """
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="X", type="component", dist=Dist(kind="exponential")))
    g.add_edge("G1", "A")
    g.add_edge("G1", "X")

    g.add_component_relative(
        target_id="A",
        new_comp_id="B",
        relation="series",  # AND
        dist=Dist(kind="exponential"),
    )

    assert g.root == "G1"
    # Debe quedar insertado justo después de A
    assert g.children["G1"] == ["A", "B", "X"]
    assert g.parent["B"] == "G1"


def test_add_component_relative_case2_target_is_root_gate_of_desired_type_adds_edge():
    """
    Case 2:
    target_parent is None and target itself is desired gate (root gate) => add_edge(target, new)
    """
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="OR"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_edge("G1", "A")
    assert g.root == "G1"

    g.add_component_relative(
        target_id="G1",
        new_comp_id="B",
        relation="parallel",  # OR
        dist=Dist(kind="exponential"),
    )

    assert g.children["G1"] == ["A", "B"]
    assert g.parent["B"] == "G1"


def test_clear_reliability_clears_node_reliability_and_total():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))
    g.nodes["A"].reliability = 0.9
    g.nodes["B"].reliability = 0.8
    g.reliability_total = 0.72

    g.clear_reliability()

    assert g.nodes["A"].reliability is None
    assert g.nodes["B"].reliability is None
    assert g.reliability_total is None


def test_remove_gate_with_parent_replaces_in_parent_children_and_adopts_child():
    g = ReliabilityGraph()
    g.clear()

    # Parent gate GP has children: G1 and B
    g.add_node(Node(id="GP", type="gate", subtype="AND"))
    g.add_node(Node(id="G1", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))

    g.add_edge("GP", "G1")
    g.add_edge("GP", "B")
    g.add_edge("G1", "A")

    # remove G1, which has single child A => parent GP should now directly have A
    g._remove_gate("G1")

    assert "G1" not in g.nodes
    assert g.children["GP"] == ["A", "B"]
    assert g.parent["A"] == "GP"


def test_remove_component_when_root_sets_root_none_and_deletes():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    assert g.root == "A"

    g._remove_component("A")

    assert g.root is None
    assert "A" not in g.nodes


def test_rename_node_updates_children_parent_pointers_and_references():
    g = ReliabilityGraph()
    g.clear()

    # X gate with children A,B
    g.add_node(Node(id="X", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))
    g.add_edge("X", "A")
    g.add_edge("X", "B")

    g._rename_node("X", "Y")

    assert "X" not in g.nodes
    assert "Y" in g.nodes
    assert g.children["Y"] == ["A", "B"]
    assert g.parent["A"] == "Y"
    assert g.parent["B"] == "Y"
    assert g.root == "Y"


def test_replace_child_replaces_with_new_child_and_clears_old_parent():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="P", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="C", type="component", dist=Dist(kind="exponential")))

    g.add_edge("P", "A")
    g.add_edge("P", "B")

    g._replace_child("P", "A", "C")

    assert g.children["P"] == ["C", "B"]
    assert g.parent["C"] == "P"
    assert g.parent["A"] is None


def test_replace_child_with_none_removes_child_and_clears_old_parent():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="P", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))

    g.add_edge("P", "A")
    g.add_edge("P", "B")

    g._replace_child("P", "B", None)

    assert g.children["P"] == ["A"]
    assert g.parent["B"] is None


def test_insert_child_after_inserts_in_position_when_after_child_found():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="P", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="C", type="component", dist=Dist(kind="exponential")))

    g.add_edge("P", "A")
    g.add_edge("P", "B")

    g._insert_child_after("P", "A", "C")

    assert g.children["P"] == ["A", "C", "B"]
    assert g.parent["C"] == "P"


def test_insert_child_after_fallback_appends_when_after_child_not_found():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="P", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="C", type="component", dist=Dist(kind="exponential")))

    g.add_edge("P", "A")

    g._insert_child_after("P", "NOT_THERE", "C")

    assert g.children["P"] == ["A", "C"]
    assert g.parent["C"] == "P"


def test_insert_child_after_errors_unknown_parent_unknown_child_or_child_has_parent():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="P", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_edge("P", "A")

    with pytest.raises(KeyError, match="Unknown parent"):
        g._insert_child_after("NOPE", "A", "A")

    with pytest.raises(KeyError, match="Unknown child"):
        g._insert_child_after("P", "A", "NOPE")

    # child already has parent
    g.add_node(Node(id="C", type="component", dist=Dist(kind="exponential")))
    g.add_edge("P", "C")
    with pytest.raises(ValueError, match="already has a parent"):
        g._insert_child_after("P", "A", "C")


def test_try_collapse_gate_single_child_collapses_to_child_and_updates_root():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_edge("G1", "A")
    assert g.root == "G1"

    g._try_collapse_gate("G1")

    assert "G1" not in g.nodes
    assert g.root == "A"
    assert g.parent["A"] is None

def test_history_add_series_parallel_koon_flow_expression_data_and_evaluate(monkeypatch):
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))

    g.add_component_relative(
        target_id="A",
        new_comp_id="B",
        relation="series",
        dist=Dist(kind="exponential"),
    )
    g.add_component_relative(
        target_id="A",
        new_comp_id="C",
        relation="parallel",
        dist=Dist(kind="exponential"),
    )
    g.add_component_relative(
        target_id="A",
        new_comp_id="D",
        relation="koon",
        dist=Dist(kind="exponential"),
        k=1,
    )

    assert g.to_expression() == "((KOON[1/2](A, D) || C) & B)"

    data = g.to_data()
    assert data["root"] == g.root
    edges = {(edge["from"], edge["to"]) for edge in data["edges"]}
    assert edges == {
        ("G_and_1", "G_or_1"),
        ("G_and_1", "B"),
        ("G_or_1", "G_koon_1"),
        ("G_or_1", "C"),
        ("G_koon_1", "A"),
        ("G_koon_1", "D"),
    }
    assert_graph_invariants(g)

    monkeypatch.setattr(g._evaluator, "evaluate", lambda: 0.75)
    assert g.evaluate() == 0.75
    assert g.reliability_total == 0.75


def test_remove_intermediate_component_then_normalize_collapses_parent_gate():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="AND"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))
    g.add_edge("G1", "A")
    g.add_edge("G1", "B")

    g.remove_node("B")

    assert g.root == "G1"
    assert g.children["G1"] == ["A"]
    assert_graph_invariants(g)

    g.normalize()

    assert g.root == "A"
    assert "G1" not in g.nodes
    assert_graph_invariants(g)


def test_edit_component_under_gate_updates_expression_and_data():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="OR"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))
    g.add_edge("G1", "A")
    g.add_edge("G1", "B")

    g.edit_component("A", "C", Dist(kind="weibull"))

    assert g.to_expression() == "(C || B)"
    data = g.to_data()
    node_ids = {node["id"] for node in data["nodes"]}
    assert node_ids == {"G1", "B", "C"}
    assert_graph_invariants(g)


def test_interpose_gate_koon_success_with_k_not_none():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    assert g.root == "A"

    gate_id = g._interpose_gate("A", target_parent=None, gate_type="KOON", k=2)

    assert g.root == gate_id
    assert g.nodes[gate_id].is_gate()
    assert g.nodes[gate_id].subtype == "KOON"
    assert g.nodes[gate_id].k == 2
    assert g.children[gate_id] == ["A"]
    assert g.parent["A"] == gate_id


def test_handle_koon_insertion_case1_target_is_koon_gate():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="K1", type="gate", subtype="KOON", k=1))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_edge("K1", "A")
    assert g.root == "K1"

    # new component already exists in graph (as add_component_relative does)
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))

    handled = g._handle_koon_insertion(target_id="K1", new_comp_id="B", target_parent=None, k=1)

    assert handled is True
    assert g.parent["B"] == "K1"
    assert "B" in g.children["K1"]


def test_handle_koon_insertion_case2_target_component_inside_koon_gate_creates_nested_koon():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="K1", type="gate", subtype="KOON", k=1))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_edge("K1", "A")
    assert g.parent["A"] == "K1"

    # new component already exists
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))

    handled = g._handle_koon_insertion(target_id="A", new_comp_id="B", target_parent="K1", k=2)

    assert handled is True

    # A should no longer be direct child of K1; it should be under a new nested gate
    assert g.parent["A"] != "K1"
    nested_gate = g.parent["A"]

    assert g.nodes[nested_gate].is_gate()
    assert g.nodes[nested_gate].subtype == "KOON"
    assert g.nodes[nested_gate].k == 2

    # K1 should now reference nested_gate instead of A
    assert nested_gate in g.children["K1"]
    assert "A" not in g.children["K1"]

    # nested gate should contain A and B
    assert set(g.children[nested_gate]) == {"A", "B"}
    assert g.parent["B"] == nested_gate


def test_expr_or_gate():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="G1", type="gate", subtype="OR"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))
    g.add_edge("G1", "A")
    g.add_edge("G1", "B")

    assert g.to_expression() == "(A || B)"


def test_expr_koon_gate():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="K1", type="gate", subtype="KOON", k=2))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))
    g.add_edge("K1", "A")
    g.add_edge("K1", "B")

    assert g.to_expression() == "KOON[2/2](A, B)"


def test_expr_unknown_gate_type_uses_question_separator():
    g = ReliabilityGraph()
    g.clear()

    g.add_node(Node(id="U1", type="gate", subtype="WTF"))
    g.add_node(Node(id="A", type="component", dist=Dist(kind="exponential")))
    g.add_node(Node(id="B", type="component", dist=Dist(kind="exponential")))
    g.add_edge("U1", "A")
    g.add_edge("U1", "B")

    assert g.to_expression() == "(A ? B)"
