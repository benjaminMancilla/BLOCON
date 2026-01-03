#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Coordinador de operaciones de vistas guardadas."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..shared import SharedState


class ViewCoordinator:
    """
    Coordinador para operaciones de vistas guardadas.

    Maneja:
    - Crear, cargar, guardar, renombrar, eliminar vistas
    - Captura y aplicación de estado de vista
    """

    def __init__(self, shared: SharedState):
        self.shared = shared

    def list_views(self) -> list[dict]:
        return self.shared.local.saved_views_list()

    def create_view(self, name: str | None = None) -> dict:
        view = self.shared.local.load_diagram_view()
        return self.shared.local.saved_views_create(
            view=view,
            name=name if isinstance(name, str) else None,
        )

    def save_view(self, view_id: str, name: str | None = None) -> dict:
        view = self.shared.local.load_diagram_view()
        return self.shared.local.saved_views_save(
            view_id=view_id,
            view=view,
            name=name if isinstance(name, str) else None,
        )

    def rename_view(self, view_id: str, name: str) -> dict:
        return self.shared.local.saved_views_rename(view_id=view_id, name=name)

    def delete_view(self, view_id: str) -> bool:
        return self.shared.local.saved_views_delete(view_id=view_id)

    def load_view(self, view_id: str) -> dict:
        result = self.shared.local.saved_views_load(view_id=view_id)
        if result.get("status") == "ok":
            view_data = result.get("data")
            if isinstance(view_data, dict):
                self.shared.local.save_diagram_view(view_data)
        return result