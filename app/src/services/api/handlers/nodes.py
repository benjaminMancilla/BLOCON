#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handlers para detalles de nodos y sus fallas."""
from __future__ import annotations

from datetime import date, datetime
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
            "failures": self._serialize_component_failures(node_id),
        }

    def _serialize_gate_details(
        self,
        node_id: str,
        snapshot_node: dict[str, Any],
    ) -> dict[str, Any]:
        gate_node = self.shared.es.graph.nodes.get(node_id)
        children_count = len(self.shared.es.graph.children.get(node_id, []))
        snapshot = {
            "id": node_id,
            "subtype": snapshot_node.get("subtype"),
            "label": snapshot_node.get("label"),
            "name": snapshot_node.get("name"),
            "reliability": snapshot_node.get("reliability"),
            "k": getattr(gate_node, "k", None),
            "children_count": children_count,
        }
        return {
            "kind": "gate",
            "id": node_id,
            "snapshot": snapshot,
        }

    def _serialize_component_failures(self, node_id: str) -> dict[str, Any]:
        cache = self.shared.local.load_failures_cache()
        items = cache.get("items", {}) if isinstance(cache, dict) else {}
        entry = items.get(node_id) if isinstance(items, dict) else None
        rows = self._get_failure_rows(entry)
        records = []
        for row in rows:
            normalized = self._normalize_failure_record(node_id, row)
            if normalized is not None:
                records.append(normalized)
        return {"count": len(records), "records": records}

    def _get_failure_rows(self, entry: Any) -> list[Any]:
        if isinstance(entry, dict):
            rows = entry.get("rows", [])
            return rows if isinstance(rows, list) else []
        if isinstance(entry, list):
            return entry
        return []

    def _normalize_failure_record(self, node_id: str, row: Any) -> dict[str, Any] | None:
        if isinstance(row, (list, tuple)) and len(row) >= 2:
            base = {"Component_ID": node_id, "failure_date": row[0], "type_failure": row[1]}
            return self._normalize_failure_dict(base)
        if isinstance(row, dict):
            record = dict(row)
            if not self._record_has_identifier(record):
                record["Component_ID"] = node_id
            return self._normalize_failure_dict(record)
        return None

    def _record_has_identifier(self, record: dict[str, Any]) -> bool:
        for key in ("Component_ID", "component_id", "id"):
            if key in record:
                return True
        return False

    def _normalize_failure_dict(self, record: dict[str, Any]) -> dict[str, Any]:
        normalized = {}
        for key, value in record.items():
            normalized[key] = self._normalize_failure_value(str(key), value)
        return normalized

    def _normalize_failure_value(self, key: str, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value
        if isinstance(value, (datetime, date)):
            return self._format_timestamp(value.isoformat())
        if isinstance(value, str):
            trimmed = value.strip()
            if trimmed == "":
                return ""
            if self._is_timestamp_key(key):
                return self._normalize_timestamp_string(trimmed)
            if self._is_numeric_string(trimmed) and not self._is_identifier_key(key):
                return self._parse_number(trimmed)
            return trimmed
        return value

    def _is_timestamp_key(self, key: str) -> bool:
        lowered = key.lower()
        return "date" in lowered or "time" in lowered

    def _is_identifier_key(self, key: str) -> bool:
        lowered = key.lower()
        return lowered == "id" or lowered.endswith("_id") or lowered.endswith("id")

    def _normalize_timestamp_string(self, value: str) -> str:
        candidate = value
        if "/" in candidate and "-" not in candidate:
            candidate = candidate.replace("/", "-")
        if " " in candidate and "T" not in candidate:
            parts = candidate.split()
            if len(parts) >= 2:
                candidate = f"{parts[0]}T{parts[1]}"
        return self._format_timestamp(candidate)

    def _format_timestamp(self, value: str) -> str:
        return value.replace("+00:00", "Z")

    def _is_numeric_string(self, value: str) -> bool:
        try:
            float(value)
        except ValueError:
            return False
        return True

    def _parse_number(self, value: str) -> int | float | str:
        try:
            if any(ch in value for ch in (".", "e", "E")):
                return float(value)
            return int(value)
        except ValueError:
            return value