from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from src.model.eventsourcing.service import GraphES
from src.services.cache.repositories.failures import FailuresCacheRepo
from src.services.failure import FailuresService


@dataclass
class EvaluationService:
    es: GraphES
    failures: FailuresService
    project_root: Optional[str] = None

    @classmethod
    def from_env(
        cls,
        *,
        es: GraphES,
        failures_cache: FailuresCacheRepo,
        project_root: Optional[str] = None,
    ) -> "EvaluationService":
        failures = FailuresService.from_env(
            local_repo=failures_cache,
            project_root=project_root,
        )
        return cls(es=es, failures=failures, project_root=project_root)

    def _component_ids(self) -> list[str]:
        return sorted(
            [
                node_id
                for node_id, node in self.es.graph.nodes.items()
                if node.is_component()
            ]
        )

    def ensure_failures(self) -> dict:
        return self.failures.ensure_min_records(self._component_ids(), None)
    
    def reload_failures(self) -> dict:
        return self.failures.reload_failures(self._component_ids())

    def evaluate(self) -> float:
        graph = self.es.graph
        graph.project_root = self.project_root
        graph.failures_cache = self.failures.local_repo
        return self.es.evaluate()

    def run(self) -> float:
        self.ensure_failures()
        return self.evaluate()