#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

from src.model.graph.graph import ReliabilityGraph
from src.model.eventsourcing.service import GraphES
from src.services.cache.local_store import LocalWorkspaceStore
from src.services.cache.event_store import EventStore
from src.services.api.graph_snapshot import serialize_graph, serialize_node
from src.services.remote.cloud import CloudClient

HOST = "127.0.0.1"
PORT = 8000


def build_graph_es(local: LocalWorkspaceStore | None = None) -> GraphES:
    local = local or LocalWorkspaceStore()
    store = EventStore(local)
    snapshot = local.load_snapshot()
    if snapshot:
        graph = ReliabilityGraph.from_data(snapshot)
    else:
        graph = ReliabilityGraph(auto_normalize=True)
    return GraphES(graph=graph, store=store, actor="anonymous")


class GraphRequestHandler(BaseHTTPRequestHandler):
    es: GraphES
    local: LocalWorkspaceStore
    cloud: CloudClient

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status_code: int, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError) as exc:
            self.log_message("Client disconnected before response was sent: %s", exc)

    def do_OPTIONS(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def _read_json_body(self) -> dict | None:
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                length = 0
            if length <= 0:
                return None
            raw = self.rfile.read(length)
            try:
                return json.loads(raw)
            except json.JSONDecodeError:
                return None            

    @staticmethod
    def _normalize_relation_type(relation_type: str | None) -> str | None:
        if relation_type is None:
            return None
        if not isinstance(relation_type, str):
            return relation_type
        relation_upper = relation_type.upper()
        if relation_upper in ("AND", "OR", "KOON"):
            return relation_upper
        relation_lower = relation_type.lower()
        if relation_lower in ("series", "parallel", "koon"):
            return relation_lower
        return relation_type

    def _handle_organization_insert(self, payload: dict | None) -> None:
        if payload is None or not isinstance(payload, dict):
            self._send_json(400, {"error": "invalid payload"})
            return

        insert = payload.get("insert")
        if not isinstance(insert, dict):
            self._send_json(400, {"error": "missing insert payload"})
            return

        component_id = insert.get("componentId")
        calculation_type = insert.get("calculationType")
        if not component_id or not calculation_type:
            self._send_json(400, {"error": "missing componentId or calculationType"})
            return

        target = insert.get("target")
        target_id = None
        host_type = None
        relation_type = None
        if target is not None:
            if not isinstance(target, dict):
                self._send_json(400, {"error": "invalid target payload"})
                return
            target_id = target.get("hostId")
            host_type = target.get("hostType")
            relation_type = self._normalize_relation_type(target.get("relationType"))
            if host_type is not None:
                host_type = str(host_type).lower()

        position = insert.get("position") or {}
        if position is not None and not isinstance(position, dict):
            self._send_json(400, {"error": "invalid position payload"})
            return

        position_index = position.get("index") if isinstance(position, dict) else None
        if position_index is not None:
            try:
                position_index = int(position_index)
            except (TypeError, ValueError):
                self._send_json(400, {"error": "invalid position index"})
                return
            position_index -= 1

        position_reference_id = position.get("referenceId") if isinstance(position, dict) else None
        children_order = None
        reorder = payload.get("reorder")
        if isinstance(reorder, list) and reorder:
            ordered = []
            for entry in reorder:
                if not isinstance(entry, dict):
                    continue
                entry_id = entry.get("id")
                if not entry_id:
                    continue
                position = entry.get("position")
                if position is not None:
                    try:
                        position = int(position)
                    except (TypeError, ValueError):
                        position = None
                ordered.append((position, entry_id))
            if ordered:
                ordered.sort(key=lambda item: (item[0] is None, item[0]))
                children_order = [entry_id for _, entry_id in ordered]

        k_value = insert.get("k")
        if k_value is not None:
            try:
                k_value = int(k_value)
            except (TypeError, ValueError):
                self._send_json(400, {"error": "invalid k value"})
                return

        unit_type = insert.get("unitType")

        try:
            self.es.add_component_organization(
                new_comp_id=component_id,
                calculation_type=calculation_type,
                target_id=target_id,
                host_type=host_type,
                relation_type=relation_type,
                position_index=position_index,
                position_reference_id=position_reference_id,
                children_order=children_order,
                k=k_value,
                unit_type=unit_type,
            )
        except Exception as exc:
            print(str(exc))
            self._send_json(400, {"error": str(exc)})
            return

        self._send_json(200, {"status": "ok"})

    def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/health":
            self._send_json(200, {"status": "ok"})
            return

        if path == "/graph":
            self._send_json(200, serialize_graph(self.es.graph))
            return

        if path.startswith("/graph/"):
            node_id = path[len("/graph/"):].strip()
            if not node_id:
                self._send_json(404, {"error": "missing node id"})
                return
            node_data = serialize_node(self.es.graph, node_id)
            if node_data is None:
                self._send_json(404, {"error": f"node '{node_id}' not found"})
                return
            self._send_json(200, node_data)
            return
        
        if path == "/diagram-view":
            self._send_json(200, self.local.load_diagram_view())
            return
        
        if path == "/remote/components/search":
            params = parse_qs(parsed.query)
            query = (params.get("query") or [""])[0]
            try:
                page = int((params.get("page") or ["1"])[0])
            except ValueError:
                page = 1
            try:
                page_size = int((params.get("page_size") or ["20"])[0])
            except ValueError:
                page_size = 20
            items, total = self.cloud.search_components(query, page=page, page_size=page_size)
            self._send_json(200, {"items": items, "total": total})
            return

        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/graph/organization":
            payload = self._read_json_body()
            self._handle_organization_insert(payload)
            return

        self._send_json(404, {"error": "not found"})
        
    def do_PUT(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/diagram-view":
            payload = self._read_json_body()
            if payload is None or not isinstance(payload, dict):
                self._send_json(400, {"error": "invalid payload"})
                return
            self.local.save_diagram_view(payload)
            self._send_json(200, self.local.load_diagram_view())
            return

        self._send_json(404, {"error": "not found"})


def main() -> None:
    local = LocalWorkspaceStore()
    es = build_graph_es(local)
    base_dir = os.path.abspath(os.path.dirname(__file__))
    GraphRequestHandler.es = es
    GraphRequestHandler.local = local
    GraphRequestHandler.cloud = CloudClient(base_dir=base_dir)
    server = HTTPServer((HOST, PORT), GraphRequestHandler)
    print(f"API server listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()