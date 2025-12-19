from __future__ import annotations
from typing import Iterable, Dict, List, Tuple, Optional, Iterable
from datetime import datetime, timezone

from .ports import FailuresCachePort, FailuresClientPort

MIN_INTERVALS_FOR_OPT: int = 2


def load_failures_cache(
    project_root: Optional[str],
    *,
    cache: Optional[FailuresCachePort],
) -> Dict:
    """
    Lee cache de fallas usando un puerto (sin acoplar a infraestructura).
    """
    if cache is None:
        return {}
    return cache.load_failures_cache(project_root)

def save_failures_cache(
    cache_data: Dict,
    project_root: Optional[str],
    *,
    cache: FailuresCachePort,
) -> None:
    """
    Guarda cache de fallas usando un puerto (sin acoplar a infraestructura).
    """
    cache.save_failures_cache(cache_data, project_root)

# ------------- Normalización de filas -------------
def _norm_row(row: Dict) -> Tuple[str, str]:
    date_str = str(row.get("failure_date", "")).strip()
    if len(date_str) >= 10:
        date_str = date_str[:10]  # soporta ISO completo
    typ = str(row.get("type_failure", "")).strip()
    return (date_str, typ)

# ------------- Carga paginada desde cloud -------------
def _fetch_all_failures_for(
    component_ids: Iterable[str],
    client: FailuresClientPort,
) -> Dict[str, List[Tuple[str, str]]]:
    comp_ids = [c for c in component_ids if c]
    if not comp_ids:
        return {}

    out: Dict[str, List[Tuple[str, str]]] = {cid: [] for cid in comp_ids}
    rows = client.fetch_failures_for_components(comp_ids)

    for r in rows:
        cid = str(r.get("Component_ID", "")).strip()
        if cid in out:
            out[cid].append(_norm_row(r))

    for cid in out:
        out[cid].sort(key=lambda t: t[0])
    return out


# ------------- API de recarga (usada por GUI) -------------
def reload_failures(
    project_root: Optional[str],
    component_ids: Iterable[str],
    *,
    cache: FailuresCachePort,
    client: FailuresClientPort,
    page_size: int = 200,
) -> Dict:
    _ = page_size
    fresh = _fetch_all_failures_for(component_ids, client)

    cache_data = load_failures_cache(project_root, cache=cache)
    items = cache_data.get("items", {}) if isinstance(cache_data.get("items", {}), dict) else {}

    ts_now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    req_set = set([c for c in component_ids if c])

    for cid in req_set:
        if cid in fresh:
            items[cid] = {"rows": fresh[cid], "last_update": ts_now}
        else:
            items.setdefault(cid, {"rows": [], "last_update": None})

    out = {"items": items}
    save_failures_cache(out, project_root, cache=cache)
    return out


def ensure_min_records(
    project_root: Optional[str],
    comp_ids: list[str],
    min_records: int | None = None,
    *,
    cache: FailuresCachePort,
    client: FailuresClientPort,
) -> dict:
    K = min_records or (MIN_INTERVALS_FOR_OPT + 1)
    cache_data = load_failures_cache(project_root, cache=cache)
    items = cache_data.get("items", {})

    need: list[str] = []
    for cid in comp_ids:
        v = items.get(cid)
        rows = (v.get("rows", []) if isinstance(v, dict) else v) if v is not None else []
        if len(rows or []) < K:
            need.append(cid)

    if need:
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        for cid in need:
            rows = client.fetch_failures_for_components([cid])
            items[cid] = {"rows": [_norm_row(r) for r in rows], "last_update": now}
        cache_data["items"] = items
        save_failures_cache(cache_data, project_root, cache=cache)

    return {"needed": need, "k": K}