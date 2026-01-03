#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handlers para operaciones de event history."""
from __future__ import annotations

import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..shared import SharedState
    from http.server import BaseHTTPRequestHandler

from .base import BaseHandler
from ..coordinators import CloudCoordinator, GraphCoordinator
from ..shared import PerfLogger
from src.services.api.graph_snapshot import serialize_graph


class EventHistoryHandler(BaseHandler):
    """
    Handler para event history.
    
    Rutas manejadas:
    - GET /event-history - Listar eventos
    - GET /event-history/search - Buscar eventos
    - GET /event-history/version/{version}/graph - Grafo en versión específica
    - POST /event-history/version/{version}/rebuild - Rebuild a versión específica
    """
    
    def __init__(self, shared: SharedState, request_handler: BaseHTTPRequestHandler):
        super().__init__(shared, request_handler)
        self.cloud_coordinator = CloudCoordinator(shared)
        self.graph_coordinator = GraphCoordinator(shared)
    
    # ========== List & Search ==========
    
    def handle_event_history(self, params: dict[str, list[str]]) -> None:
        """
        GET /event-history - Lista todos los eventos con paginación.
        
        Args:
            params: Query params con offset y limit
        """
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

        events = self.shared.cloud.load_events()
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
    
    def handle_event_history_search(self, params: dict[str, list[str]]) -> None:
        """
        GET /event-history/search - Busca eventos por versión, timestamp o kind.
        
        Args:
            params: Query params con criterios de búsqueda
        """
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

        version_value = (params.get("version") or [None])[0]
        timestamp_value = (params.get("timestamp") or [None])[0]
        kind_prefix = (params.get("kind_prefix") or [None])[0]
        kinds_raw = (params.get("kinds") or [None])[0]

        search_modes = [
            bool(version_value),
            bool(timestamp_value),
            bool(kind_prefix or kinds_raw),
        ]
        if sum(search_modes) != 1:
            self._send_json(400, {"error": "invalid search parameters"})
            return

        if version_value:
            try:
                version = int(version_value)
            except ValueError:
                self._send_json(400, {"error": "invalid version"})
                return
            events, total = self.shared.cloud.search_events_by_version(
                version=version, offset=offset, limit=limit
            )
        elif timestamp_value:
            timestamp = str(timestamp_value or "").strip()
            if not timestamp or not re.match(r"^\d{4}-\d{2}(-\d{2})?$", timestamp):
                self._send_json(400, {"error": "invalid timestamp"})
                return
            events, total = self.shared.cloud.search_events_by_timestamp(
                timestamp_prefix=timestamp, offset=offset, limit=limit
            )
        else:
            kinds = []
            if kinds_raw:
                kinds = [
                    kind.strip()
                    for kind in str(kinds_raw).split(",")
                    if kind.strip()
                ]
            prefix = str(kind_prefix or "").strip() or None
            if not prefix and not kinds:
                self._send_json(400, {"error": "invalid kind search"})
                return
            events, total = self.shared.cloud.search_events_by_kind(
                kind_prefix=prefix, kinds=kinds, offset=offset, limit=limit
            )

        self._send_json(
            200,
            {
                "events": events,
                "total": total,
                "offset": offset,
                "limit": limit,
            },
        )
    
    # ========== Version Operations ==========
    
    def handle_event_version_graph(self, version: int) -> None:
        """
        GET /event-history/version/{version}/graph - Obtiene grafo en versión específica.
        
        Args:
            version: Versión del grafo a obtener
        """
        try:
            events = self.cloud_coordinator._load_event_objects()
            events_upto = self.cloud_coordinator._events_upto_version(events, version)
            graph = self.graph_coordinator.rebuild_from_events(events_upto)
            graph_data = serialize_graph(graph)
            self._send_json(200, graph_data)
        except Exception as exc:
            self._send_json(500, {"error": str(exc)})
    
    def handle_event_version_rebuild(self, version: int) -> None:
        """
        POST /event-history/version/{version}/rebuild - Rebuild a versión específica.
        
        Args:
            version: Versión target para rebuild
        """
        perf = PerfLogger("rebuild")
        
        try:
            result = self.cloud_coordinator.rebuild_to_version(version, perf=perf)
            
            # Refresh cloud state después de rebuild
            def _refresh() -> None:
                with perf.stage("refresh_cloud_state"):
                    self.cloud_coordinator.refresh_cloud_state(perf)

            if not self._run_cloud_op("cloud-load", _refresh, payload={}):
                return

            perf.log(
                events_count=result.get("events_count", 0),
                snapshot_bytes=self._json_size(result.get("snapshot", {})),
                append_events=result.get("append_events", 0),
            )
            
            self._send_json(
                200,
                {
                    "status": "ok",
                    "version": result["version"],
                    "head_previous": result["head_previous"],
                },
            )
        except Exception as exc:
            self._send_cloud_error("rebuild", exc)
    
    # ========== Utilidades internas ==========
    
    def _run_cloud_op(self, operation: str, fn, *, payload: dict | None = None) -> bool:
        """
        Ejecuta una operación cloud con manejo de errores.
        
        Args:
            operation: Nombre de la operación
            fn: Función a ejecutar
            payload: Payload opcional
            
        Returns:
            True si tuvo éxito, False si falló
        """
        try:
            fn()
            self.shared.pending_cloud_op = None
            return True
        except Exception as exc:
            from src.services.remote.errors import normalize_cloud_error
            from datetime import datetime, timezone
            from ..shared import PendingCloudOperation
            
            error = normalize_cloud_error(operation, exc)
            if error.retryable:
                self.shared.pending_cloud_op = PendingCloudOperation(
                    operation=operation,
                    payload=payload or {},
                    timestamp=datetime.now(timezone.utc),
                )
            self._send_cloud_error(operation, exc)
            return False