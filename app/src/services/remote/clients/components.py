from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
import unicodedata

from ..settings import SPSettings, load_settings
from ..graph_session import GraphSession, GraphError
from ..resolver import SPResolver
from ..search_api import (
    batch_get_listitem_fields,
    build_contains_query,
    discover_region,
    extract_more_results_available,
    extract_search_hits,
    extract_total,
    get_sp_ids_from_hit,
    hostname_from_site_payload,
    resolve_list_weburl,
    search_query,
)
from ...cache.repositories.region import RegionCacheRepo

def _norm(s: str) -> str:
    s = (s or "").strip().lower()
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


class SharePointComponentsClient:
    """
    Cliente para buscar/obtener componentes desde SharePoint List (Graph).
    Mantiene API usada por CloudClient:
      - from_env(project_root=None, dotenv_path=None)
      - search_components(query, page=1, page_size=20) -> (items, total)
      - fetch_components_by_ids(component_ids, chunk_size=20) -> {kks: meta}
    """

    def __init__(
        self,
        *,
        settings: SPSettings,
        components_list_id: Optional[str] = None,
        components_list_name: Optional[str] = None,
        field_id: str = "Component_ID",
        field_name: str = "kks_name",
        field_insid: str = "insID",
        field_subtype: str = "SubType",
        field_type: str = "type",
        # compat: si en algún momento usas columnas lookup
        field_subtype_value: Optional[str] = None,
        field_type_value: Optional[str] = None,
    ):
        self.settings = settings
        self.session = GraphSession(settings)
        self.resolver = SPResolver(self.session)

        self.components_list_id = components_list_id
        self.components_list_name = components_list_name

        self.field_id = field_id
        self.field_name = field_name
        self.field_insid = field_insid
        self.field_subtype = field_subtype
        self.field_type = field_type

        # solo se usa para leer valores desde "fields" (no en $select), así que no rompe si no existe
        self.field_subtype_value = field_subtype_value or f"{field_subtype}LookupValue"
        self.field_type_value = field_type_value or f"{field_type}LookupValue"

        self._resolved_site_id: Optional[str] = None
        self._resolved_list_id: Optional[str] = None
        self._resolved_list_web_url: Optional[str] = None
        self._search_region: Optional[str] = None
        self._region_cache = RegionCacheRepo.default()

    @classmethod
    def from_env(cls, project_root: str | None = None, dotenv_path: str | None = None) -> "SharePointComponentsClient":
        settings = load_settings(project_root=project_root, dotenv_path=dotenv_path)

        settings.site.validate()
        settings.components.validate()

        return cls(
            settings=settings,
            components_list_id=settings.components.list_id,
            components_list_name=settings.components.list_name,
            field_id=settings.components.field_id,
            field_name=settings.components.field_name,
            field_insid=settings.components.field_insid,
            field_subtype=settings.components.field_subtype,
            field_type=settings.components.field_type,
        )

    # ---------------- internals ----------------

    @staticmethod
    def _escape_odata(v: str) -> str:
        return (v or "").replace("'", "''")

    def _site_id(self) -> str:
        if self._resolved_site_id:
            return self._resolved_site_id
        sid = self.resolver.site_id()
        self._resolved_site_id = sid
        return sid

    def _site_region(self) -> Optional[str]:
        data = self.session.get_json(f"sites/{self._site_id()}", params={"$select": "siteCollection,webUrl"})
        sc = data.get("siteCollection") or {}
        region = (sc.get("dataLocationCode") or "").strip()
        return region or None

    def _tenant_hostname(self) -> str:
        if self.settings.site.hostname:
            return self.settings.site.hostname
        data = self.session.get_json(f"sites/{self._site_id()}", params={"$select": "siteCollection,webUrl"})
        hostname = hostname_from_site_payload(data)
        if hostname:
            return hostname
        raise RuntimeError("Cannot resolve tenant hostname from site info")

    def _get_search_region(self, *, force_refresh: bool = False) -> str:
        if not force_refresh and self._search_region:
            return self._search_region

        if not force_refresh:
            cached = self._region_cache.load()
            if cached:
                self._search_region = cached
                return cached

        region = self._site_region()
        if not region:
            hostname = self._tenant_hostname()
            region = discover_region(self.session, hostname)

        self._search_region = region
        self._region_cache.save(region)
        return region

    def _list_id(self) -> str:
        if self._resolved_list_id:
            return self._resolved_list_id

        lid = self.resolver.list_id(
            list_id=self.components_list_id,
            list_name=self.components_list_name,
        )
        self._resolved_list_id = lid
        return lid
    
    def _site_web_url(self) -> str:
        if self.settings.site.hostname and self.settings.site.path:
            path = self.settings.site.path.strip("/")
            return f"https://{self.settings.site.hostname}/{path}"
        data = self.session.get_json(f"sites/{self._site_id()}", params={"$select": "webUrl"})
        return str(data.get("webUrl") or "").rstrip("/")

    def _list_web_url(self) -> str:
        if self._resolved_list_web_url:
            return self._resolved_list_web_url
        web_url = resolve_list_weburl(self.session, self._site_id(), self._list_id())
        self._resolved_list_web_url = web_url
        return web_url

    @staticmethod
    def _unpack_value(fields: dict, base_key: str, value_key: str) -> str:
        """
        Lee un campo que puede ser:
        - texto normal (string)
        - lookup (dict con LookupValue)
        - lookup “separado” (XLookupValue)
        """
        v = fields.get(base_key)

        if isinstance(v, dict):
            for k in ("LookupValue", "lookupValue", "value", "Value", "Label", "label"):
                if k in v and v.get(k) is not None:
                    return str(v.get(k)).strip()

        if v is None:
            vv = fields.get(value_key)
            return str(vv).strip() if vv is not None else ""

        # si es numérico, a veces el texto viene en XLookupValue
        if isinstance(v, (int, float)) or (isinstance(v, str) and v.strip().isdigit()):
            vv = fields.get(value_key)
            if vv is not None:
                return str(vv).strip()

        return str(v).strip()

    def _parse_item(self, it: dict) -> tuple[str, dict]:
        fields = (it or {}).get("fields") or {}

        cid = str(fields.get(self.field_id) or "").strip()
        if not cid:
            cid = str(fields.get("Title") or fields.get("title") or "").strip()

        name = str(fields.get(self.field_name) or fields.get("Title") or fields.get("title") or cid).strip()

        subtype = self._unpack_value(fields, self.field_subtype, self.field_subtype_value) or ""
        main_type = self._unpack_value(fields, self.field_type, self.field_type_value) or ""

        insid = fields.get(self.field_insid) or it.get("id")

        meta = {
            "insID": insid,
            "kks_name": name,
            "SubType": subtype,
            "type": main_type,
            "title": name,
            "etag": it.get("eTag") or it.get("@odata.etag"),
            "updated_at": it.get("lastModifiedDateTime") or it.get("createdDateTime"),
        }
        return cid, meta

    def _get_json_any(self, ref: str, params: Optional[dict] = None) -> dict:
        """
        Permite pasar:
        - path relativo (sites/.../lists/...)
        - nextLink absoluto (https://graph.microsoft.com/...)
        """
        return self.session.get_json(ref, params=params)

    # ---------------- public API ----------------

    def search_components(self, query: str, page: int = 1, page_size: int = 20) -> Tuple[List[Dict[str, Any]], int]:
        q = (query or "").strip()
        page = max(1, int(page))
        page_size = max(1, int(page_size))

        site_id = self._site_id()
        list_id = self._list_id()
        query_string = build_contains_query(self.field_id, self.field_name, q)
        from_index = (page - 1) * page_size
        size = min(page_size, 200)
        list_web_url = self._list_web_url()
        scope_url = list_web_url or self._site_web_url()
        query_template = f'({{searchTerms}}) Path:"{scope_url}"'

        region = self._get_search_region()
        try:
            search_resp = search_query(
                self.session,
                query_string=query_string,
                region=region,
                from_index=from_index,
                size=size,
                query_template=query_template,
            )
        except GraphError:
            region = self._get_search_region(force_refresh=True)
            search_resp = search_query(
                self.session,
                query_string=query_string,
                region=region,
                from_index=from_index,
                size=size,
                query_template=query_template,
            )

        hits = extract_search_hits(search_resp)
        print(hits)
        item_ids: List[str] = []
        for hit in hits:
            hit_site_id, hit_list_id, hit_item_id = get_sp_ids_from_hit(hit)
            if not hit_item_id:
                continue
            if hit_site_id != site_id or hit_list_id != list_id:
                continue
            item_ids.append(str(hit_item_id))

        fields_map = batch_get_listitem_fields(
            self.session,
            site_id=site_id,
            list_id=list_id,
            item_ids=item_ids,
            select_fields=[
                "Title",
                self.field_id,
                self.field_name,
                self.field_subtype,
                self.field_type,
                self.field_insid,
            ],
        )

        q_norm = _norm(q)
        items: List[Dict[str, Any]] = []
        for item_id in item_ids:
            fields = fields_map.get(item_id) or {}
            if "__error__" in fields:
                continue
            it = {"fields": fields, "id": item_id}
            cid, meta = self._parse_item(it)
            if not cid:
                continue
            if q:
                name = _norm(str(meta.get("kks_name") or ""))
                cid_norm = _norm(cid)
                if q_norm not in cid_norm and q_norm not in name:
                    continue
            items.append({"id": cid, **meta})

        total = extract_total(search_resp)
        if total is None:
            total = (page - 1) * page_size + len(items) + (1 if extract_more_results_available(search_resp) else 0)
        return items, total

    def fetch_components_by_ids(self, component_ids: list[str], chunk_size: int = 20) -> Dict[str, Dict[str, Any]]:
        ids = [str(x).strip() for x in (component_ids or []) if str(x).strip()]
        if not ids:
            return {}

        site_id = self._site_id()
        list_id = self._list_id()

        out: Dict[str, Dict[str, Any]] = {}

        n = max(1, int(chunk_size))
        for i in range(0, len(ids), n):
            batch = ids[i : i + n]
            clauses = [f"fields/{self.field_id} eq '{self._escape_odata(cid)}'" for cid in batch]
            odata_filter = " or ".join(clauses)

            path = f"sites/{site_id}/lists/{list_id}/items"
            params = {
                "$select": "id,eTag,lastModifiedDateTime,createdDateTime,fields",
                "$expand": "fields",
                "$filter": odata_filter,
                "$top": "999",
            }

            data = self._get_json_any(path, params=params)
            while True:
                for it in (data.get("value") or []) if isinstance(data, dict) else []:
                    cid, meta = self._parse_item(it)
                    if cid:
                        out[cid] = meta

                nxt = data.get("@odata.nextLink") if isinstance(data, dict) else None
                if not nxt:
                    break
                data = self._get_json_any(nxt)

        return out
