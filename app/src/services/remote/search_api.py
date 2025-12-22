from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlparse

from .graph_session import GraphError, GraphSession

GRAPH_BETA_BASE = "https://graph.microsoft.com/beta"


def build_contains_query(field_id: str, field_name: str, query: str) -> str:
    q = (query or "").strip()
    if not q:
        return "*"
    q = q.replace('"', '\\"')
    if "*" in q:
        return q
    return f"\"{q}\""


def extract_search_hits(resp: Dict[str, Any]) -> List[Dict[str, Any]]:
    responses: List[Dict[str, Any]]
    if "value" in resp and isinstance(resp["value"], list):
        responses = resp["value"]
    else:
        responses = [resp]

    hits: List[Dict[str, Any]] = []
    for sr in responses:
        for hc in sr.get("hitsContainers", []) or []:
            for h in hc.get("hits", []) or []:
                hits.append(h)
    return hits


def extract_total(resp: Dict[str, Any]) -> Optional[int]:
    responses: List[Dict[str, Any]]
    if "value" in resp and isinstance(resp["value"], list):
        responses = resp["value"]
    else:
        responses = [resp]

    for sr in responses:
        for hc in sr.get("hitsContainers", []) or []:
            total = hc.get("total")
            if total is not None:
                try:
                    return int(total)
                except Exception:
                    return None
    return None


def extract_more_results_available(resp: Dict[str, Any]) -> bool:
    responses: List[Dict[str, Any]]
    if "value" in resp and isinstance(resp["value"], list):
        responses = resp["value"]
    else:
        responses = [resp]

    for sr in responses:
        for hc in sr.get("hitsContainers", []) or []:
            if hc.get("moreResultsAvailable"):
                return True
    return False


def get_sp_ids_from_hit(hit: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    res = hit.get("resource") or {}
    parent = res.get("parentReference") or {}
    site_id = parent.get("siteId")

    sp = res.get("sharepointIds") or parent.get("sharepointIds") or {}
    list_id = sp.get("listId")
    list_item_id = sp.get("listItemId")
    return site_id, list_id, list_item_id


def _chunked(values: List[str], size: int) -> Iterable[List[str]]:
    for i in range(0, len(values), size):
        yield values[i : i + size]


def batch_get_listitem_fields(
    session: GraphSession,
    site_id: str,
    list_id: str,
    item_ids: List[str],
    select_fields: List[str],
) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    if not item_ids:
        return out

    select_clause = ",".join(select_fields)
    for batch_ids in _chunked(item_ids, 20):
        requests_body = []
        for idx, item_id in enumerate(batch_ids, start=1):
            rel = f"/sites/{site_id}/lists/{list_id}/items/{item_id}?$expand=fields($select={select_clause})"
            requests_body.append({"id": str(idx), "method": "GET", "url": rel})

        resp = session.post_json("$batch", {"requests": requests_body})
        for r in resp.get("responses", []) or []:
            try:
                pos = int(r.get("id", "0")) - 1
                item_id = batch_ids[pos]
            except Exception:
                continue
            status = r.get("status", 0)
            body_json = r.get("body") or {}
            if status >= 400:
                out[item_id] = {"__error__": body_json}
            else:
                out[item_id] = body_json.get("fields") or {}
    return out


def search_query(
    session: GraphSession,
    *,
    query_string: str,
    region: str,
    from_index: int,
    size: int,
    entity_types: Optional[List[str]] = None,
) -> Dict[str, Any]:
    body = {
        "requests": [
            {
                "entityTypes": entity_types or ["listItem"],
                "query": {"queryString": query_string},
                "from": max(0, int(from_index)),
                "size": min(max(size, 1), 200),
                "region": region,
            }
        ]
    }
    return session.request_json("POST", f"{GRAPH_BETA_BASE}/search/query", json_body=body)


def discover_region(session: GraphSession, tenant_hostname: str) -> str:
    url = f"{GRAPH_BETA_BASE}/sites"
    params = {
        "$filter": "siteCollection/root ne null",
        "$select": "webUrl,siteCollection",
        "$top": "200",
    }
    try:
        data = session.get_json(url, params=params)
    except GraphError:
        data = {}

    for site in data.get("value", []) or []:
        sc = site.get("siteCollection") or {}
        if (sc.get("hostname") or "").lower() == tenant_hostname.lower():
            code = (sc.get("dataLocationCode") or "").strip()
            if code:
                return code
            break

    probe_body = {
        "requests": [
            {
                "entityTypes": ["listItem"],
                "query": {"queryString": "probe"},
                "region": "XXX",
            }
        ]
    }
    message = ""
    try:
        session.request_json("POST", f"{GRAPH_BETA_BASE}/search/query", json_body=probe_body)
    except GraphError as exc:
        try:
            payload = json.loads(exc.body or "{}")
            message = payload.get("error", {}).get("message", "") or exc.body
        except Exception:
            message = exc.body or ""

    m = re.search(r"Only valid regions are\s+([A-Z, ]+)", message or "")
    if not m:
        raise RuntimeError(
            "No pude autodetectar region. Respuesta de probe (recortada): "
            + (message or "")[:300]
        )
    regions = [x.strip() for x in m.group(1).split(",") if x.strip()]
    if not regions:
        raise RuntimeError("No pude autodetectar region: lista vacía")
    return regions[0]


def hostname_from_site_payload(site_payload: Dict[str, Any]) -> Optional[str]:
    sc = site_payload.get("siteCollection") or {}
    hostname = sc.get("hostname")
    if hostname:
        return str(hostname)
    web_url = site_payload.get("webUrl")
    if web_url:
        return urlparse(str(web_url)).netloc or None
    return None