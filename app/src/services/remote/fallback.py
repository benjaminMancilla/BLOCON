from __future__ import annotations
import logging
from typing import TypeVar, Callable, Any
from .errors import normalize_cloud_error

LOG = logging.getLogger(__name__)
T = TypeVar("T")


def try_cloud_with_fallback(
    operation: str,
    cloud_fn: Callable[[], T],
    local_fn: Callable[[], T],
    *,
    allow_fallback: bool = True,
    update_local: Callable[[T], None] | None = None,
) -> T:
    """
    Ejecuta operación en cloud, con fallback a local si falla.
    
    Args:
        operation: Nombre de la operación (para errores)
        cloud_fn: Función que ejecuta la operación en SharePoint
        local_fn: Función que ejecuta la operación localmente
        allow_fallback: Si permite fallback a local en caso de error
        update_local: Opcional, función para actualizar cache local con resultado cloud
    
    Returns:
        Resultado de cloud_fn o local_fn
    
    Raises:
        Excepción normalizada si falla y allow_fallback=False
    """
    try:
        result = cloud_fn()
        if update_local is not None:
            try:
                update_local(result)
            except Exception as cache_exc:
                LOG.warning("Failed to update local cache: %s", cache_exc)
        return result
    except Exception as exc:
        if not allow_fallback:
            raise normalize_cloud_error(operation, exc) from exc
        LOG.debug("Cloud operation %s failed, using local fallback", operation)
        return local_fn()


def require_cloud_client(client, operation: str):
    """Valida que el cliente cloud esté disponible."""
    if client is None:
        raise normalize_cloud_error(
            operation,
            RuntimeError(f"SharePoint client not configured for {operation}")
        )