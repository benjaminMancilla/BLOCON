from __future__ import annotations

from typing import Optional

from src.services.evaluation import EvaluationService
from ..shared import SharedState


class EvaluationCoordinator:
    """Coordina la evaluación del grafo reutilizando el servicio existente."""

    def __init__(self, shared: SharedState) -> None:
        self.shared = shared
        self._service: Optional[EvaluationService] = None

    def _ensure_service(self) -> EvaluationService:
        if self._service is None:
            self._service = EvaluationService.from_env(
                es=self.shared.es,
                failures_cache=self.shared.local.failures_cache,
                project_root=self.shared.base_dir,
            )
        return self._service

    def ensure_failures(self) -> dict:
        return self._ensure_service().ensure_failures()

    def reload_failures(self) -> dict:
        return self._ensure_service().reload_failures()

    def evaluate_graph(self) -> float:
        return self._ensure_service().evaluate()