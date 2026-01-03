#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handlers para operaciones de vistas guardadas."""
from __future__ import annotations

from typing import TYPE_CHECKING
from urllib.parse import unquote

if TYPE_CHECKING:
    from ..shared import SharedState
    from http.server import BaseHTTPRequestHandler

from .base import BaseHandler
from ..coordinators import ViewCoordinator


class ViewsHandler(BaseHandler):
    """
    Handler para operaciones de vistas guardadas.

    Rutas manejadas:
    - GET /views - Listar vistas
    - POST /views - Crear vista
    - POST /views/{view_id}/load - Cargar vista
    - POST /views/{view_id}/save - Guardar vista
    - POST /views/{view_id}/rename - Renombrar vista
    - DELETE /views/{view_id} - Eliminar vista
    """

    def __init__(self, shared: SharedState, request_handler: BaseHTTPRequestHandler):
        super().__init__(shared, request_handler)
        self.coordinator = ViewCoordinator(shared)

    # ========== Handlers GET ==========

    def handle_list_views(self) -> None:
        views = self.coordinator.list_views()
        self._send_json(200, {"views": views})

    # ========== Handlers POST ==========

    def handle_create_view(self, payload: dict | None) -> None:
        name = None
        if isinstance(payload, dict):
            name = payload.get("name")
        result = self.coordinator.create_view(name)
        self._send_json(200, {"status": "ok", "view": result})

    def handle_load_view(self, view_id: str) -> None:
        view_id = unquote(view_id).strip()
        if not view_id:
            self._send_json(404, {"error": "missing view id"})
            return
        result = self.coordinator.load_view(view_id)
        status = result.get("status")
        if status == "ok":
            self._send_json(200, {"status": "ok", "view": result.get("view")})
            return
        self._send_json(200, {"status": status})

    def handle_save_view(self, view_id: str, payload: dict | None) -> None:
        view_id = unquote(view_id).strip()
        if not view_id:
            self._send_json(404, {"error": "missing view id"})
            return
        name = None
        if isinstance(payload, dict):
            name = payload.get("name")
        try:
            result = self.coordinator.save_view(view_id, name=name)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        self._send_json(200, {"status": "ok", "view": result})

    def handle_rename_view(self, view_id: str, payload: dict | None) -> None:
        view_id = unquote(view_id).strip()
        if not view_id:
            self._send_json(404, {"error": "missing view id"})
            return
        if payload is None or not isinstance(payload, dict):
            self._send_json(400, {"error": "invalid payload"})
            return
        name = payload.get("name")
        if not isinstance(name, str) or not name.strip():
            self._send_json(400, {"error": "invalid name"})
            return
        try:
            result = self.coordinator.rename_view(view_id, name=name)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        self._send_json(200, {"status": "ok", "view": result})

    # ========== Handlers DELETE ==========

    def handle_delete_view(self, view_id: str) -> None:
        view_id = unquote(view_id).strip()
        if not view_id:
            self._send_json(404, {"error": "missing view id"})
            return
        deleted = self.coordinator.delete_view(view_id)
        self._send_json(200, {"status": "ok", "deleted": deleted})