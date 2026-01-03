#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handler para recargar fallas."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from http.server import BaseHTTPRequestHandler
    from ..shared import SharedState

from .base import BaseHandler
from ..coordinators.evaluation_coordinator import EvaluationCoordinator
from ..shared import PendingCloudOperation
from src.services.remote.errors import normalize_cloud_error


class FailuresHandler(BaseHandler):
    """
    Handler para recargar fallas.

    Ruta manejada:
    - POST /failures/reload - Recarga fallas en cache local desde la nube
    """

    def __init__(self, shared: SharedState, request_handler: BaseHTTPRequestHandler):
        super().__init__(shared, request_handler)
        self.coordinator = EvaluationCoordinator(shared)

    def handle_reload_failures(self) -> None:
        """POST /failures/reload - Recarga fallas en cache local."""
        if not self._run_cloud_op("failures-reload", self.coordinator.reload_failures):
            return

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