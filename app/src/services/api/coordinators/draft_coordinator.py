#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Coordinador de operaciones de drafts."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..shared import SharedState

from src.model.graph.graph import ReliabilityGraph
from src.model.eventsourcing.events import event_from_dict
from src.services.cache.event_store import EventStore


class DraftCoordinator:
    """
    Coordinador para operaciones de drafts.
    
    Maneja:
    - Crear, cargar, guardar, renombrar, eliminar drafts
    - Captura y aplicación de estado (snapshot + eventos)
    """
    
    def __init__(self, shared: SharedState):
        """
        Inicializa el coordinador de drafts.
        
        Args:
            shared: Estado compartido del servidor
        """
        self.shared = shared
    
    # ========== Operaciones CRUD ==========
    
    def list_drafts(self) -> dict:
        """
        Lista todos los drafts disponibles.
        
        Returns:
            Diccionario con lista y metadata de drafts
        """
        items = self.shared.local.drafts_list()
        max_drafts = self.shared.local.drafts_max()
        draft_count = self.shared.local.drafts_count()
        return {
            "items": items,
            "maxDrafts": max_drafts,
            "draftCount": draft_count,
            "isFull": draft_count >= max_drafts,
        }
    
    def create_draft(self, name: str | None = None) -> dict:
        """
        Crea un draft desde el estado actual del grafo.
        
        Args:
            name: Nombre opcional del draft
            
        Returns:
            Dict con información del draft creado
        """
        snapshot, events, base_version = self.collect_current_state()
        return self.shared.local.drafts_create(
            snapshot=snapshot,
            events=events,
            base_version=base_version,
            name=name if isinstance(name, str) else None,
        )
    
    def load_draft(self, draft_id: str, cloud_head: int) -> dict:
        """
        Carga un draft y retorna su información.
        
        Args:
            draft_id: ID del draft a cargar
            cloud_head: Versión HEAD actual de cloud
            
        Returns:
            Dict con status y datos del draft
        """
        result = self.shared.local.drafts_load(draft_id=draft_id, cloud_head=cloud_head)
        status = result.get("status")
        
        if status == "ok":
            meta = (result.get("draft") or {}).get("meta") or {}
            self.apply_loaded_draft(
                result.get("snapshot") or {},
                result.get("events") or [],
                meta,
            )
        
        return result
    
    def save_draft(self, draft_id: str, name: str | None = None) -> dict:
        """
        Guarda el estado actual en un draft existente.
        
        Args:
            draft_id: ID del draft a actualizar
            name: Nombre opcional (si None, mantiene el actual)
            
        Returns:
            Dict con información del draft guardado
            
        Raises:
            ValueError: Si el draft_id no existe
        """
        snapshot, events, base_version = self.collect_current_state()
        return self.shared.local.drafts_save(
            draft_id=draft_id,
            snapshot=snapshot,
            events=events,
            base_version=base_version,
            name=name if isinstance(name, str) else None,
        )
    
    def rename_draft(self, draft_id: str, name: str) -> dict:
        """
        Renombra un draft existente.
        
        Args:
            draft_id: ID del draft a renombrar
            name: Nuevo nombre
            
        Returns:
            Dict con información del draft renombrado
            
        Raises:
            ValueError: Si el draft_id no existe o name es inválido
        """
        return self.shared.local.drafts_rename(draft_id=draft_id, name=name)
    
    def delete_draft(self, draft_id: str) -> bool:
        """
        Elimina un draft.
        
        Args:
            draft_id: ID del draft a eliminar
            
        Returns:
            True si se eliminó, False si no existía
        """
        return self.shared.local.drafts_delete(draft_id=draft_id)
    
    # ========== Utilidades de estado ==========
    
    def collect_current_state(self) -> tuple[dict, list, int]:
        """
        Captura el estado actual del grafo (snapshot + eventos + base_version).
        
        Returns:
            Tupla (snapshot_dict, events_list, base_version_int)
        """
        base_version = self._get_cloud_head_version()
        
        if not self.shared.es.store:
            self.shared.es.set_store(EventStore(self.shared.local))
        
        try:
            if self.shared.es.store:
                self.shared.es.store.resequence_versions(base_version)
        except Exception:
            pass

        snapshot = self.shared.es.graph.to_data()
        events: list = []
        try:
            events = [
                ev.to_dict()
                for ev in (
                    self.shared.es.store.active() if self.shared.es.store else []
                )
            ]
        except Exception:
            events = []
        
        return snapshot, events, base_version
    
    def apply_loaded_draft(self, snapshot: dict, events: list, meta: dict) -> None:
        """
        Aplica un draft cargado al estado actual.
        
        Args:
            snapshot: Snapshot del draft
            events: Eventos del draft
            meta: Metadata del draft (incluye base_version)
        """
        self.shared.es.graph = ReliabilityGraph.from_data(snapshot or {})
        self.shared.cloud_baseline = self.shared.es.graph.to_data()
        
        if not self.shared.es.store:
            self.shared.es.set_store(EventStore(self.shared.local))

        evs = []
        try:
            for d in (events or []):
                try:
                    evs.append(event_from_dict(d))
                except Exception:
                    pass
        except Exception:
            evs = []

        bv = None
        try:
            bv = meta.get("base_version", None) if isinstance(meta, dict) else None
        except Exception:
            bv = None
        
        if bv is None:
            try:
                bv = self._get_cloud_head_version()
            except Exception:
                bv = 0

        try:
            base_version = int(bv)
        except Exception:
            base_version = 0

        for idx, ev in enumerate(evs):
            try:
                ev.version = base_version + idx + 1
            except Exception:
                pass

        try:
            if self.shared.es.store:
                self.shared.es.store.replace(evs)
        except Exception:
            try:
                if self.shared.es.store:
                    self.shared.es.store.clear()
                    for ev in evs:
                        self.shared.es.store.append(ev)
            except Exception:
                pass

        try:
            if self.shared.es.store:
                self.shared.es.store.base_version = base_version
                self.shared.es.store.resequence_versions(base_version)
        except Exception:
            pass

    def _get_cloud_head_version(self) -> int:
        """Obtiene versión HEAD de cloud."""
        try:
            return len(self.shared.cloud.load_events())
        except Exception:
            return 0