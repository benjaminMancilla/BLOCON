#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handler base con utilidades HTTP comunes."""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..shared import SharedState

from src.services.remote.errors import normalize_cloud_error


class BaseHandler:
    """
    Clase base para todos los handlers HTTP.
    
    Proporciona utilidades comunes para:
    - Enviar respuestas JSON
    - Leer bodies JSON
    - Manejar CORS
    - Manejar errores de cloud
    - Validaciones comunes
    """
    
    def __init__(self, shared: SharedState, request_handler: BaseHTTPRequestHandler):
        """
        Inicializa el handler base.
        
        Args:
            shared: Estado compartido del servidor
            request_handler: Instancia de BaseHTTPRequestHandler para I/O HTTP
        """
        self.shared = shared
        self.request_handler = request_handler
    
    # ========== Utilidades de respuesta HTTP ==========
    
    def _send_cors_headers(self) -> None:
        """Envía headers CORS para permitir requests desde cualquier origen."""
        self.request_handler.send_header("Access-Control-Allow-Origin", "*")
        self.request_handler.send_header(
            "Access-Control-Allow-Methods",
            "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        )
        self.request_handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    
    def _send_json(self, status_code: int, payload: dict) -> None:
        """
        Envía una respuesta JSON con headers apropiados.
        
        Args:
            status_code: Código de estado HTTP (200, 400, 500, etc.)
            payload: Diccionario a serializar como JSON
        """
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.request_handler.send_response(status_code)
        self._send_cors_headers()
        self.request_handler.send_header("Content-Type", "application/json; charset=utf-8")
        self.request_handler.send_header("Content-Length", str(len(data)))
        self.request_handler.send_header("Connection", "keep-alive")
        self.request_handler.end_headers()
        try:
            self.request_handler.wfile.write(data)
            self.request_handler.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError) as exc:
            self.request_handler.log_message("Client disconnected before response was sent: %s", exc)
    
    # ========== Utilidades de request HTTP ==========
    
    def _read_json_body(self) -> dict | None:
        """
        Lee y parsea el body JSON del request.
        
        Returns:
            Diccionario parseado o None si no hay body o hay error de parsing
        """
        try:
            length = int(self.request_handler.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            return None
        raw = self.request_handler.rfile.read(length)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None
    
    # ========== Manejo de errores cloud ==========
    
    def _send_cloud_error(self, operation: str, exc: Exception) -> None:
        """
        Normaliza y envía un error de operación cloud.
        
        Args:
            operation: Nombre de la operación que falló (ej: "cloud-save")
            exc: Excepción capturada
        """
        error = normalize_cloud_error(operation, exc)
        status = error.http_status or (503 if error.retryable else 400)
        has_pending = self.shared.pending_cloud_op is not None
        self._send_json(
            status,
            {
                "status": "error",
                "error": {
                    "kind": "cloud",
                    "operation": error.operation,
                    "retryable": error.retryable,
                    "has_pending_operation": has_pending,
                    "message": error.message,
                    "details": error.details,
                },
            },
        )
    
    # ========== Utilidades de datos ==========
    
    @staticmethod
    def _json_size(payload: object) -> int:
        """
        Calcula el tamaño en bytes de un payload JSON.
        
        Args:
            payload: Objeto a serializar
            
        Returns:
            Tamaño en bytes, 0 si hay error
        """
        try:
            return len(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
        except Exception:
            return 0
    
    @staticmethod
    def _ensure_dict_list(items: object) -> list[dict]:
        """
        Valida y convierte un objeto a lista de diccionarios.
        
        Args:
            items: Objeto a validar (esperado: lista de dicts)
            
        Returns:
            Lista de diccionarios válidos (vacía si input inválido)
        """
        if not isinstance(items, list):
            return []
        result = []
        for item in items:
            if isinstance(item, dict):
                result.append(dict(item))
        return result