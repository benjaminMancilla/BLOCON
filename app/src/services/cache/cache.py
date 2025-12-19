from __future__ import annotations
import os, json
from typing import Dict, Optional, Any, List, Tuple

# Ruta canonical del cache en el proyecto
def cache_path(data_dir: Optional[str] = None) -> str:
    base = data_dir or os.path.dirname(os.path.dirname(__file__))
    return os.path.join(base, "components.cache.json")

# ---------- FAILURES CACHE  ----------
def failures_cache_path(data_dir: Optional[str] = None) -> str:
    base = data_dir or os.path.dirname(os.path.dirname(__file__))
    return os.path.join(base, "components_failures.cache.json")


# Búsqueda flexible si no se pasa project_root (cwds y directorios comunes)
def _candidate_paths() -> list[str]:
    here = os.path.dirname(__file__)
    proj = os.path.dirname(here)
    cwd  = os.getcwd()
    return [
        cache_path(proj),
        os.path.join(proj, "cache", "components.cache.json"),
        os.path.join(here, "components.cache.json"),
        os.path.join(cwd,  "components.cache.json"),
    ]


def load_cache(data_dir: Optional[str] = None) -> Dict[str, Dict]:
    # Si se entrega project_root, usa esa ruta; si no, busca candidatos
    paths = [cache_path(data_dir)] if data_dir else _candidate_paths()
    for p in paths:
        try:
            if os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return data if isinstance(data, dict) else {}
        except Exception:
            continue
    return {}

def save_cache(data: Dict[str, Dict], data_dir: Optional[str] = None) -> None:
    p = cache_path(data_dir)
    try:
        os.makedirs(os.path.dirname(p), exist_ok=True)
    except Exception:
        pass
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

# Utilidad: mergea/actualiza (por id) sin perder campos existentes
def upsert_many(base: Dict[str, Dict], items: list[Dict]) -> Dict[str, Dict]:
    for it in items:
        cid = str(it.get("id", "")).strip()
        if not cid:
            continue
        cur = dict(base.get(cid, {}))
        cur.update(it)
        base[cid] = cur
    return base