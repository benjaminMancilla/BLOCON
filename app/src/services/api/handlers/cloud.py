#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handlers para operaciones cloud."""
from __future__ import annotations

from typing import TYPE_CHECKING
from datetime import datetime, timezone

if TYPE_CHECKING:
    from ..shared import SharedState, PendingCloudOperation
    from http.server import BaseHTTPRequestHandler

from .base import BaseHandler
from ..coordinators import CloudCoordinator
from ..shared import PerfLogger, PendingCloudOperation
from src.model.graph.graph import ReliabilityGraph


class CloudHandler(BaseHandler):
    """
    Handler para operaciones cloud.
    
    Rutas manejadas:
    - POST /cloud/load - Cargar estado desde cloud
    - POST /cloud/save - Guardar cambios locales a cloud
    - POST /cloud/retry - Reintentar operación pendiente
    - POST /cloud/cancel - Cancelar operación pendiente
    """
    
    def __init__(self, shared: SharedState, request_handler: BaseHTTPRequestHandler):
        super().__init__(shared, request_handler)
        self.coordinator = CloudCoordinator(shared)
    
    # ========== Cloud Load ==========
    
    def handle_cloud_load(self) -> None:
        """POST /cloud/load - Sincroniza estado desde SharePoint."""
        perf = PerfLogger("cloud-load")

        def _refresh() -> None:
            with perf.stage("refresh_cloud_state"):
                self.coordinator.refresh_cloud_state(perf)

        if not self._run_cloud_op("cloud-load", _refresh, payload={}):
            return
        
        perf.log()
        self._send_json(200, {"status": "ok"})
    
    # ========== Cloud Save ==========
    
    def handle_cloud_save(self) -> None:
        """POST /cloud/save - Guarda cambios locales a SharePoint."""
        perf = PerfLogger("cloud-save")
        
        with perf.stage("prepare_payload"):
            try:
                payload, graph = self.coordinator.prepare_save_payload(perf=perf)
            except ValueError as exc:
                self._send_json(
                    500,
                    {
                        "status": "error",
                        "error": {
                            "kind": "internal",
                            "message": str(exc),
                        },
                    },
                )
                return
        
        snapshot = payload.get("snapshot") or {}
        appended = 0

        def _commit() -> None:
            nonlocal appended
            appended = self.coordinator.execute_save_commit(payload, perf=perf)

        if not self._run_cloud_op("cloud-save", _commit, payload=payload):
            return
        
        with perf.stage("finalize_cloud_save"):
            self.coordinator.finalize_save(snapshot, graph, perf=perf)
        
        perf.log(
            snapshot_bytes=self._json_size(snapshot),
            local_events=len(payload.get("local_events") or []),
            events_uploaded=appended,
        )
        self._send_json(200, {"status": "ok", "events_uploaded": appended})
    
    # ========== Cloud Retry ==========
    
    def handle_cloud_retry(self) -> None:
        """POST /cloud/retry - Reintenta operación cloud pendiente."""
        pending = self.shared.pending_cloud_op
        if not pending:
            self._send_json(400, {"error": "no pending cloud operation"})
            return

        operation = pending.operation
        payload = pending.payload or {}

        if operation == "cloud-load":
            if not self._run_cloud_op(
                "cloud-load",
                lambda: self.coordinator.refresh_cloud_state(),
                payload=payload,
            ):
                return
            self._send_json(200, {"status": "ok"})
            return

        if operation == "cloud-save":
            raw_events = self._ensure_dict_list(payload.get("local_events"))
            if any(ev.get("version") is None for ev in raw_events):
                self._send_json(
                    500,
                    {
                        "status": "error",
                        "error": {
                            "kind": "internal",
                            "message": "local event version is None in pending payload",
                        },
                    },
                )
                return
            
            appended = 0

            def _commit() -> None:
                nonlocal appended
                appended = self.coordinator.execute_save_commit(payload)

            if not self._run_cloud_op("cloud-save", _commit, payload=payload):
                return
            
            snapshot = payload.get("snapshot") or {}
            graph = ReliabilityGraph.from_data(snapshot or {})
            self.coordinator.finalize_save(snapshot, graph)
            self._send_json(200, {"status": "ok", "events_uploaded": appended})
            return

        if operation == "rebuild":
            if not self._run_cloud_op(
                "rebuild",
                lambda: self._run_rebuild_from_payload(payload),
                payload=payload,
            ):
                return
            self._send_json(200, {"status": "ok"})
            return

        if operation == "search-components":
            result: tuple[list, int] | None = None

            def _search() -> None:
                nonlocal result
                result = self.shared.cloud.search_components(
                    payload.get("query", ""),
                    page=int(payload.get("page", 1)),
                    page_size=int(payload.get("page_size", 20)),
                    allow_local_fallback=False,
                    operation="search-components",
                )

            if not self._run_cloud_op(
                "search-components",
                _search,
                payload=payload,
            ):
                return
            
            items, total = result if result is not None else ([], 0)
            self._send_json(200, {"items": items, "total": total})
            return

        self._send_json(400, {"error": "unsupported pending operation"})
    
    # ========== Cloud Cancel ==========
    
    def handle_cloud_cancel(self) -> None:
        """POST /cloud/cancel - Cancela operación cloud pendiente."""
        self.shared.pending_cloud_op = None
        self._send_json(200, {"status": "ok"})
    
    # ========== Utilidades internas ==========
    
    def _run_cloud_op(self, operation: str, fn, *, payload: dict | None = None) -> bool:
        """
        Ejecuta una operación cloud con manejo de errores y retry.
        
        Args:
            operation: Nombre de la operación
            fn: Función a ejecutar
            payload: Payload opcional para retry
            
        Returns:
            True si tuvo éxito, False si falló (ya envió error HTTP)
        """
        try:
            fn()
            self.shared.pending_cloud_op = None
            return True
        except Exception as exc:
            from src.services.remote.errors import normalize_cloud_error
            error = normalize_cloud_error(operation, exc)
            if error.retryable:
                self.shared.pending_cloud_op = PendingCloudOperation(
                    operation=operation,
                    payload=payload or {},
                    timestamp=datetime.now(timezone.utc),
                )
            self._send_cloud_error(operation, exc)
            return False
    
    def _run_rebuild_from_payload(self, payload: dict) -> None:
        """Helper para ejecutar rebuild desde payload en retry."""
        snapshot = payload.get("snapshot") or {}
        events = self._ensure_dict_list(payload.get("events"))
        self.coordinator.execute_rebuild_commit(snapshot, events)