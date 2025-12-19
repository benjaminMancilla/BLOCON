from __future__ import annotations

from typing import Dict, Iterable, List, Optional, Protocol, runtime_checkable


@runtime_checkable
class FailuresCachePort(Protocol):
    """
    Puerto para acceso al cache de fallas.
    Permite implementar almacenamiento local, remoto o mixto sin acoplar el dominio.
    """

    def load_failures_cache(self, project_root: Optional[str] = None) -> Dict: ...

    def save_failures_cache(self, cache: Dict, project_root: Optional[str] = None) -> None: ...


@runtime_checkable
class FailuresClientPort(Protocol):
    """
    Puerto para consultar fallas por IDs de componentes.
    """

    def fetch_failures_for_components(self, component_ids: Iterable[str]) -> List[Dict]: ...