#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handlers para detalles de nodos."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any
from urllib.parse import unquote

if TYPE_CHECKING:
    from ..shared import SharedState
    from http.server import BaseHTTPRequestHandler

from .base import BaseHandler


class NodeDetailsHandler(BaseHandler):
    """
    Handler para detalles de nodos.

    Rutas manejadas:
    - GET /nodes/{node_id}/details - Obtener detalles de componente o gate
    """

    def __init__(self, shared: SharedState, request_handler: BaseHTTPRequestHandler):
        super().__init__(shared, request_handler)

    def handle_node_details(self, node_id: str) -> None:
        """GET /nodes/{node_id}/details - Retorna detalles del nodo."""
        node_id = unquote(node_id or "").strip()
        if not node_id:
            self._send_not_found()
            return

        snapshot_node = self._get_snapshot_node(node_id)
        if snapshot_node is None:
            self._send_not_found()
            return

        node_type = snapshot_node.get("type")
        if node_type == "component":
            cache = self._get_component_cache(node_id)
            payload = self._serialize_component_details(node_id, snapshot_node, cache)
        else:
            payload = self._serialize_gate_details(node_id, snapshot_node)

        self._send_json(200, payload)

    def _send_not_found(self) -> None:
        self._send_json(404, {"status": "error", "error": {"kind": "not_found"}})

    def _get_snapshot_node(self, node_id: str) -> dict[str, Any] | None:
        graph_data = self.shared.es.graph.to_data()
        for node in graph_data.get("nodes", []):
            if node.get("id") == node_id:
                return dict(node)
        return None

    def _get_component_cache(self, node_id: str) -> dict[str, Any] | None:
        cache = self.shared.local.load_components_cache()
        item = cache.get(node_id)
        if not isinstance(item, dict):
            return None
        result = dict(item)
        result.setdefault("id", node_id)
        for key in ("title", "insID", "etag"):
            result.pop(key, None)
        return result

    def _serialize_component_details(
        self,
        node_id: str,
        snapshot_node: dict[str, Any],
        cache: dict[str, Any] | None,
    ) -> dict[str, Any]:
        dist = snapshot_node.get("dist")
        dist_kind = dist.get("kind") if isinstance(dist, dict) else None
        snapshot = {
            "dist": {"kind": dist_kind} if dist_kind is not None else None,
            "reliability": snapshot_node.get("reliability"),
            "conflict": bool(snapshot_node.get("conflict", False)),
        }
        return {
            "kind": "component",
            "id": node_id,
            "snapshot": snapshot,
            "cache": cache,
        }

    def _serialize_gate_details(
        self,
        node_id: str,
        snapshot_node: dict[str, Any],
    ) -> dict[str, Any]:
        snapshot = {
            "id": node_id,
            "subtype": snapshot_node.get("subtype"),
            "label": snapshot_node.get("label"),
            "name": snapshot_node.get("name"),
            "reliability": snapshot_node.get("reliability"),
        }
        return {
            "kind": "gate",
            "id": node_id,
            "snapshot": snapshot,
        }