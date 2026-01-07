#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Coordinador de operaciones de vista global."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..shared import SharedState


class GlobalViewCoordinator:
    """Coordinador para operaciones de vista global en SharePoint."""

    def __init__(self, shared: "SharedState") -> None:
        self.shared = shared

    def load_global_view(self) -> dict | None:
        return self.shared.cloud.load_global_view(
            update_local=True,
            allow_local_fallback=False,
            operation="global-view-load",
        )

    def reload_global_view(self) -> dict | None:
        return self.shared.cloud.reload_global_view()

    def save_global_view(self, view: dict) -> None:
        self.shared.cloud.save_global_view(view, operation="global-view-save")

    def delete_global_view(self) -> bool:
        return self.shared.cloud.delete_global_view(operation="global-view-delete")