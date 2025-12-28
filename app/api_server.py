#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from __future__ import annotations

import os
import sys
import json
import time
from datetime import datetime, timezone
import socket
import msvcrt
import tempfile
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse, unquote

from src.model.graph.graph import ReliabilityGraph
from src.model.eventsourcing.events import SnapshotEvent, event_from_dict
from src.model.eventsourcing.service import GraphES
from src.services.cache.local_store import LocalWorkspaceStore
from src.services.cache.event_store import EventStore
from src.services.api.graph_snapshot import serialize_graph, serialize_node
from src.services.remote.cloud import CloudClient

HOST = "127.0.0.1"
PORT = 8000

_lock_file = None


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
    base_dir: str
    cloud_baseline: dict | None = None

    def _replay_local(self) -> None:
        if not self.es.store:
            return

        active_events = []
        try:
            active_events = self.es.store.active()
        except Exception:
            active_events = []

        events = active_events
        baseline = self.cloud_baseline
        if baseline is not None:
            ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            snapshot_event = SnapshotEvent(
                kind="snapshot", actor="api", ts=ts, data=baseline
            )
            events = [snapshot_event] + active_events

        try:
            self.es.graph = self.es.rebuild(events)
        except Exception:
            pass

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        )
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status_code: int, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Connection", "keep-alive")
        self.end_headers()
        try:
            self.wfile.write(data)
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError) as exc:
            self.log_message("Client disconnected before response was sent: %s", exc)

    def do_OPTIONS(self) -> None:
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

    def _handle_cloud_load(self) -> None:
        try:
            if self.es.store:
                self.es.store.clear()
        except Exception:
            pass

        cloud = self.cloud
        local = getattr(cloud, "local", None)

        manifest = cloud.load_manifest() or {}
        comp_entries = manifest.get("component_ids", [])
        want_ids = [entry["id"] if isinstance(entry, dict) else entry for entry in comp_entries]
        want_etags = {
            entry["id"]: entry.get("etag")
            for entry in comp_entries
            if isinstance(entry, dict) and entry.get("id")
        }

        cache = local.load_components_cache() if local else {}
        need_fetch: list[str] = []
        for component_id in want_ids:
            component_id = str(component_id or "").strip()
            if not component_id:
                continue
            etag = want_etags.get(component_id)
            if component_id not in cache or (
                etag and (cache.get(component_id, {}) or {}).get("etag") != etag
            ):
                need_fetch.append(component_id)

        if need_fetch:
            fetched = cloud.fetch_components(need_fetch) or {}
            items_to_cache = []
            for component_id, meta in fetched.items():
                item = dict(meta or {})
                name = item.get("kks_name") or item.get("title") or component_id
                item.setdefault("title", name)
                item.setdefault("id", component_id)
                items_to_cache.append(item)

            if local and items_to_cache:
                local.upsert_components_cache(items_to_cache)

        snap = cloud.load_snapshot() or {}
        graph = ReliabilityGraph.from_data(snap)
        if local:
            graph.failures_cache = local.failures_cache

        try:
            cache = local.load_components_cache() if local else {}
            for node_id, node in graph.nodes.items():
                if node.is_component() and not getattr(node, "unit_type", None):
                    unit_type = (cache.get(node_id, {}) or {}).get("type")
                    if unit_type:
                        node.unit_type = unit_type
        except Exception:
            pass

        self.es.graph = graph
        self.cloud_baseline = graph.to_data()

        try:
            head = len(cloud.load_events())
            if self.es.store:
                self.es.store.base_version = head
        except Exception:
            pass

        self._send_json(200, {"status": "ok"})

    def _handle_cloud_save(self) -> None:
        cloud = self.cloud
        graph = self.es.graph

        try:
            graph.project_root = self.base_dir
            graph.failures_cache = self.local.failures_cache
            self.es.evaluate()
        except Exception:
            pass

        snapshot = graph.to_data()
        cloud.save_snapshot(snapshot)

        appended = 0
        try:
            if self.es.store:
                head = len(cloud.load_events())
                self.es.store.resequence_versions(head)
                local_events = [ev.to_dict() for ev in self.es.store.active()]
                appended = cloud.append_events(local_events)
        except Exception:
            appended = 0

        cache = self.local.load_components_cache()
        component_ids = sorted(
            [node_id for node_id, node in graph.nodes.items() if node.is_component()]
        )
        comp_entries = []
        for component_id in component_ids:
            etag = (cache.get(component_id) or {}).get("etag")
            entry = {"id": component_id}
            if etag:
                entry["etag"] = etag
            comp_entries.append(entry)

        manifest = {
            "diagram_id": "default",
            "version": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "component_ids": comp_entries,
        }
        cloud.save_manifest(manifest)

        try:
            if self.es.store:
                self.es.store.clear()
        except Exception:
            pass

        try:
            self.local.draft_delete()
        except Exception:
            pass

        self.cloud_baseline = snapshot
        self._send_json(200, {"status": "ok", "events_uploaded": appended})

    def _handle_event_history(self, params: dict[str, list[str]]) -> None:
        try:
            offset = int((params.get("offset") or ["0"])[0])
        except ValueError:
            offset = 0
        try:
            limit = int((params.get("limit") or ["50"])[0])
        except ValueError:
            limit = 50

        if offset < 0:
            offset = 0
        if limit <= 0:
            limit = 50

        events = self.cloud.load_events()
        total = len(events)
        page = events[offset : offset + limit]

        self._send_json(
            200,
            {
                "events": page,
                "total": total,
                "offset": offset,
                "limit": limit,
            },
        )

    def _cloud_head_version(self) -> int:
        try:
            return len(self.cloud.load_events())
        except Exception:
            return 0

    def _collect_draft_state(self) -> tuple[dict, list, int]:
        base_version = self._cloud_head_version()
        if not self.es.store:
            self.es.set_store(EventStore(self.local))
        try:
            if self.es.store:
                self.es.store.resequence_versions(base_version)
        except Exception:
            pass

        snapshot = self.es.graph.to_data()
        events: list = []
        try:
            events = [ev.to_dict() for ev in (self.es.store.active() if self.es.store else [])]
        except Exception:
            events = []
        return snapshot, events, base_version

    def _apply_loaded_draft(self, snapshot: dict, events: list, meta: dict) -> None:
        self.es.graph = ReliabilityGraph.from_data(snapshot or {})
        self.cloud_baseline = self.es.graph.to_data()
        if not self.es.store:
            self.es.set_store(EventStore(self.local))

        evs = []
        try:
            for d in (events or []):
                try:
                    evs.append(event_from_dict(d))
                except Exception:
                    pass
        except Exception:
            evs = []

        try:
            if self.es.store:
                self.es.store.replace(evs)
        except Exception:
            try:
                if self.es.store:
                    self.es.store.clear()
                    for ev in evs:
                        self.es.store.append(ev)
            except Exception:
                pass

        try:
            bv = meta.get("base_version", None) if isinstance(meta, dict) else None
            if bv is not None and self.es.store:
                self.es.store.base_version = int(bv)
        except Exception:
            pass

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
        print(f"[INSERT] Received organization insert request", file=sys.stderr)
        sys.stderr.flush()
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
            print(f"[INSERT] Calling add_component_organization for {component_id}", file=sys.stderr)
            sys.stderr.flush()
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
            print(f"[INSERT] Successfully added component", file=sys.stderr)
            sys.stderr.flush()
        except Exception as exc:
            print(f"[INSERT] Error: {str(exc)}", file=sys.stderr)
            print(str(exc))
            self._send_json(400, {"error": str(exc)})
            return

        self._send_json(200, {"status": "ok"})

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/health":
            self._send_json(200, {"status": "ok"})
            return

        if path == "/event-history":
            params = parse_qs(parsed.query)
            self._handle_event_history(params)
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

        if path == "/drafts":
            drafts = self.local.drafts_list()
            self._send_json(200, {"drafts": drafts})
            return

        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/graph/undo":
            if self.es.store and self.es.store.undo():
                self._replay_local()
                self._send_json(200, {"status": "ok"})
                return
            self._send_json(200, {"status": "noop"})
            return

        if path == "/graph/redo":
            if self.es.store and self.es.store.redo():
                self._replay_local()
                self._send_json(200, {"status": "ok"})
                return
            self._send_json(200, {"status": "noop"})
            return

        if path == "/graph/organization":
            payload = self._read_json_body()
            self._handle_organization_insert(payload)
            return
        
        if path == "/cloud/save":
            self._handle_cloud_save()
            return

        if path == "/cloud/load":
            self._handle_cloud_load()
            return

        if path == "/drafts":
            payload = self._read_json_body()
            name = None
            if isinstance(payload, dict):
                name = payload.get("name")
            snapshot, events, base_version = self._collect_draft_state()
            result = self.local.drafts_create(
                snapshot=snapshot,
                events=events,
                base_version=base_version,
                name=name if isinstance(name, str) else None,
            )
            self._send_json(200, {"status": "ok", "draft": result})
            return

        if path.startswith("/drafts/") and path.endswith("/load"):
            draft_id = unquote(path[len("/drafts/"):-len("/load")].strip("/"))
            if not draft_id:
                self._send_json(404, {"error": "missing draft id"})
                return
            cloud_head = self._cloud_head_version()
            result = self.local.drafts_load(draft_id=draft_id, cloud_head=cloud_head)
            status = result.get("status")
            if status == "ok":
                meta = (result.get("draft") or {}).get("meta") or {}
                self._apply_loaded_draft(
                    result.get("snapshot") or {},
                    result.get("events") or [],
                    meta,
                )
                self._send_json(200, {"status": "ok", "draft": result.get("draft")})
                return
            self._send_json(200, {"status": status, "deleted": result.get("deleted", False)})
            return

        self._send_json(404, {"error": "not found"})
        
    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/diagram-view":
            payload = self._read_json_body()
            if payload is None or not isinstance(payload, dict):
                self._send_json(400, {"error": "invalid payload"})
                return
            if "insert" in payload:
                self._handle_organization_insert(payload)
                return
            self.local.save_diagram_view(payload)
            self._send_json(200, self.local.load_diagram_view())
            return

        if path.startswith("/drafts/"):
            draft_id = unquote(path[len("/drafts/"):].strip())
            if not draft_id:
                self._send_json(404, {"error": "missing draft id"})
                return
            payload = self._read_json_body()
            name = None
            if isinstance(payload, dict):
                name = payload.get("name")
            snapshot, events, base_version = self._collect_draft_state()
            try:
                result = self.local.drafts_save(
                    draft_id=draft_id,
                    snapshot=snapshot,
                    events=events,
                    base_version=base_version,
                    name=name if isinstance(name, str) else None,
                )
            except ValueError as exc:
                self._send_json(400, {"error": str(exc)})
                return
            self._send_json(200, {"status": "ok", "draft": result})
            return

        self._send_json(404, {"error": "not found"})

    def do_PATCH(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path.startswith("/drafts/"):
            draft_id = unquote(path[len("/drafts/"):].strip())
            if not draft_id:
                self._send_json(404, {"error": "missing draft id"})
                return
            payload = self._read_json_body()
            if payload is None or not isinstance(payload, dict):
                self._send_json(400, {"error": "invalid payload"})
                return
            name = payload.get("name")
            if not isinstance(name, str) or not name.strip():
                self._send_json(400, {"error": "invalid name"})
                return
            try:
                result = self.local.drafts_rename(draft_id=draft_id, name=name)
            except ValueError as exc:
                self._send_json(400, {"error": str(exc)})
                return
            self._send_json(200, {"status": "ok", "draft": result})
            return

        self._send_json(404, {"error": "not found"})

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path.startswith("/graph/node/"):
            node_id = unquote(path[len("/graph/node/"):].strip())
            if not node_id:
                self._send_json(404, {"error": "missing node id"})
                return
            if node_id not in self.es.graph.nodes:
                self._send_json(404, {"error": f"node '{node_id}' not found"})
                return
            try:
                self.es.remove_node(node_id)
            except Exception as exc:
                self._send_json(400, {"error": str(exc)})
                return
            self._send_json(200, {"status": "ok"})
            return

        if path.startswith("/drafts/"):
            draft_id = unquote(path[len("/drafts/"):].strip())
            if not draft_id:
                self._send_json(404, {"error": "missing draft id"})
                return
            deleted = self.local.drafts_delete(draft_id=draft_id)
            self._send_json(200, {"status": "ok", "deleted": deleted})
            return

        self._send_json(404, {"error": "not found"})
    

def main() -> None:

    if not acquire_single_instance_lock():
        print("Another instance of api_server is already running. Exiting.", file=sys.stderr)
        sys.exit(1)

    if not is_port_available(HOST, PORT):
        print(f"Port {PORT} is already in use. Exiting.", file=sys.stderr)
        release_single_instance_lock()
        sys.exit(1)

    local = LocalWorkspaceStore()
    es = build_graph_es(local)
    base_dir = os.path.abspath(os.path.dirname(__file__))
    cloud = CloudClient(base_dir=base_dir)

    print("Pre-initializing SharePoint clients...", file=sys.stderr)
    try:
        cloud._sp_components()  # Forzar inicialización
        cloud._sp_snapshot()
        cloud._sp_events()
        print("SharePoint clients ready", file=sys.stderr)
    except Exception as e:
        print(f"Warning: SharePoint init failed: {e}", file=sys.stderr)
    
    GraphRequestHandler.es = es
    GraphRequestHandler.local = local
    GraphRequestHandler.cloud = cloud
    GraphRequestHandler.base_dir = base_dir
    GraphRequestHandler.cloud_baseline = es.graph.to_data()

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