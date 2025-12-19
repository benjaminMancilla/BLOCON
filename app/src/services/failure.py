from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from .remote.clients import SharePointFailuresClient  # ajusta si tu __init__.py exporta distinto
from .cache.repositories.failures import FailuresCacheRepo  # repo local (AppData)


MIN_INTERVALS_FOR_OPT: int = 2


# ------------------ Normalización ------------------

def _norm_row(row: Dict[str, Any]) -> Tuple[str, str]:
    """
    Normaliza a (YYYY-MM-DD, type).
    Acepta dict remoto: {"failure_date", "type_failure"}.
    """
    date_str = str(row.get("failure_date", "")).strip()
    if len(date_str) >= 10:
        date_str = date_str[:10]
    typ = str(row.get("type_failure", "")).strip()
    return (date_str, typ)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _ensure_cache_shape(cache: Any) -> Dict[str, Any]:
    """
    Normaliza formato de cache a:
      { "items": { cid: { "rows": [...], "last_update": ISO|None }, ... } }
    Soporta compat: items[cid] siendo lista directa.
    """
    if not isinstance(cache, dict):
        cache = {}
    items = cache.get("items", {})
    if not isinstance(items, dict):
        items = {}

    fixed: Dict[str, Any] = {}
    for cid, v in items.items():
        cid = str(cid).strip()
        if not cid:
            continue
        if isinstance(v, dict):
            rows = v.get("rows", [])
            lu = v.get("last_update", None)
            fixed[cid] = {"rows": rows if isinstance(rows, list) else [], "last_update": lu}
        elif isinstance(v, list):
            # formato viejo: lista directa
            fixed[cid] = {"rows": v, "last_update": cache.get("last_update")}
        else:
            fixed[cid] = {"rows": [], "last_update": None}

    return {"items": fixed}


def _group_remote_rows(rows: List[Dict[str, Any]]) -> Dict[str, List[Tuple[str, str]]]:
    out: Dict[str, List[Tuple[str, str]]] = {}
    for r in rows or []:
        cid = str(r.get("Component_ID", "")).strip()
        if not cid:
            continue
        out.setdefault(cid, []).append(_norm_row(r))

    for cid in out:
        out[cid].sort(key=lambda t: t[0])
    return out


# ------------------ Servicio ------------------

@dataclass
class FailuresService:
    """
    Use-case: sincroniza fallas remotas con cache local y expone utilidades
    para asegurar mínimo de registros.

    - Remote: SharePointFailuresClient
    - Local: FailuresCacheRepo
    """
    remote: SharePointFailuresClient
    local_repo: FailuresCacheRepo

    @classmethod
    def from_env(
        cls,
        *,
        local_repo: FailuresCacheRepo,
        project_root: str | None = None,
        dotenv_path: str | None = None,
    ) -> "FailuresService":
        remote = SharePointFailuresClient.from_env(project_root=project_root, dotenv_path=dotenv_path)
        return cls(remote=remote, local_repo=local_repo)

    # ---- API principal ----

    def reload_failures(
        self,
        component_ids: Iterable[str],
        *,
        chunk_size: int = 10,
        top: int = 999,
    ) -> Dict[str, Any]:
        """
        Recarga cache local consultando SharePoint para los component_ids.
        Retorna el cache completo (formato {items:{...}}).
        """
        comp_ids = [str(c).strip() for c in (component_ids or []) if str(c).strip()]
        if not comp_ids:
            # devolvemos cache normalizado sin tocarlo
            return _ensure_cache_shape(self.local_repo.load())

        cache = _ensure_cache_shape(self.local_repo.load())
        items: Dict[str, Any] = cache["items"]

        # 1) fetch remoto (batch)
        rows = self.remote.fetch_failures_for_components(comp_ids, chunk_size=chunk_size, top=top)
        fresh = _group_remote_rows(rows)

        # 2) merge + timestamp
        now = _utc_now_iso()
        req_set = set(comp_ids)

        for cid in req_set:
            if cid in fresh:
                items[cid] = {"rows": fresh[cid], "last_update": now}
            else:
                # si no viene nada remoto, dejamos entrada vacía (pero existente)
                items.setdefault(cid, {"rows": [], "last_update": None})

        out = {"items": items}
        self.local_repo.save(out)
        return out

    def ensure_min_records(
        self,
        comp_ids: List[str],
        min_records: int | None = None,
        *,
        chunk_size: int = 10,
        top: int = 999,
    ) -> Dict[str, Any]:
        """
        Asegura que cada componente tenga al menos K registros en cache.
        Si falta, consulta remoto para esos IDs y actualiza el cache.
        """
        K = int(min_records or (MIN_INTERVALS_FOR_OPT + 1))
        comp_ids = [str(c).strip() for c in (comp_ids or []) if str(c).strip()]
        if not comp_ids:
            return {"needed": [], "k": K}

        cache = _ensure_cache_shape(self.local_repo.load())
        items: Dict[str, Any] = cache["items"]

        need: List[str] = []
        for cid in comp_ids:
            entry = items.get(cid, {}) if isinstance(items.get(cid, {}), dict) else {}
            rows = entry.get("rows", []) if isinstance(entry, dict) else []
            if not isinstance(rows, list):
                rows = []
            if len(rows) < K:
                need.append(cid)

        if need:
            rows = self.remote.fetch_failures_for_components(need, chunk_size=chunk_size, top=top)
            grouped = _group_remote_rows(rows)
            now = _utc_now_iso()

            for cid in need:
                items[cid] = {"rows": grouped.get(cid, []), "last_update": now}

            out = {"items": items}
            self.local_repo.save(out)

        return {"needed": need, "k": K}


# ------------------ Wrappers (para que GUI lo use simple) ------------------

def reload_failures(
    service: FailuresService,
    component_ids: Iterable[str],
    page_size: int = 200,  # mantenido solo por compat, no se usa en remoto (top/chunk_size lo controla)
) -> Dict[str, Any]:
    # page_size queda por compat con la firma vieja (GUI), pero la query remota no pagina así
    return service.reload_failures(component_ids)


def ensure_min_records(
    service: FailuresService,
    comp_ids: List[str],
    min_records: int | None = None,
) -> Dict[str, Any]:
    return service.ensure_min_records(comp_ids, min_records)
