import argparse
import json
import sys
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

import requests

import re

def discover_region(session, tenant_hostname: str) -> str:
    """
    1) Try /beta/sites?filter=siteCollection/root ne null&select=webUrl,siteCollection
    2) If empty/missing, probe /beta/search/query with an invalid region and parse the error message.
    """
    # 1) Try multi-geo discovery endpoint (works for multi-geo; in single-geo may return empty "")
    url = f"{GRAPH_BETA}/sites"
    params = {
        "$filter": "siteCollection/root ne null",
        "$select": "webUrl,siteCollection",
        "$top": "200"
    }
    data = session.get(url, params=params, timeout=60).json()
    for s in data.get("value", []) or []:
        sc = s.get("siteCollection") or {}
        if (sc.get("hostname") or "").lower() == tenant_hostname.lower():
            code = (sc.get("dataLocationCode") or "").strip()
            if code:
                return code  # e.g., NAM/EUR/APC...
            break  # hostname matched but empty => single-geo likely

    # 2) Probe: send invalid region, parse "Only valid regions are ..."
    probe_body = {
        "requests": [
            {
                "entityTypes": ["listItem"],
                "query": {"queryString": "probe"},
                "region": "XXX"  # intentionally invalid
            }
        ]
    }
    r = session.post(f"{GRAPH_BETA}/search/query", json=probe_body, timeout=60)
    try:
        err = r.json().get("error", {})
        msg = err.get("message", "") or ""
    except Exception:
        msg = r.text or ""

    m = re.search(r"Only valid regions are\s+([A-Z, ]+)", msg)
    if not m:
        raise RuntimeError(
            "No pude autodetectar region. "
            "Respuesta de probe (recortada): " + msg[:300]
        )
    # pick first region (usually there's one)
    regions = [x.strip() for x in m.group(1).split(",") if x.strip()]
    return regions[0]


GRAPH_V1 = "https://graph.microsoft.com/v1.0"
GRAPH_BETA = "https://graph.microsoft.com/beta"


def die(msg: str, code: int = 1) -> None:
    print(msg, file=sys.stderr)
    raise SystemExit(code)


def get_token_client_credentials(tenant_id: str, client_id: str, client_secret: str) -> str:
    token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    data = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials",
        "scope": "https://graph.microsoft.com/.default",
    }
    r = requests.post(token_url, data=data, timeout=60)
    if r.status_code != 200:
        die(f"Token request failed ({r.status_code}): {r.text}")
    return r.json()["access_token"]


def graph_get(session: requests.Session, url: str, params: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    r = session.get(url, params=params, timeout=60)
    if r.status_code >= 400:
        die(f"GET {url} failed ({r.status_code}): {r.text}")
    return r.json()


def graph_post(session: requests.Session, url: str, body: Dict[str, Any]) -> Dict[str, Any]:
    r = session.post(url, json=body, timeout=60)
    if r.status_code >= 400:
        die(f"POST {url} failed ({r.status_code}): {r.text}")
    return r.json()


def resolve_site(session: requests.Session, site_url: str) -> Tuple[str, str]:
    """Resolve a SharePoint site URL into (site_id, region=dataLocationCode).

    Notes:
    - Microsoft Search API with application permissions requires a 'region' value.
    - In single-geo tenants, Microsoft Graph can return siteCollection.dataLocationCode as an empty string,
      so we DO NOT fail if it's missing; caller can fall back to discover_region().
    """
    u = urlparse(site_url)
    if not u.scheme or not u.netloc or not u.path:
        die(f"Invalid --site-url: {site_url}")

    hostname = u.netloc
    path = u.path.rstrip("/")  # e.g. /sites/gemeherramientas

    url = f"{GRAPH_V1}/sites/{hostname}:{path}"
    site = graph_get(session, url, params={"$select": "id,webUrl,siteCollection"})
    site_id = site.get("id")
    if not site_id:
        die(f"Could not resolve site id from {site_url}: {site}")

    sc = site.get("siteCollection") or {}
    region = (sc.get("dataLocationCode") or "").strip()  # may be "" in single-geo tenants
    return site_id, region
def resolve_list_id(session: requests.Session, site_id: str, list_title: str) -> str:
    # List all lists and match by displayName (safe and simple)
    url = f"{GRAPH_V1}/sites/{site_id}/lists"
    data = graph_get(session, url, params={"$select": "id,displayName", "$top": "200"})
    for lst in data.get("value", []):
        if (lst.get("displayName") or "").lower() == list_title.lower():
            return lst["id"]
    die(f'List "{list_title}" not found in site {site_id}. Got: {[l.get("displayName") for l in data.get("value", [])]}')

def resolve_list_weburl(session: requests.Session, site_id: str, list_id: str) -> str:
    """Get the list webUrl (used to scope Search API results with Path: KQL)."""
    url = f"{GRAPH_V1}/sites/{site_id}/lists/{list_id}"
    lst = graph_get(session, url, params={"$select": "webUrl"})
    return (lst.get("webUrl") or "").rstrip("/")


def extract_search_hits(resp: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Normalizes both schemas:
    - v1.0 typically returns {"value":[{...hitsContainers...}]}
    - some beta examples show a direct searchResponse with "hitsContainers"
    """
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


def get_sp_ids_from_hit(hit: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Returns (siteId, listId, listItemId)
    """
    res = hit.get("resource") or {}
    parent = res.get("parentReference") or {}
    site_id = parent.get("siteId")

    sp = res.get("sharepointIds") or parent.get("sharepointIds") or {}
    list_id = sp.get("listId")
    list_item_id = sp.get("listItemId")
    return site_id, list_id, list_item_id


def batch_get_listitem_fields(
    session: requests.Session,
    site_id: str,
    list_id: str,
    item_ids: List[str],
    select_fields: List[str],
) -> Dict[str, Dict[str, Any]]:
    """
    Returns dict: item_id -> fields dict (Graph listItem.fields)
    Uses $batch in chunks of 20.
    """
    out: Dict[str, Dict[str, Any]] = {}
    if not item_ids:
        return out

    def chunks(xs: List[str], n: int) -> List[List[str]]:
        return [xs[i : i + n] for i in range(0, len(xs), n)]

    for batch_ids in chunks(item_ids, 20):
        requests_body = []
        for idx, item_id in enumerate(batch_ids, start=1):
            # /sites/{site_id}/lists/{list_id}/items/{item_id}?$expand=fields($select=...)
            sel = ",".join(select_fields)
            rel = f"/sites/{site_id}/lists/{list_id}/items/{item_id}?$expand=fields($select={sel})"
            requests_body.append({"id": str(idx), "method": "GET", "url": rel})

        body = {"requests": requests_body}
        resp = graph_post(session, f"{GRAPH_V1}/$batch", body)
        for r in resp.get("responses", []) or []:
            status = r.get("status", 0)
            body_json = r.get("body") or {}
            # Map response back to item_id by position
            try:
                pos = int(r["id"]) - 1
                item_id = batch_ids[pos]
            except Exception:
                continue
            if status >= 400:
                out[item_id] = {"__error__": body_json}
            else:
                out[item_id] = (body_json.get("fields") or {})
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--site-url", required=True, help="e.g. https://tenant.sharepoint.com/sites/yoursite")
    ap.add_argument("--list-title", required=True, help="Display name of the SharePoint list, e.g. Unit")
    ap.add_argument("--tenant-id", required=True)
    ap.add_argument("--client-id", required=True)
    ap.add_argument("--client-secret", required=True)

    ap.add_argument("--q", required=True, help="Query string, e.g. HSK18 (you can also try HSK18*)")
    ap.add_argument("--top", type=int, default=50)

    ap.add_argument("--field-kks", default="kks", help="Internal name of KKS field")
    ap.add_argument("--field-name", default="kks_name", help="Internal name of KKS name field")

    ap.add_argument(
        "--force-contains",
        action="store_true",
        help="After getting fields, filter locally: q in kks or q in kks_name (case-insensitive).",
    )

    args = ap.parse_args()

    token = get_token_client_credentials(args.tenant_id, args.client_id, args.client_secret)
    session = requests.Session()
    session.headers.update({"Authorization": f"Bearer {token}", "Accept": "application/json"})

    print("Resolving site + region...")
    site_id, region0 = resolve_site(session, args.site_url)
    tenant_hostname = urlparse(args.site_url).netloc  # generadorametropolitana.sharepoint.com
    region = region0 or discover_region(session, tenant_hostname)
    print("Auto region =", region)
    print(f"  site_id = {site_id}")
    print(f"  region  = {region}")

    print("Resolving list id...")
    list_id = resolve_list_id(session, site_id, args.list_title)
    print(f"  list_id = {list_id}")

    # IMPORTANT: Microsoft Search API returns tenant-wide results (within the selected region) for app-only calls.
    # Scope the query to THIS list (fallback to site) using a KQL Path filter via queryTemplate.
    list_web_url = resolve_list_weburl(session, site_id, list_id)
    scope_url = list_web_url or args.site_url.rstrip('/')
    query_template = f'({{searchTerms}}) Path:"{scope_url}"'

    # Search (application permissions flow -> beta + region)
    print("Running Graph Search (beta/search/query)...")
    body = {
        "requests": [
            {
                "entityTypes": ["listItem"],
                "query": {"queryString": args.q, "queryTemplate": query_template},
                "from": 0,
                "size": min(max(args.top, 1), 200),
                "region": region,
            }
        ]
    }
    search_resp = graph_post(session, f"{GRAPH_BETA}/search/query", body)
    hits = extract_search_hits(search_resp)

    # Filter to the exact site/list
    filtered = []
    item_ids = []
    for h in hits:
        h_site_id, h_list_id, h_item_id = get_sp_ids_from_hit(h)
        if not h_item_id:
            continue
        if h_list_id != list_id:
            continue
        if h_site_id and h_site_id != site_id:
            continue
        filtered.append(h)
        item_ids.append(str(h_item_id))

    print(f"Search hits total (raw): {len(hits)}")
    print(f"Search hits in your site+list: {len(filtered)}")

    if not item_ids:
        print("No list items matched your site+list. Try:")
        print('  - increasing --top')
        print('  - using a broader --q')
        print('  - trying prefix: e.g. "HSK18*"')
        return

    # Fetch fields for those items (kks + kks_name)
    fields_map = batch_get_listitem_fields(
        session,
        site_id=site_id,
        list_id=list_id,
        item_ids=item_ids,
        select_fields=[args.field_kks, args.field_name],
    )

    q_norm = args.q.lower()
    rows = []
    for item_id in item_ids:
        f = fields_map.get(item_id, {})
        kks = (f.get(args.field_kks) or "")
        name = (f.get(args.field_name) or "")
        if args.force_contains:
            if q_norm not in str(kks).lower() and q_norm not in str(name).lower():
                continue
        rows.append({"listItemId": item_id, args.field_kks: kks, args.field_name: name})

    print("\n=== RESULTS ===")
    for r in rows[: args.top]:
        print(json.dumps(r, ensure_ascii=False))

    print(f"\nReturned {len(rows)} rows after field fetch" + (" + local contains filter" if args.force_contains else ""))


if __name__ == "__main__":
    main()