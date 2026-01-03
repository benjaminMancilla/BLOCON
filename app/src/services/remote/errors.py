from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .graph_session import GraphError, RequestException


CLOUD_ERROR_MESSAGES = {
    "cloud-load": "No se pudo cargar desde la nube.",
    "cloud-save": "No se pudo guardar en la nube.",
    "rebuild": "No se pudo reconstruir el historial en la nube.",
    "search-components": "No se pudo buscar componentes en la nube.",
    "event-history": "No se pudo obtener el historial de eventos de la nube.",
    "evaluate": "No se pudo evaluar la confiabilidad.",
}


@dataclass
class CloudOperationError(RuntimeError):
    operation: str
    retryable: bool
    message: str
    details: Optional[str] = None
    cause: Optional[Exception] = None
    http_status: Optional[int] = None

    def __str__(self) -> str:
        return f"{self.operation}: {self.message}"


def _is_conflict_error(exc: Exception) -> bool:
    if isinstance(exc, GraphError):
        return exc.status_code == 409
    return False


def _is_retryable_cloud_exception(exc: Exception) -> bool:
    if isinstance(exc, CloudOperationError):
        return exc.retryable
    if isinstance(exc, GraphError):
        if exc.status_code in (408, 429):
            return True
        if exc.status_code >= 500:
            return True
        return False
    if isinstance(exc, RequestException):
        return True
    if isinstance(exc, TimeoutError):
        return True
    return False


def normalize_cloud_error(operation: str, exc: Exception) -> CloudOperationError:
    if isinstance(exc, CloudOperationError):
        return exc
    retryable = _is_retryable_cloud_exception(exc)
    http_status = 503 if retryable else 400
    if _is_conflict_error(exc):
        http_status = 409
    message = CLOUD_ERROR_MESSAGES.get(
        operation, "No se pudo completar la operación en la nube."
    )
    details = str(exc) if exc else None
    return CloudOperationError(
        operation=operation,
        retryable=retryable,
        message=message,
        details=details,
        cause=exc,
        http_status=http_status,
    )