#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handler para evaluación de confiabilidad."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from http.server import BaseHTTPRequestHandler
    from ..shared import SharedState

from .base import BaseHandler
from ..coordinators.evaluation_coordinator import EvaluationCoordinator
from ..shared import PerfLogger, PendingCloudOperation
from src.services.remote.errors import normalize_cloud_error


class EvaluationHandler(BaseHandler):
    """
    Handler para evaluar confiabilidad.

    Ruta manejada:
    - POST /evaluate - Ejecuta sincronización de fallas y evaluación del grafo
    """

    def __init__(self, shared: SharedState, request_handler: BaseHTTPRequestHandler):
        super().__init__(shared, request_handler)
        self.coordinator = EvaluationCoordinator(shared)

    def handle_evaluate(self) -> None:
        """POST /evaluate - Ejecuta evaluación de confiabilidad."""
        perf = PerfLogger("evaluate")
        info: dict | None = None

        def _sync_failures() -> None:
            nonlocal info
            with perf.stage("failures_sync"):
                info = self.coordinator.ensure_failures()

        if not self._run_cloud_op("evaluate", _sync_failures, payload={}):
            return

        try:
            with perf.stage("graph_evaluate"):
                self.coordinator.evaluate_graph()
        except Exception as exc:
            self._send_json(400, {"error": str(exc)})
            return

        perf.log(
            failures_needed=(info or {}).get("needed"),
            failures_k=(info or {}).get("k"),
        )
        self._send_json(200, {"status": "ok"})

    def _run_cloud_op(self, operation: str, fn, *, payload: dict | None = None) -> bool:
        try:
            fn()
            self.shared.pending_cloud_op = None
            return True
        except Exception as exc:
            error = normalize_cloud_error(operation, exc)
            if error.retryable:
                self.shared.pending_cloud_op = PendingCloudOperation(
                    operation=operation,
                    payload=payload or {},
                    timestamp=datetime.now(timezone.utc),
                )
            self._send_cloud_error(operation, exc)
            return False