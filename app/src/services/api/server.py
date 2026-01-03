#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Servidor HTTP refactorizado para el API de reliability graphs."""
from __future__ import annotations

import os
import sys
import tempfile
import msvcrt
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse, unquote
from typing import ClassVar

from src.model.graph.graph import ReliabilityGraph
from src.model.eventsourcing.service import GraphES
from src.services.cache.local_store import LocalWorkspaceStore
from src.services.cache.event_store import EventStore
from src.services.remote.client import CloudClient

# Imports de shared state y handlers
from .shared import SharedState
from .handlers import (
    GraphHandler,
    CloudHandler,
    EventHistoryHandler,
    DraftHandler,
    ComponentSearchHandler,
    ViewsHandler,
    EvaluationHandler,
    FailuresHandler,
)

HOST = "127.0.0.1"
PORT = 8000

_lock_file = None


# ========== Funciones de lock y setup ==========

def acquire_single_instance_lock() -> bool:
    """
    Intenta adquirir un lock exclusivo para garantizar una sola instancia.
    Retorna True si se adquirió el lock, False si ya hay otra instancia corriendo.
    """
    global _lock_file
    
    lock_path = os.path.join(tempfile.gettempdir(), "blocon_api_server.lock")
    
    try:
        try:
            _lock_file = open(lock_path, 'w')
            msvcrt.locking(_lock_file.fileno(), msvcrt.LK_NBLCK, 1)
            _lock_file.write(str(os.getpid()))
            _lock_file.flush()
            return True
        except (IOError, OSError):
            if _lock_file:
                _lock_file.close()
            return False
    except Exception as e:
        print(f"Error acquiring lock: {e}", file=sys.stderr)
        return False


def release_single_instance_lock() -> None:
    """Libera el lock de instancia única."""
    global _lock_file
    if _lock_file:
        try:
            _lock_file.close()
        except:
            pass
        _lock_file = None
        lock_path = os.path.join(tempfile.gettempdir(), "blocon_api_server.lock")
        try:
            if os.path.exists(lock_path):
                os.remove(lock_path)
        except:
            pass


def is_port_available(host: str, port: int) -> bool:
    """Verifica si un puerto está disponible."""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind((host, port))
        sock.close()
        return True
    except OSError:
        return False


def _get_cloud_base_version(local: LocalWorkspaceStore) -> int:
    """Obtiene la head version desde SharePoint, con fallback a cache local."""
    try:
        cloud = CloudClient(base_dir=os.getcwd())
        sp_events = cloud._sp_events()
        if sp_events:
            return sp_events.get_max_version()
    except Exception as exc:
        print(f"[warning] Could not get cloud base_version: {exc}", file=sys.stderr)
    
    try:
        return len(local.load_events())
    except Exception:
        return 0


def build_graph_es(local: LocalWorkspaceStore | None = None) -> GraphES:
    """Construye GraphES desde local store."""
    local = local or LocalWorkspaceStore()
    base_version = _get_cloud_base_version(local)
    store = EventStore(local, base_version=base_version)
    snapshot = local.load_snapshot()
    
    if snapshot:
        graph = ReliabilityGraph.from_data(snapshot)
    else:
        graph = ReliabilityGraph(auto_normalize=True)
    
    return GraphES(graph=graph, store=store, actor="anonymous")


def clean_start(shared: SharedState) -> None:
    """Limpia eventos locales y pre-inicializa clientes SharePoint."""
    shared.local.clean_local_events()
    print("Pre-initializing SharePoint clients...", file=sys.stderr)
    try:
        shared.cloud._sp_components()
        shared.cloud._sp_snapshot()
        shared.cloud._sp_events()
        print("SharePoint clients ready", file=sys.stderr)
    except Exception as e:
        print(f"Warning: SharePoint init failed: {e}", file=sys.stderr)


# ========== Request Handler Refactorizado ==========

class GraphRequestHandler(BaseHTTPRequestHandler):
    """
    Handler HTTP minimalista que delega toda la lógica a handlers especializados.
    
    Responsabilidades:
    - Routing de requests a handlers apropiados
    - Manejo de CORS
    - Health check
    """
    
    shared: ClassVar[SharedState]
    
    def __init__(self, *args, **kwargs):
        # Cache de instancias de handlers (lazy initialization)
        self._handler_instances = {}
        super().__init__(*args, **kwargs)
    
    def _get_handler(self, handler_class):
        """Factory para obtener instancia de handler (con cache)."""
        handler_name = handler_class.__name__
        if handler_name not in self._handler_instances:
            self._handler_instances[handler_name] = handler_class(self.shared, self)
        return self._handler_instances[handler_name]
    
    def do_OPTIONS(self) -> None:
        """Manejo de preflight CORS."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        )
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
    
    def do_GET(self) -> None:
        """Routing de requests GET."""
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        params = parse_qs(parsed.query)
        
        # Health check (no requiere handler)
        if path == "/health":
            handler = self._get_handler(GraphHandler)
            handler._send_json(200, {"status": "ok"})
            return
        
        # Graph routes
        if path == "/graph":
            handler = self._get_handler(GraphHandler)
            handler.handle_get_graph()
            return
        
        if path.startswith("/graph/"):
            node_id = path[len("/graph/"):].strip()
            handler = self._get_handler(GraphHandler)
            handler.handle_get_node(node_id)
            return
        
        if path == "/diagram-view":
            handler = self._get_handler(GraphHandler)
            handler.handle_diagram_view_get()
            return
        
        # Event history routes
        if path == "/event-history":
            handler = self._get_handler(EventHistoryHandler)
            handler.handle_event_history(params)
            return
        
        if path == "/event-history/search":
            handler = self._get_handler(EventHistoryHandler)
            handler.handle_event_history_search(params)
            return
        
        if path.startswith("/event-history/version/") and path.endswith("/graph"):
            version_str = path[len("/event-history/version/"):-len("/graph")].strip("/")
            if not version_str:
                handler = self._get_handler(EventHistoryHandler)
                handler._send_json(404, {"error": "missing version"})
                return
            try:
                version = int(version_str)
            except ValueError:
                handler = self._get_handler(EventHistoryHandler)
                handler._send_json(400, {"error": "invalid version"})
                return
            handler = self._get_handler(EventHistoryHandler)
            handler.handle_event_version_graph(version)
            return
        
        # Component search routes
        if path == "/remote/components/search":
            handler = self._get_handler(ComponentSearchHandler)
            handler.handle_search_components(params)
            return
        
        # Draft routes
        if path == "/drafts":
            handler = self._get_handler(DraftHandler)
            handler.handle_list_drafts()
            return

        # View routes
        if path == "/views":
            handler = self._get_handler(ViewsHandler)
            handler.handle_list_views()
            return
        
        # 404
        handler = self._get_handler(GraphHandler)
        handler._send_json(404, {"error": "not found"})
    
    def do_POST(self) -> None:
        """Routing de requests POST."""
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        
        # Graph routes
        if path == "/graph/undo":
            handler = self._get_handler(GraphHandler)
            handler.handle_undo()
            return
        
        if path == "/graph/redo":
            handler = self._get_handler(GraphHandler)
            handler.handle_redo()
            return
        
        if path == "/graph/organization":
            handler = self._get_handler(GraphHandler)
            payload = handler._read_json_body()
            handler.handle_organization_insert(payload)
            return
        
        # Event history routes
        if path.startswith("/event-history/version/") and path.endswith("/rebuild"):
            version_str = path[len("/event-history/version/"):-len("/rebuild")].strip("/")
            if not version_str:
                handler = self._get_handler(EventHistoryHandler)
                handler._send_json(404, {"error": "missing version"})
                return
            try:
                version = int(version_str)
            except ValueError:
                handler = self._get_handler(EventHistoryHandler)
                handler._send_json(400, {"error": "invalid version"})
                return
            handler = self._get_handler(EventHistoryHandler)
            handler.handle_event_version_rebuild(version)
            return
        
        # Cloud routes
        if path == "/cloud/save":
            handler = self._get_handler(CloudHandler)
            handler.handle_cloud_save()
            return
        
        if path == "/cloud/load":
            handler = self._get_handler(CloudHandler)
            handler.handle_cloud_load()
            return
        
        if path == "/cloud/retry":
            handler = self._get_handler(CloudHandler)
            handler.handle_cloud_retry()
            return
        
        if path == "/cloud/cancel":
            handler = self._get_handler(CloudHandler)
            handler.handle_cloud_cancel()
            return

        if path == "/evaluate":
            handler = self._get_handler(EvaluationHandler)
            handler.handle_evaluate()
            return

        if path == "/failures/reload":
            handler = self._get_handler(FailuresHandler)
            handler.handle_reload_failures()
            return
                
        # Draft routes
        if path == "/drafts":
            handler = self._get_handler(DraftHandler)
            payload = handler._read_json_body()
            handler.handle_create_draft(payload)
            return
        
        if path.startswith("/drafts/") and path.endswith("/load"):
            draft_id = path[len("/drafts/"):-len("/load")].strip("/")
            handler = self._get_handler(DraftHandler)
            handler.handle_load_draft(draft_id)
            return
        

        # View routes
        if path == "/views":
            handler = self._get_handler(ViewsHandler)
            payload = handler._read_json_body()
            handler.handle_create_view(payload)
            return

        if path.startswith("/views/") and path.endswith("/load"):
            view_id = path[len("/views/"):-len("/load")].strip("/")
            handler = self._get_handler(ViewsHandler)
            handler.handle_load_view(view_id)
            return

        if path.startswith("/views/") and path.endswith("/save"):
            view_id = path[len("/views/"):-len("/save")].strip("/")
            handler = self._get_handler(ViewsHandler)
            payload = handler._read_json_body()
            handler.handle_save_view(view_id, payload)
            return

        if path.startswith("/views/") and path.endswith("/rename"):
            view_id = path[len("/views/"):-len("/rename")].strip("/")
            handler = self._get_handler(ViewsHandler)
            payload = handler._read_json_body()
            handler.handle_rename_view(view_id, payload)
            return
        
        # 404
        handler = self._get_handler(GraphHandler)
        handler._send_json(404, {"error": "not found"})
    
    def do_PUT(self) -> None:
        """Routing de requests PUT."""
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        
        # Diagram view
        if path == "/diagram-view":
            handler = self._get_handler(GraphHandler)
            payload = handler._read_json_body()
            handler.handle_diagram_view_put(payload)
            return
        
        # Draft routes
        if path.startswith("/drafts/"):
            draft_id = path[len("/drafts/"):].strip()
            handler = self._get_handler(DraftHandler)
            payload = handler._read_json_body()
            handler.handle_save_draft(draft_id, payload)
            return
        
        # 404
        handler = self._get_handler(GraphHandler)
        handler._send_json(404, {"error": "not found"})
    
    def do_PATCH(self) -> None:
        """Routing de requests PATCH."""
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        
        # Draft routes
        if path.startswith("/drafts/"):
            draft_id = path[len("/drafts/"):].strip()
            handler = self._get_handler(DraftHandler)
            payload = handler._read_json_body()
            handler.handle_rename_draft(draft_id, payload)
            return
        
        # 404
        handler = self._get_handler(GraphHandler)
        handler._send_json(404, {"error": "not found"})
    
    def do_DELETE(self) -> None:
        """Routing de requests DELETE."""
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        
        # Graph routes
        if path.startswith("/graph/node/"):
            node_id = path[len("/graph/node/"):].strip()
            handler = self._get_handler(GraphHandler)
            handler.handle_delete_node(node_id)
            return
        
        # Draft routes
        if path.startswith("/drafts/"):
            draft_id = path[len("/drafts/"):].strip()
            handler = self._get_handler(DraftHandler)
            handler.handle_delete_draft(draft_id)
            return
        
        # View routes
        if path.startswith("/views/"):
            view_id = path[len("/views/"):].strip()
            handler = self._get_handler(ViewsHandler)
            handler.handle_delete_view(view_id)
            return
        
        # 404
        handler = self._get_handler(GraphHandler)
        handler._send_json(404, {"error": "not found"})


# ========== Main ==========

def main() -> None:
    """Entry point del servidor."""
    
    if not acquire_single_instance_lock():
        print("Another instance of api_server is already running. Exiting.", file=sys.stderr)
        sys.exit(1)

    if not is_port_available(HOST, PORT):
        print(f"Port {PORT} is already in use. Exiting.", file=sys.stderr)
        release_single_instance_lock()
        sys.exit(1)

    # Setup inicial
    local = LocalWorkspaceStore()
    es = build_graph_es(local)
    base_dir = os.path.abspath(os.path.dirname(__file__))
    cloud = CloudClient(base_dir=base_dir)
    
    # Crear shared state
    GraphRequestHandler.shared = SharedState(
        es=es,
        local=local,
        cloud=cloud,
        base_dir=base_dir,
        cloud_baseline=es.graph.to_data(),
    )

    # Clean start
    clean_start(GraphRequestHandler.shared)

    # Iniciar servidor
    server = None
    try:
        server = HTTPServer((HOST, PORT), GraphRequestHandler)
        print(f"API server listening on http://{HOST}:{PORT}")
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    except Exception as e:
        print(f"Server error: {e}", file=sys.stderr)
    finally:
        if server:
            try:
                server.shutdown()
                server.server_close()
            except:
                pass
        release_single_instance_lock()
        print("Server stopped.")


if __name__ == "__main__":
    main()