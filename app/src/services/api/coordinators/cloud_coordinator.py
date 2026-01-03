#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Coordinador de operaciones cloud."""
from __future__ import annotations

import sys
import time
from contextlib import nullcontext
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..shared import SharedState, PerfLogger

from src.model.graph.graph import ReliabilityGraph
from src.model.eventsourcing.events import SnapshotEvent, SetIgnoreRangeEvent, event_from_dict
from src.services.cache.event_store import EventStore
from src.services.remote.errors import normalize_cloud_error
from datetime import datetime, timezone


class CloudCoordinator:
    """
    Coordinador para operaciones cloud.
    
    Maneja:
    - Cloud load (sincronización desde SharePoint)
    - Cloud save (commit de cambios locales)
    - Rebuild (reconstrucción a versión específica)
    """
    
    def __init__(self, shared: SharedState):
        """
        Inicializa el coordinador de cloud.
        
        Args:
            shared: Estado compartido del servidor
        """
        self.shared = shared
    
    # ========== Cloud Load ==========
    
    def refresh_cloud_state(self, perf: "PerfLogger | None" = None) -> None:
        """
        Carga el estado completo desde SharePoint y actualiza el estado local.
        
        Proceso:
        1. Carga manifest para obtener lista de componentes
        2. Fetch de componentes faltantes o con etag diferente
        3. Carga snapshot y eventos desde cloud
        4. Reconstruye grafo desde snapshot
        5. Actualiza caches locales
        6. Limpia event store local
        
        Args:
            perf: Logger de performance opcional
        """
        cloud = self.shared.cloud
        local = getattr(cloud, "local", None)

        with (perf.stage("load_manifest") if perf else nullcontext()):
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

        fetched: dict = {}
        if need_fetch:
            with (perf.stage("fetch_components", count=len(need_fetch)) if perf else nullcontext()):
                fetched = cloud.fetch_components(
                    need_fetch,
                    update_local=False,
                    allow_local_fallback=False,
                    operation="cloud-load",
                ) or {}

        with (perf.stage("load_snapshot") if perf else nullcontext()):
            snap = cloud.load_snapshot(
                update_local=False,
                allow_local_fallback=False,
                operation="cloud-load",
            ) or {}
        
        with (perf.stage("load_events") if perf else nullcontext()):
            events = cloud.load_events(
                update_local=False,
                allow_local_fallback=False,
                operation="cloud-load",
            )
        
        with (perf.stage("build_graph_from_snapshot", snapshot_bytes=self._json_size(snap)) if perf else nullcontext()):
            graph = ReliabilityGraph.from_data(snap)
        
        if local:
            graph.failures_cache = local.failures_cache

        items_to_cache = []
        for component_id, meta in fetched.items():
            item = dict(meta or {})
            name = item.get("kks_name") or item.get("title") or component_id
            item.setdefault("title", name)
            item.setdefault("id", component_id)
            items_to_cache.append(item)

        if local and items_to_cache:
            with (perf.stage("update_components_cache", count=len(items_to_cache)) if perf else nullcontext()):
                local.upsert_components_cache(items_to_cache)

        try:
            cache = local.load_components_cache() if local else {}
            for node_id, node in graph.nodes.items():
                if node.is_component() and not getattr(node, "unit_type", None):
                    unit_type = (cache.get(node_id, {}) or {}).get("type")
                    if unit_type:
                        node.unit_type = unit_type
        except Exception:
            pass

        try:
            if local:
                with (perf.stage("save_snapshot_local", snapshot_bytes=self._json_size(snap)) if perf else nullcontext()):
                    local.save_snapshot(snap)
        except Exception:
            pass

        try:
            if local:
                with (perf.stage("replace_events_local", events_count=len(events)) if perf else nullcontext()):
                    local.replace_events(events)
        except Exception:
            pass

        try:
            if self.shared.es.store:
                with (perf.stage("clear_event_store") if perf else nullcontext()):
                    self.shared.es.store.clear()
        except Exception:
            pass

        self.shared.es.graph = graph
        self.shared.cloud_baseline = graph.to_data()

        try:
            if self.shared.es.store:
                with (perf.stage("update_base_version") if perf else nullcontext()):
                    sp_events = self.shared.cloud._sp_events()
                    if sp_events:
                        max_version = sp_events.get_max_version()
                        self.shared.es.store.base_version = max_version
                    else:
                        self.shared.es.store.base_version = len(events)
        except Exception:
            try:
                if self.shared.es.store:
                    self.shared.es.store.base_version = len(events)
            except Exception:
                pass
    
    # ========== Cloud Save ==========
    
    def prepare_save_payload(self, perf: "PerfLogger | None" = None) -> tuple[dict, ReliabilityGraph]:
        """
        Prepara el payload para cloud save (snapshot + eventos locales).
        
        Args:
            perf: Logger de performance opcional
            
        Returns:
            Tupla (payload_dict, graph) donde payload contiene snapshot y local_events
            
        Raises:
            ValueError: Si hay eventos sin versión después de resequence
        """
        graph = self.shared.es.graph
        try:
            graph.project_root = self.shared.base_dir
            graph.failures_cache = self.shared.local.failures_cache
            with (perf.stage("graph_evaluate") if perf else nullcontext()):
                self.shared.es.evaluate()
        except Exception:
            pass

        with (perf.stage("graph_to_data") if perf else nullcontext()):
            snapshot = graph.to_data()
        
        local_events: list[dict] = []
        if self.shared.es.store:
            try:
                head = self.get_head_version()
                self.shared.es.store.resequence_versions(head)
                active = self.shared.es.store.active()
                versions = [getattr(ev, "version", None) for ev in active]
                if any(v is None for v in versions):
                    raise ValueError("local event version is None after resequence")
                first_version = next((v for v in versions if isinstance(v, int)), None)
                last_version = next((v for v in reversed(versions) if isinstance(v, int)), None)
                print(
                    "[cloud-save] resequence local events",
                    f"head_remote={head}",
                    f"count_local={len(active)}",
                    f"first_version={first_version}",
                    f"last_version={last_version}",
                    file=sys.stderr,
                )
                local_events = [ev.to_dict() for ev in active]
            except ValueError:
                raise
            except Exception:
                local_events = []
        
        payload = {
            "snapshot": snapshot,
            "local_events": local_events,
        }
        return payload, graph
    
    def execute_save_commit(self, payload: dict, perf: "PerfLogger | None" = None) -> int:
        """
        Ejecuta el commit atómico de cloud save.
        
        Args:
            payload: Dict con 'snapshot' y 'local_events'
            perf: Logger de performance opcional
            
        Returns:
            Número de eventos agregados
        """
        snapshot = payload.get("snapshot") or {}
        snapshot_bytes = self._json_size(snapshot)
        raw_events = self._ensure_dict_list(payload.get("local_events"))
        to_append: list[dict] = []
        
        with (perf.stage("cloud_atomic_operation", events_count=len(raw_events), snapshot_bytes=snapshot_bytes) if perf else nullcontext()):
            with self.shared.cloud.atomic_operation("cloud-save") as op:
                if raw_events:
                    head = op.head_version()
                    for idx, event_payload in enumerate(raw_events):
                        payload_copy = dict(event_payload)
                        payload_copy["version"] = head + idx + 1
                        to_append.append(payload_copy)
                    op.append_events(to_append)
                op.save_snapshot(snapshot)
        
        return len(to_append)
    
    def finalize_save(
        self,
        snapshot: dict,
        graph: ReliabilityGraph,
        perf: "PerfLogger | None" = None,
    ) -> None:
        """
        Finaliza cloud save actualizando manifest y limpiando estado local.
        
        Args:
            snapshot: Snapshot guardado
            graph: Grafo guardado
            perf: Logger de performance opcional
        """
        cache = self.shared.local.load_components_cache()
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
        with (perf.stage("save_manifest", component_count=len(component_ids)) if perf else nullcontext()):
            self.shared.cloud.save_manifest(manifest)

        try:
            if self.shared.es.store:
                with (perf.stage("clear_event_store") if perf else nullcontext()):
                    self.shared.es.store.clear()
        except Exception:
            pass

        try:
            with (perf.stage("delete_draft") if perf else nullcontext()):
                self.shared.local.draft_delete()
        except Exception:
            pass

        self.shared.cloud_baseline = snapshot
    
    # ========== Rebuild ==========
    
    def rebuild_to_version(self, version: int, perf: "PerfLogger | None" = None) -> dict:
        """
        Rebuild del grafo a una versión específica y commit a cloud.
        
        Args:
            version: Versión target del rebuild
            perf: Logger de performance opcional
            
        Returns:
            Dict con información del resultado (version, head_previous, etc.)
        """
        with perf.stage("load_events") if perf else nullcontext():
            events = self._load_event_objects(
                operation="rebuild",
                allow_local_fallback=False,
            )
        
        head_prev = len(events)
        events_upto = self._events_upto_version(events, version)
        
        with perf.stage("rebuild_graph", events_count=len(events_upto)) if perf else nullcontext():
            graph = self.shared.es.rebuild(events_upto)
        
        with perf.stage("graph_to_data") if perf else nullcontext():
            snapshot = graph.to_data()

        snapshot_event = SnapshotEvent.create(
            data=snapshot, actor="version-control"
        )
        snapshot_dict = snapshot_event.to_dict()
        snapshot_dict["version"] = head_prev + 1

        to_append = [snapshot_dict]

        if version < head_prev:
            ignore_event = SetIgnoreRangeEvent.create(
                start_v=version + 1,
                end_v=head_prev,
                actor="version-control",
            )
            ignore_dict = ignore_event.to_dict()
            ignore_dict["version"] = head_prev + 2
            to_append.append(ignore_dict)

        self.execute_rebuild_commit(snapshot, to_append, perf=perf)

        try:
            self.shared.local.draft_delete()
        except Exception:
            pass

        return {
            "version": version,
            "head_previous": head_prev,
            "snapshot": snapshot,
            "events_count": len(events),
            "append_events": len(to_append),
        }
    
    def execute_rebuild_commit(
        self,
        snapshot: dict,
        to_append: list[dict],
        perf: "PerfLogger | None" = None,
    ) -> None:
        """
        Ejecuta el commit atómico de rebuild.
        
        Args:
            snapshot: Snapshot a guardar
            to_append: Eventos a agregar
            perf: Logger de performance opcional
        """
        snapshot_bytes = self._json_size(snapshot)
        with (perf.stage("cloud_atomic_operation", events_count=len(to_append), snapshot_bytes=snapshot_bytes) if perf else nullcontext()):
            with self.shared.cloud.atomic_operation("rebuild") as op:
                with (perf.stage("append_events", events_count=len(to_append)) if perf else nullcontext()):
                    op.append_events(to_append)
                with (perf.stage("save_snapshot", snapshot_bytes=snapshot_bytes) if perf else nullcontext()):
                    op.save_snapshot(snapshot)
    
    # ========== Utilities ==========
    
    def get_head_version(self) -> int:
        """
        Obtiene la versión HEAD actual de cloud.
        
        Returns:
            Número de versión HEAD (número total de eventos en cloud)
        """
        try:
            return len(self.shared.cloud.load_events())
        except Exception:
            return 0
    
    def _load_event_objects(
        self,
        *,
        operation: str = "event-history",
        allow_local_fallback: bool = True,
    ) -> list[object]:
        """Carga eventos desde cloud como objetos Event."""
        raw = self.shared.cloud.load_events(
            allow_local_fallback=allow_local_fallback,
            operation=operation,
        )
        events: list[object] = []
        for entry in raw:
            try:
                events.append(event_from_dict(entry))
            except Exception:
                continue
        return events
    
    @staticmethod
    def _safe_event_version(event: object, index: int) -> int:
        """Extrae versión de evento de forma segura."""
        ver = getattr(event, "version", None)
        return ver if isinstance(ver, int) else (index + 1)
    
    def _events_upto_version(self, all_events: list[object], version: int) -> list[object]:
        """Filtra eventos hasta una versión específica."""
        events_upto = []
        for idx, event in enumerate(all_events):
            ver = self._safe_event_version(event, idx)
            if ver <= version:
                events_upto.append(event)
        return events_upto
    
    @staticmethod
    def _json_size(payload: object) -> int:
        """Calcula tamaño en bytes de un payload JSON."""
        import json
        try:
            return len(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
        except Exception:
            return 0
    
    @staticmethod
    def _ensure_dict_list(items: object) -> list[dict]:
        """Valida y convierte a lista de diccionarios."""
        if not isinstance(items, list):
            return []
        result = []
        for item in items:
            if isinstance(item, dict):
                result.append(dict(item))
        return result