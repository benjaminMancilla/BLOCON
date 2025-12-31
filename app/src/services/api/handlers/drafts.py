#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handlers para operaciones de drafts."""
from __future__ import annotations

from typing import TYPE_CHECKING
from urllib.parse import unquote

if TYPE_CHECKING:
    from ..shared import SharedState
    from http.server import BaseHTTPRequestHandler

from .base import BaseHandler
from ..coordinators import DraftCoordinator, CloudCoordinator


class DraftHandler(BaseHandler):
    """
    Handler para operaciones de drafts.
    
    Rutas manejadas:
    - GET /drafts - Listar drafts
    - POST /drafts - Crear draft
    - POST /drafts/{draft_id}/load - Cargar draft
    - PUT /drafts/{draft_id} - Guardar draft
    - PATCH /drafts/{draft_id} - Renombrar draft
    - DELETE /drafts/{draft_id} - Eliminar draft
    """
    
    def __init__(self, shared: SharedState, request_handler: BaseHTTPRequestHandler):
        super().__init__(shared, request_handler)
        self.coordinator = DraftCoordinator(shared)
        self.cloud_coordinator = CloudCoordinator(shared)
    
    # ========== Handlers GET ==========
    
    def handle_list_drafts(self) -> None:
        """GET /drafts - Retorna lista de drafts."""
        drafts = self.coordinator.list_drafts()
        self._send_json(200, {"drafts": drafts})
    
    # ========== Handlers POST ==========
    
    def handle_create_draft(self, payload: dict | None) -> None:
        """
        POST /drafts - Crea un nuevo draft.
        
        Args:
            payload: Payload JSON con nombre opcional
        """
        name = None
        if isinstance(payload, dict):
            name = payload.get("name")
        
        result = self.coordinator.create_draft(name)
        self._send_json(200, {"status": "ok", "draft": result})
    
    def handle_load_draft(self, draft_id: str) -> None:
        """
        POST /drafts/{draft_id}/load - Carga un draft existente.
        
        Args:
            draft_id: ID del draft a cargar
        """
        draft_id = unquote(draft_id).strip()
        if not draft_id:
            self._send_json(404, {"error": "missing draft id"})
            return
        
        cloud_head = self.cloud_coordinator.get_head_version()
        result = self.coordinator.load_draft(draft_id, cloud_head=cloud_head)
        status = result.get("status")
        
        if status == "ok":
            self._send_json(200, {"status": "ok", "draft": result.get("draft")})
            return
        
        self._send_json(
            200,
            {
                "status": status,
                "deleted": result.get("deleted", False),
            },
        )
    
    # ========== Handlers PUT ==========
    
    def handle_save_draft(self, draft_id: str, payload: dict | None) -> None:
        """
        PUT /drafts/{draft_id} - Guarda estado actual en un draft existente.
        
        Args:
            draft_id: ID del draft a guardar
            payload: Payload JSON con nombre opcional
        """
        draft_id = unquote(draft_id).strip()
        if not draft_id:
            self._send_json(404, {"error": "missing draft id"})
            return
        
        name = None
        if isinstance(payload, dict):
            name = payload.get("name")
        
        try:
            result = self.coordinator.save_draft(draft_id, name=name)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        
        self._send_json(200, {"status": "ok", "draft": result})
    
    # ========== Handlers PATCH ==========
    
    def handle_rename_draft(self, draft_id: str, payload: dict | None) -> None:
        """
        PATCH /drafts/{draft_id} - Renombra un draft existente.
        
        Args:
            draft_id: ID del draft a renombrar
            payload: Payload JSON con nuevo nombre
        """
        draft_id = unquote(draft_id).strip()
        if not draft_id:
            self._send_json(404, {"error": "missing draft id"})
            return
        
        if payload is None or not isinstance(payload, dict):
            self._send_json(400, {"error": "invalid payload"})
            return
        
        name = payload.get("name")
        if not isinstance(name, str) or not name.strip():
            self._send_json(400, {"error": "invalid name"})
            return
        
        try:
            result = self.coordinator.rename_draft(draft_id, name=name)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return
        
        self._send_json(200, {"status": "ok", "draft": result})
    
    # ========== Handlers DELETE ==========
    
    def handle_delete_draft(self, draft_id: str) -> None:
        """
        DELETE /drafts/{draft_id} - Elimina un draft.
        
        Args:
            draft_id: ID del draft a eliminar
        """
        draft_id = unquote(draft_id).strip()
        if not draft_id:
            self._send_json(404, {"error": "missing draft id"})
            return
        
        deleted = self.coordinator.delete_draft(draft_id)
        self._send_json(200, {"status": "ok", "deleted": deleted})