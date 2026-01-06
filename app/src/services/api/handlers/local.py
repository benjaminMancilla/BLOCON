#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handlers para estado local (dirty/local events)."""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from http.server import BaseHTTPRequestHandler
    from ..shared import SharedState

from .base import BaseHandler


class LocalHandler(BaseHandler):
    """Handler para estado local."""

    def __init__(self, shared: SharedState, request_handler: BaseHTTPRequestHandler):
        super().__init__(shared, request_handler)

    def handle_local_dirty(self) -> None:
        try:
            count = self.shared.local.local_events_count()
        except Exception as exc:
            self._send_json(500, {"error": str(exc)})
            return

        self._send_json(
            200,
            {
                "dirty": count > 0,
                "local_events_count": count,
            },
        )