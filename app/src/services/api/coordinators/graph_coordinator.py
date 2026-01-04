#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Coordinador de operaciones del grafo."""
from __future__ import annotations

from typing import TYPE_CHECKING
from datetime import datetime, timezone

if TYPE_CHECKING:
    from ..shared import SharedState

from src.model.graph.graph import ReliabilityGraph
from src.model.graph.dist import Dist
from src.model.eventsourcing.events import SnapshotEvent
from src.services.api.graph_snapshot import serialize_graph, serialize_node


class NodeEditValidationError(ValueError):
    def __init__(self, field: str, message: str, details: dict | None = None):
        super().__init__(message)
        self.field = field
        self.message = message
        self.details = details or {}


class GraphCoordinator:
    """
    Coordinador para operaciones del grafo.
    
    Maneja:
    - Reconstrucción del grafo desde eventos
    - Serialización del grafo y nodos
    - Operaciones CRUD en el grafo
    - Undo/Redo
    """
    
    def __init__(self, shared: SharedState):
        """
        Inicializa el coordinador de grafo.
        
        Args:
            shared: Estado compartido del servidor
        """
        self.shared = shared
    
    # ========== Reconstrucción del grafo ==========
    
    def replay_local(self) -> None:
        """
        Reconstruye el grafo desde baseline + eventos activos.
        
        Usa el baseline almacenado en cloud_baseline como punto de partida
        y aplica todos los eventos activos del store local.
        """
        if not self.shared.es.store:
            print("ERROR: No store available in replay_local")
            return
        
        active_events = []
        try:
            active_events = self.shared.es.store.active()
        except Exception:
            active_events = []
        
        events = active_events
        baseline = self.shared.cloud_baseline
        
        if baseline is not None:
            # Crear evento snapshot artificial desde baseline
            ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            snapshot_event = SnapshotEvent(
                kind="snapshot", actor="api", ts=ts, data=baseline
            )
            events = [snapshot_event] + active_events
        
        try:
            self.shared.es.graph = self.shared.es.rebuild(events)
        except Exception:
            pass
    
    def rebuild_from_events(self, events: list) -> ReliabilityGraph:
        """
        Reconstruye un grafo desde una lista de eventos.
        
        Args:
            events: Lista de eventos a aplicar
            
        Returns:
            Grafo reconstruido
        """
        return self.shared.es.rebuild(events)
    
    # ========== Serialización ==========
    
    def serialize_full_graph(self) -> dict:
        """
        Serializa el grafo completo a diccionario.
        
        Returns:
            Diccionario con toda la información del grafo
        """
        return serialize_graph(self.shared.es.graph)
    
    def serialize_node(self, node_id: str) -> dict | None:
        """
        Serializa un nodo específico a diccionario.
        
        Args:
            node_id: ID del nodo a serializar
            
        Returns:
            Diccionario con información del nodo, o None si no existe
        """
        return serialize_node(self.shared.es.graph, node_id)
    
    # ========== Operaciones del grafo ==========
    
    def add_component_organization(
        self,
        new_comp_id: str,
        calculation_type: str,
        target_id: str | None = None,
        host_type: str | None = None,
        relation_type: str | None = None,
        position_index: int | None = None,
        position_reference_id: str | None = None,
        children_order: list[str] | None = None,
        k: int | None = None,
        unit_type: str | None = None,
    ) -> None:
        """
        Agrega un componente al grafo usando la interfaz de organización.
        
        Args:
            new_comp_id: ID del nuevo componente
            calculation_type: Tipo de cálculo (series, parallel, koon, component)
            target_id: ID del nodo host (opcional si es root)
            host_type: Tipo de host (gate, component)
            relation_type: Tipo de relación (series, parallel, koon)
            position_index: Índice de posición en lista de hijos
            position_reference_id: ID de referencia para posicionamiento
            children_order: Orden explícito de hijos
            k: Valor k para gates koon
            unit_type: Tipo de unidad del componente
        """
        self.shared.es.add_component_organization(
            new_comp_id=new_comp_id,
            calculation_type=calculation_type,
            target_id=target_id,
            host_type=host_type,
            relation_type=relation_type,
            position_index=position_index,
            position_reference_id=position_reference_id,
            children_order=children_order,
            k=k,
            unit_type=unit_type,
        )

    def add_root_component(
        self,
        new_comp_id: str,
        calculation_type: str,
        unit_type: str | None = None,
    ) -> None:
        dist = Dist(kind=calculation_type)
        self.shared.es.add_root_component(
            new_id=new_comp_id,
            dist=dist,
            unit_type=unit_type,
        )
    
    def remove_node(self, node_id: str) -> None:
        """
        Elimina un nodo del grafo.
        
        Args:
            node_id: ID del nodo a eliminar
            
        Raises:
            Exception: Si el nodo no existe o no puede eliminarse
        """
        if node_id not in self.shared.es.graph.nodes:
            raise ValueError(f"Node '{node_id}' not found")
        self.shared.es.remove_node(node_id)

    def edit_gate(self, node_id: str, patch: dict) -> None:
        if node_id not in self.shared.es.graph.nodes:
            raise KeyError(f"Node '{node_id}' not found")

        node = self.shared.es.graph.nodes.get(node_id)
        if node is None or not node.is_gate():
            raise ValueError("Node is not a gate")

        self._normalize_gate_text_patch(node_id, patch, "label", max_length=16)
        self._normalize_gate_text_patch(node_id, patch, "name", max_length=32)

        if "k" in patch:
            if getattr(node, "subtype", None) != "KOON":
                raise NodeEditValidationError(
                    field="k",
                    message="K is only valid for KOON gates",
                    details={"subtype": getattr(node, "subtype", None)},
                )
            k_value = patch.get("k")
            if isinstance(k_value, bool) or not isinstance(k_value, int):
                raise NodeEditValidationError(
                    field="k",
                    message="K must be an integer",
                    details={},
                )
            children_count = len(self.shared.es.graph.children.get(node_id, []))
            if k_value < 1 or k_value > children_count:
                raise NodeEditValidationError(
                    field="k",
                    message=f"K must be between 1 and {children_count}",
                    details={"min": 1, "max": children_count},
                )

        self.shared.es.edit_gate(node_id, patch)

    def _normalize_gate_text_patch(
        self,
        node_id: str,
        patch: dict,
        field: str,
        max_length: int,
    ) -> None:
        if field not in patch:
            return
        value = patch.get(field)
        if value is None or not isinstance(value, str):
            raise NodeEditValidationError(
                field=field,
                message=f"{field.capitalize()} must be a string",
                details={},
            )
        trimmed = value.strip()
        if trimmed == "":
            patch[field] = node_id
            return
        if len(trimmed) > max_length:
            raise NodeEditValidationError(
                field=field,
                message=f"{field.capitalize()} must be at most {max_length} characters",
                details={"max": max_length, "length": len(trimmed)},
            )
        patch[field] = trimmed

    def edit_component(self, node_id: str, patch: dict) -> None:
        if node_id not in self.shared.es.graph.nodes:
            raise KeyError(f"Node '{node_id}' not found")

        node = self.shared.es.graph.nodes.get(node_id)
        if node is None or not node.is_component():
            raise ValueError("Node is not a component")

        if "dist" in patch:
            dist_patch = patch.get("dist")
            if not isinstance(dist_patch, dict):
                raise NodeEditValidationError(
                    field="dist",
                    message="Dist must be an object",
                    details={},
                )
            kind = dist_patch.get("kind")
            if not isinstance(kind, str):
                raise NodeEditValidationError(
                    field="dist.kind",
                    message="Kind must be a string",
                    details={"allowed": ["exponential", "weibull"]},
                )
            normalized_kind = kind.strip().lower()
            if normalized_kind not in ("exponential", "weibull"):
                raise NodeEditValidationError(
                    field="dist.kind",
                    message="Kind must be exponential or weibull",
                    details={"allowed": ["exponential", "weibull"]},
                )
            dist_patch["kind"] = normalized_kind

        self.shared.es.edit_component_patch(node_id, patch)

    # ========== Undo/Redo ==========
    
    def undo(self) -> bool:
        """
        Deshace la última operación.
        
        Returns:
            True si se deshizo algo, False si no había nada que deshacer
        """
        if self.shared.es.store and self.shared.es.store.undo():
            self.replay_local()
            return True
        return False
    
    def redo(self) -> bool:
        """
        Rehace la última operación deshecha.
        
        Returns:
            True si se rehizo algo, False si no había nada que rehacer
        """
        if self.shared.es.store and self.shared.es.store.redo():
            self.replay_local()
            return True
        return False