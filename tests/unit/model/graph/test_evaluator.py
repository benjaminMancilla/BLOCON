import math
import pytest
from dataclasses import dataclass

import app.src.model.graph.evaluator as eval_mod
from app.src.model.graph.evaluator import ReliabilityEvaluator
from app.src.model.graph.node import Node
from app.src.model.graph.dist import Dist


class DummyDist(Dist):
    """Dist stub: returns fixed reliability without touching cache/historial."""
    def __init__(self, kind="exponential", r=0.9):
        super().__init__(kind=kind)
        self._r = r

    def reliability(self, *args, **kwargs):
        return float(self._r)


@dataclass
class DummyGraph:
    nodes: dict
    children: dict
    root: str | None


def test_evaluate_empty_graph_returns_1():
    g = DummyGraph(nodes={}, children={}, root=None)
    ev = ReliabilityEvaluator(g)
    assert ev.evaluate() == 1.0


def test_eval_component_sets_conflict_based_on_has_enough_records(monkeypatch):
    # node C1: component
    c1 = Node(id="C1", type="component", dist=DummyDist(r=0.42))
    g = DummyGraph(nodes={"C1": c1}, children={"C1": []}, root="C1")

    ev = ReliabilityEvaluator(g)

    monkeypatch.setattr(eval_mod, "has_enough_records", lambda *a, **k: False)
    r = ev.evaluate()

    assert math.isclose(r, 0.42)
    assert g.nodes["C1"].reliability == 0.42
    assert g.nodes["C1"].conflict is True


def test_eval_component_has_enough_records_exception_sets_conflict_false(monkeypatch):
    c1 = Node(id="C1", type="component", dist=DummyDist(r=0.5))
    g = DummyGraph(nodes={"C1": c1}, children={"C1": []}, root="C1")
    ev = ReliabilityEvaluator(g)

    def boom(*a, **k):
        raise RuntimeError("cache error")

    monkeypatch.setattr(eval_mod, "has_enough_records", boom)

    r = ev.evaluate()
    assert r == 0.5
    assert g.nodes["C1"].conflict is False


def test_eval_and_gate_series_product(monkeypatch):
    g1 = Node(id="G1", type="gate", subtype="AND")
    a = Node(id="A", type="component", dist=DummyDist(r=0.9))
    b = Node(id="B", type="component", dist=DummyDist(r=0.8))

    g = DummyGraph(
        nodes={"G1": g1, "A": a, "B": b},
        children={"G1": ["A", "B"], "A": [], "B": []},
        root="G1",
    )
    ev = ReliabilityEvaluator(g)

    monkeypatch.setattr(eval_mod, "has_enough_records", lambda *a, **k: True)

    r = ev.evaluate()
    assert math.isclose(r, 0.72, rel_tol=0, abs_tol=1e-12)
    assert g.nodes["G1"].reliability == r


def test_eval_or_gate_parallel(monkeypatch):
    g1 = Node(id="G1", type="gate", subtype="OR")
    a = Node(id="A", type="component", dist=DummyDist(r=0.9))
    b = Node(id="B", type="component", dist=DummyDist(r=0.8))

    g = DummyGraph(
        nodes={"G1": g1, "A": a, "B": b},
        children={"G1": ["A", "B"], "A": [], "B": []},
        root="G1",
    )
    ev = ReliabilityEvaluator(g)
    monkeypatch.setattr(eval_mod, "has_enough_records", lambda *a, **k: True)

    # OR: 1 - (1-0.9)*(1-0.8) = 0.98
    r = ev.evaluate()
    assert math.isclose(r, 0.98, rel_tol=0, abs_tol=1e-12)


def test_eval_koon_gate_k_out_of_n(monkeypatch):
    g1 = Node(id="G1", type="gate", subtype="KOON", k=2)
    a = Node(id="A", type="component", dist=DummyDist(r=0.9))
    b = Node(id="B", type="component", dist=DummyDist(r=0.8))

    g = DummyGraph(
        nodes={"G1": g1, "A": a, "B": b},
        children={"G1": ["A", "B"], "A": [], "B": []},
        root="G1",
    )
    ev = ReliabilityEvaluator(g)
    monkeypatch.setattr(eval_mod, "has_enough_records", lambda *a, **k: True)

    # k=2 of 2 => 0.9*0.8 = 0.72
    r = ev.evaluate()
    assert math.isclose(r, 0.72, rel_tol=0, abs_tol=1e-12)


def test_evaluator_memoization_avoids_recomputing(monkeypatch):
    calls = {"n": 0}

    class CountingDist(Dist):
        def __init__(self):
            super().__init__(kind="exponential")

        def reliability(self, *a, **k):
            calls["n"] += 1
            return 0.5

    # diamond-ish: G1 AND(A, A) uses same child twice -> memo should compute once
    g1 = Node(id="G1", type="gate", subtype="AND")
    a = Node(id="A", type="component", dist=CountingDist())

    g = DummyGraph(
        nodes={"G1": g1, "A": a},
        children={"G1": ["A", "A"], "A": []},
        root="G1",
    )
    ev = ReliabilityEvaluator(g)
    monkeypatch.setattr(eval_mod, "has_enough_records", lambda *a, **k: True)

    r = ev.evaluate()
    assert math.isclose(r, 0.25, rel_tol=0, abs_tol=1e-12)
    assert calls["n"] == 1  # memo hit
