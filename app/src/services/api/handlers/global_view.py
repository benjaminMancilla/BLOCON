#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handlers para operaciones de vista global."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..shared import SharedState, PendingCloudOperation
    from http.server import BaseHTTPRequestHandler

from .base import BaseHandler
from ..coordinators import GlobalViewCoordinator
from ..shared import PendingCloudOperation


class GlobalViewHandler(BaseHandler):
    """
    Handler para operaciones de vista global.

    Rutas manejadas:
    - GET /views/global - Obtener vista global
    - POST /views/global - Guardar vista global
    - DELETE /views/global - Eliminar vista global
    - POST /views/global/reload - Recargar vista global desde SharePoint
    """

    def __init__(self, shared: SharedState, request_handler: BaseHTTPRequestHandler):
        super().__init__(shared, request_handler)
        self.coordinator = GlobalViewCoordinator(shared)

    def handle_global_view_get(self) -> None:
        result: dict | None = None

        def _load() -> None:
            nonlocal result
            result = self.coordinator.load_global_view()

        if not self._run_cloud_op("global-view-load", _load, payload={}):
            return

        self._send_json(
            200,
            {
                "status": "ok",
                "globalView": self._format_global_view(result),
            },
        )

    def handle_global_view_save(self, payload: dict | None) -> None:
        if payload is None or not isinstance(payload, dict):
            self._send_json(400, {"error": "invalid payload"})
            return
        view = payload.get("view")
        if not isinstance(view, dict):
            self._send_json(400, {"error": "invalid view payload"})
            return

        def _save() -> None:
            self.coordinator.save_global_view(view)

        if not self._run_cloud_op("global-view-save", _save, payload={"view": view}):
            return

        self._send_json(200, {"status": "ok"})

    def handle_global_view_delete(self) -> None:
        deleted = False

        def _delete() -> None:
            nonlocal deleted
            deleted = self.coordinator.delete_global_view()

        if not self._run_cloud_op("global-view-delete", _delete, payload={}):
            return

        self._send_json(200, {"status": "ok", "deleted": deleted})

    def handle_global_view_reload(self) -> None:
        result: dict | None = None

        def _reload() -> None:
            nonlocal result
            result = self.coordinator.reload_global_view()

        if not self._run_cloud_op("global-view-reload", _reload, payload={}):
            return

        self._send_json(
            200,
            {
                "status": "ok",
                "globalView": self._format_global_view(result),
            },
        )

    def _run_cloud_op(self, operation: str, fn, *, payload: dict | None = None) -> bool:
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

    @staticmethod
    def _format_global_view(view: dict | None) -> dict:
        if isinstance(view, dict):
            return {"exists": True, "view": view}
        return {"exists": False, "view": None}