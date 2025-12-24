from __future__ import annotations

from typing import Any, Dict, Optional

from src.model.graph.graph import ReliabilityGraph
from src.model.graph.node import Node


def serialize_graph(graph: ReliabilityGraph) -> Dict[str, Any]:
    return graph.to_data()


def serialize_node(graph: ReliabilityGraph, node_id: str) -> Optional[Dict[str, Any]]:
    node = graph.nodes.get(node_id)
    if not node:
        return None
    data = _serialize_node(node_id, node)
    data["parent"] = graph.parent.get(node_id)
    data["children"] = list(graph.children.get(node_id, []))
    return data


def _serialize_node(node_id: str, node: Node) -> Dict[str, Any]:
    data = node.to_dict()
    data["id"] = node_id
    return data