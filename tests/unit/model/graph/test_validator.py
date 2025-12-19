import pytest

from app.src.model.graph.validator import GraphValidator


def test_validate_node_exists_raises_keyerror():
    nodes = {"A": object()}
    with pytest.raises(KeyError, match="unknown node id 'B'"):
        GraphValidator.validate_node_exists(nodes, "B", operation="remove")


def test_validate_node_exists_ok():
    nodes = {"A": object()}
    GraphValidator.validate_node_exists(nodes, "A", operation="remove")  # no raise


def test_validate_new_node_raises_valueerror():
    nodes = {"A": object()}
    with pytest.raises(ValueError, match="already exists"):
        GraphValidator.validate_new_node(nodes, "A")


def test_validate_new_node_ok():
    nodes = {"A": object()}
    GraphValidator.validate_new_node(nodes, "B")  # no raise


def test_validate_relation_allows_only_expected():
    for ok in ("series", "parallel", "koon"):
        GraphValidator.validate_relation(ok)  # no raise

    with pytest.raises(ValueError, match="Invalid relation"):
        GraphValidator.validate_relation("invalid")


def test_validate_koon_k_defaults_to_1_when_none():
    assert GraphValidator.validate_koon_k(None, n=5) == 1


def test_validate_koon_k_when_n_le_0_returns_max_1_k():
    assert GraphValidator.validate_koon_k(0, n=0) == 1
    assert GraphValidator.validate_koon_k(2, n=0) == 2


def test_validate_koon_k_raises_when_out_of_range():
    with pytest.raises(ValueError, match="k must be between 1 and 3"):
        GraphValidator.validate_koon_k(0, n=3)
    with pytest.raises(ValueError, match="k must be between 1 and 3"):
        GraphValidator.validate_koon_k(4, n=3)


def test_validate_koon_k_ok_in_range():
    assert GraphValidator.validate_koon_k(1, n=3) == 1
    assert GraphValidator.validate_koon_k(3, n=3) == 3
