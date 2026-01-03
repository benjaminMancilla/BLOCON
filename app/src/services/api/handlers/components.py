#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handlers para búsqueda de componentes."""
from __future__ import annotations

from typing import TYPE_CHECKING
from datetime import datetime, timezone

if TYPE_CHECKING:
    from ..shared import SharedState
    from http.server import BaseHTTPRequestHandler

from .base import BaseHandler
from ..shared import PendingCloudOperation


class ComponentSearchHandler(BaseHandler):
    """
    Handler para búsqueda de componentes remotos.
    
    Rutas manejadas:
    - GET /remote/components/search
    """
    
    def __init__(self, shared: SharedState, request_handler: BaseHTTPRequestHandler):
        super().__init__(shared, request_handler)
    
    # ========== Handlers GET ==========
    
    def handle_search_components(self, params: dict[str, list[str]]) -> None:
        """
        GET /remote/components/search - Busca componentes remotos.
        
        Args:
            params: Query params con query, page, page_size
        """
        query = (params.get("query") or [""])[0]
        try:
            page = int((params.get("page") or ["1"])[0])
        except ValueError:
            page = 1
        try:
            page_size = int((params.get("page_size") or ["20"])[0])
        except ValueError:
            page_size = 20
        
        result: tuple[list, int] | None = None

        def _search() -> None:
            nonlocal result
            result = self.shared.cloud.search_components(
                query,
                page=page,
                page_size=page_size,
                allow_local_fallback=False,
                operation="search-components",
            )

        if not self._run_cloud_op(
            "search-components",
            _search,
            payload={"query": query, "page": page, "page_size": page_size},
        ):
            return
        
        items, total = result if result is not None else ([], 0)
        self._send_json(200, {"items": items, "total": total})
    
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