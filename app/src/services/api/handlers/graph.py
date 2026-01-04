#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handlers para operaciones del grafo."""
from __future__ import annotations

import sys
from typing import TYPE_CHECKING
from urllib.parse import unquote

if TYPE_CHECKING:
    from ..shared import SharedState
    from http.server import BaseHTTPRequestHandler

from .base import BaseHandler
from ..coordinators import GraphCoordinator
from ..coordinators.graph_coordinator import NodeEditValidationError


class GraphHandler(BaseHandler):
    """
    Handler para operaciones del grafo.
    
    Rutas manejadas:
    - GET /graph - Obtener grafo completo
    - GET /graph/{node_id} - Obtener nodo específico
    - POST /graph/organization - Insertar componente
    - POST /graph/undo - Deshacer
    - POST /graph/redo - Rehacer
    - DELETE /graph/node/{node_id} - Eliminar nodo
    - GET /diagram-view - Obtener vista del diagrama
    - PUT /diagram-view - Actualizar vista del diagrama
    """
    
    def __init__(self, shared: SharedState, request_handler: BaseHTTPRequestHandler):
        super().__init__(shared, request_handler)
        self.coordinator = GraphCoordinator(shared)
    
    # ========== Handlers GET ==========
    
    def handle_get_graph(self) -> None:
        """GET /graph - Retorna el grafo completo serializado."""
        graph_data = self.coordinator.serialize_full_graph()
        self._send_json(200, graph_data)
    
    def handle_get_node(self, node_id: str) -> None:
        """
        GET /graph/{node_id} - Retorna un nodo específico.
        
        Args:
            node_id: ID del nodo a obtener
        """
        node_id = unquote(node_id).strip()
        if not node_id:
            self._send_json(404, {"error": "missing node id"})
            return
        
        node_data = self.coordinator.serialize_node(node_id)
        if node_data is None:
            self._send_json(404, {"error": f"node '{node_id}' not found"})
            return
        
        self._send_json(200, node_data)
    
    def handle_diagram_view_get(self) -> None:
        """GET /diagram-view - Retorna la vista del diagrama."""
        diagram_view = self.shared.local.load_diagram_view()
        self._send_json(200, diagram_view)
    
    # ========== Handlers POST ==========
    
    def handle_undo(self) -> None:
        """POST /graph/undo - Deshace la última operación."""
        if self.coordinator.undo():
            self._send_json(200, {"status": "ok"})
        else:
            self._send_json(200, {"status": "noop"})
    
    def handle_redo(self) -> None:
        """POST /graph/redo - Rehace la última operación deshecha."""
        if self.coordinator.redo():
            self._send_json(200, {"status": "ok"})
        else:
            self._send_json(200, {"status": "noop"})
    
    def handle_organization_insert(self, payload: dict | None) -> None:
        """
        POST /graph/organization - Inserta un componente en el grafo.
        
        Args:
            payload: Payload JSON con datos del componente
        """
        print(f"[INSERT] Received organization insert request", file=sys.stderr)
        sys.stderr.flush()
        
        if payload is None or not isinstance(payload, dict):
            self._send_json(400, {"error": "invalid payload"})
            return

        insert = payload.get("insert")
        if not isinstance(insert, dict):
            self._send_json(400, {"error": "missing insert payload"})
            return

        component_id = insert.get("componentId")
        calculation_type = insert.get("calculationType")
        if not component_id or not calculation_type:
            self._send_json(400, {"error": "missing componentId or calculationType"})
            return

        # Extraer target info
        target = insert.get("target")
        target_id = None
        host_type = None
        relation_type = None
        if target is not None:
            if not isinstance(target, dict):
                self._send_json(400, {"error": "invalid target payload"})
                return
            target_id = target.get("hostId")
            host_type = target.get("hostType")
            relation_type = self._normalize_relation_type(target.get("relationType"))
            if host_type is not None:
                host_type = str(host_type).lower()

        # Extraer position info
        position = insert.get("position") or {}
        if position is not None and not isinstance(position, dict):
            self._send_json(400, {"error": "invalid position payload"})
            return

        position_index = position.get("index") if isinstance(position, dict) else None
        if position_index is not None:
            try:
                position_index = int(position_index)
            except (TypeError, ValueError):
                self._send_json(400, {"error": "invalid position index"})
                return
            position_index -= 1

        position_reference_id = position.get("referenceId") if isinstance(position, dict) else None
        
        # Extraer reorder info
        children_order = None
        reorder = payload.get("reorder")
        if isinstance(reorder, list) and reorder:
            ordered = []
            for entry in reorder:
                if not isinstance(entry, dict):
                    continue
                entry_id = entry.get("id")
                if not entry_id:
                    continue
                position = entry.get("position")
                if position is not None:
                    try:
                        position = int(position)
                    except (TypeError, ValueError):
                        position = None
                ordered.append((position, entry_id))
            if ordered:
                ordered.sort(key=lambda item: (item[0] is None, item[0]))
                children_order = [entry_id for _, entry_id in ordered]

        # Extraer k value
        k_value = insert.get("k")
        if k_value is not None:
            try:
                k_value = int(k_value)
            except (TypeError, ValueError):
                self._send_json(400, {"error": "invalid k value"})
                return

        unit_type = insert.get("unitType")

        # Ejecutar operación
        try:
            print(f"[INSERT] Calling add_component_organization for {component_id}", file=sys.stderr)
            sys.stderr.flush()
            
            self.coordinator.add_component_organization(
                new_comp_id=component_id,
                calculation_type=calculation_type,
                target_id=target_id,
                host_type=host_type,
                relation_type=relation_type,
                position_index=position_index,
                position_reference_id=position_reference_id,
                children_order=children_order,
                k=k_value,
                unit_type=unit_type,
            )
            
            print(f"[INSERT] Successfully added component", file=sys.stderr)
            sys.stderr.flush()
        except Exception as exc:
            print(f"[INSERT] Error: {str(exc)}", file=sys.stderr)
            self._send_json(400, {"error": str(exc)})
            return

        self._send_json(200, {"status": "ok"})
    
    # ========== Handlers PUT ==========
    
    def handle_diagram_view_put(self, payload: dict | None) -> None:
        """
        PUT /diagram-view - Actualiza la vista del diagrama.
        
        Args:
            payload: Payload JSON con datos de la vista
        """
        if payload is None or not isinstance(payload, dict):
            self._send_json(400, {"error": "invalid payload"})
            return
        
        # Si el payload tiene "insert", delegar a organization_insert
        if "insert" in payload:
            self.handle_organization_insert(payload)
            return
        
        self.shared.local.save_diagram_view(payload)
        diagram_view = self.shared.local.load_diagram_view()
        self._send_json(200, diagram_view)
    
    # ========== Handlers DELETE ==========
    
    def handle_delete_node(self, node_id: str) -> None:
        """
        DELETE /graph/node/{node_id} - Elimina un nodo del grafo.
        
        Args:
            node_id: ID del nodo a eliminar
        """
        node_id = unquote(node_id).strip()
        if not node_id:
            self._send_json(404, {"error": "missing node id"})
            return
        
        try:
            self.coordinator.remove_node(node_id)
        except Exception as exc:
            self._send_json(400, {"error": str(exc)})
            return
        
        self._send_json(200, {"status": "ok"})

    # ========== Handlers PATCH ==========

    def handle_edit_gate(self, node_id: str, payload: dict | None) -> None:
        node_id = unquote(node_id).strip()
        if not node_id:
            self._send_json(404, {"error": "missing node id"})
            return

        if payload is None or not isinstance(payload, dict):
            self._send_validation_error("patch", "Invalid payload")
            return

        patch = payload.get("patch")
        if not isinstance(patch, dict):
            self._send_validation_error("patch", "Patch must be an object")
            return

        try:
            self.coordinator.edit_gate(node_id, patch)
        except NodeEditValidationError as exc:
            self._send_validation_error(exc.field, exc.message, exc.details)
            return
        except KeyError:
            self._send_json(404, {"error": f"node '{node_id}' not found"})
            return
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return

        self._send_json(200, {"status": "ok"})

    def handle_edit_component(self, node_id: str, payload: dict | None) -> None:
        node_id = unquote(node_id).strip()
        if not node_id:
            self._send_json(404, {"error": "missing node id"})
            return

        if payload is None or not isinstance(payload, dict):
            self._send_validation_error("patch", "Invalid payload")
            return

        patch = payload.get("patch")
        if not isinstance(patch, dict):
            self._send_validation_error("patch", "Patch must be an object")
            return

        try:
            self.coordinator.edit_component(node_id, patch)
        except NodeEditValidationError as exc:
            self._send_validation_error(exc.field, exc.message, exc.details)
            return
        except KeyError:
            self._send_json(404, {"error": f"node '{node_id}' not found"})
            return
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
            return

        self._send_json(200, {"status": "ok"})
    
    # ========== Utilidades ==========
    
    @staticmethod
    def _normalize_relation_type(relation_type: str | None) -> str | None:
        """
        Normaliza el tipo de relación a formato estándar.
        
        Args:
            relation_type: Tipo de relación a normalizar
            
        Returns:
            Tipo normalizado o None
        """
        if relation_type is None:
            return None
        if not isinstance(relation_type, str):
            return relation_type
        
        relation_upper = relation_type.upper()
        if relation_upper in ("AND", "OR", "KOON"):
            return relation_upper
        
        relation_lower = relation_type.lower()
        if relation_lower in ("series", "parallel", "koon"):
            return relation_lower
        
        return relation_type

    def _send_validation_error(
        self,
        field: str,
        message: str,
        details: dict | None = None,
    ) -> None:
        self._send_json(
            400,
            {
                "status": "error",
                "error": {
                    "kind": "validation",
                    "field": field,
                    "message": message,
                    "details": details or {},
                },
            },
        )