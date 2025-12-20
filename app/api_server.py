#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

from src.model.graph.graph import ReliabilityGraph
from src.model.eventsourcing.service import GraphES
from src.services.cache.local_store import LocalWorkspaceStore
from src.services.cache.event_store import EventStore
from src.services.api.graph_snapshot import serialize_graph, serialize_node

HOST = "127.0.0.1"
PORT = 8000


def build_graph_es() -> GraphES:
    local = LocalWorkspaceStore()
    store = EventStore(local)
    snapshot = local.load_snapshot()
    if snapshot:
        graph = ReliabilityGraph.from_data(snapshot)
    else:
        graph = ReliabilityGraph(auto_normalize=True)
    return GraphES(graph=graph, store=store, actor="anonymous")


class GraphRequestHandler(BaseHTTPRequestHandler):
    es: GraphES

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status_code: int, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

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

        self._send_json(404, {"error": "not found"})


def main() -> None:
    es = build_graph_es()
    GraphRequestHandler.es = es
    server = HTTPServer((HOST, PORT), GraphRequestHandler)
    print(f"API server listening on http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()