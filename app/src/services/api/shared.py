#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Estado compartido y utilidades para el API server."""
from __future__ import annotations

import json
import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.model.eventsourcing.service import GraphES
    from src.services.cache.local_store import LocalWorkspaceStore
    from src.services.remote.client import CloudClient


@dataclass
class PendingCloudOperation:
    """Representa una operación cloud pendiente de reintentar."""
    operation: str
    payload: dict
    timestamp: datetime


@dataclass
class SharedState:
    """Estado compartido entre todas las instancias HTTP del servidor."""
    es: GraphES
    local: LocalWorkspaceStore
    cloud: CloudClient
    base_dir: str
    cloud_baseline: dict | None = None
    pending_cloud_op: PendingCloudOperation | None = None


class PerfLogger:
    """Logger de performance para medir tiempos de operaciones."""
    
    def __init__(self, op_name: str) -> None:
        self.op_name = op_name
        self.start = time.perf_counter()
        self.stages: list[dict] = []

    @contextmanager
    def stage(self, name: str, **meta: object):
        """Context manager para medir una etapa de la operación."""
        start = time.perf_counter()
        try:
            yield
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            entry = {
                "stage": name,
                "duration_ms": round(duration_ms, 2),
            }
            if meta:
                entry.update(meta)
            self.stages.append(entry)

    def log(self, **meta: object) -> None:
        """Imprime el log completo de performance."""
        total_ms = (time.perf_counter() - self.start) * 1000
        payload = {
            "op": self.op_name,
            "total_ms": round(total_ms, 2),
            "stages": self.stages,
        }
        if meta:
            payload.update(meta)
        print(f"[perf] {json.dumps(payload, ensure_ascii=False)}", file=sys.stderr)
        sys.stderr.flush()