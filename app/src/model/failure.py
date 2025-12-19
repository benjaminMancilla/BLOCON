from __future__ import annotations
from typing import Iterable, Dict, List, Tuple
from datetime import datetime, timezone

import os
import json

from ..services.remote.cloud import CloudClient
from ..services.remote.clients import SharePointFailuresClient

MIN_INTERVALS_FOR_OPT: int = 2

def _local_store(project_root: str):
    cloud = CloudClient(project_root)
    local = getattr(cloud, "local", None)
    if local is None:
        raise RuntimeError("CloudClient.local no está configurado")
    return local

# ---------------- Cache paths ----------------
def _fail_cache_path(project_root: str) -> str:
    return os.path.join(project_root, "failures.cache.json")

def load_failures_cache(project_root: str) -> Dict:
    """
    Lee cache de fallas desde AppData (vía LocalWorkspaceStore),
    """
    return _local_store(project_root).load_failures_cache()

def save_failures_cache(cache: Dict, project_root: str) -> None:
    """
    Guarda cache de fallas en AppData (vía LocalWorkspaceStore),
    """
    _local_store(project_root).save_failures_cache(cache)

# ------------- Normalización de filas -------------
def _norm_row(row: Dict) -> Tuple[str, str]:
    date_str = str(row.get("failure_date", "")).strip()
    if len(date_str) >= 10:
        date_str = date_str[:10]  # soporta ISO completo
    typ = str(row.get("type_failure", "")).strip()
    return (date_str, typ)

# ------------- Carga paginada desde cloud -------------
def _fetch_all_failures_for(component_ids: Iterable[str], client) -> Dict[str, List[Tuple[str, str]]]:
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

# ------------- Cliente de fallas (real o mock) -------------
def _get_failures_client(project_root: str):
    try:
        return SharePointFailuresClient.from_env(project_root=project_root)
    except Exception:
        return _MockFailuresClient(project_root)

# ------------- API de recarga (usada por GUI) -------------
def reload_failures(project_root: str, component_ids: Iterable[str], page_size: int = 200) -> Dict:
    client = _get_failures_client(project_root)
    fresh = _fetch_all_failures_for(component_ids, client)

    cache = load_failures_cache(project_root)
    items = cache.get("items", {}) if isinstance(cache.get("items", {}), dict) else {}

    ts_now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    req_set = set([c for c in component_ids if c])

    for cid in req_set:
        if cid in fresh:
            items[cid] = {"rows": fresh[cid], "last_update": ts_now}
        else:
            items.setdefault(cid, {"rows": [], "last_update": None})

    out = {"items": items}
    save_failures_cache(out, project_root)
    return out


def ensure_min_records(project_root: str, comp_ids: list[str], min_records: int | None = None) -> dict:
    K = min_records or (MIN_INTERVALS_FOR_OPT+1)
    cache = load_failures_cache(project_root)
    items = cache.get("items", {})

    need: list[str] = []
    for cid in comp_ids:
        v = items.get(cid)
        rows = (v.get("rows", []) if isinstance(v, dict) else v) if v is not None else []
        if len(rows or []) < K:
            need.append(cid)

    if need:
        client = _get_failures_client(project_root)
        now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        for cid in need:
            rows = client.fetch_failures_for_components([cid])
            items[cid] = {"rows": [_norm_row(r) for r in rows], "last_update": now}
        cache["items"] = items
        save_failures_cache(cache, project_root)

    return {"needed": need, "k": K}



class _MockFailuresClient:
    def __init__(self, project_root: str):
        self._cloud = CloudClient(project_root)

    def fetch_failures_for_components(self, component_ids: List[str]) -> List[Dict]:
        page = 1
        page_size = 500
        out: List[Dict] = []
        while True:
            rows_page, total = self._cloud.fetch_failures_by_ids(component_ids, page=page, page_size=page_size)
            if not rows_page:
                break
            out.extend(rows_page)
            if page * page_size >= total:
                break
            page += 1
        return out