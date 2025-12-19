from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from ..settings import SPSettings, load_settings
from ..graph_session import GraphSession, GraphError
from ..resolver import SPResolver


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

    def _list_id(self) -> str:
        if self._resolved_list_id:
            return self._resolved_list_id

        lid = self.resolver.list_id(
            list_id=self.components_list_id,
            list_name=self.components_list_name,
        )
        self._resolved_list_id = lid
        return lid

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
            cid = str(fields.get("Title") or "").strip()

        name = str(fields.get(self.field_name) or fields.get("title") or cid).strip()

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

        path = f"sites/{site_id}/lists/{list_id}/items"

        params = {
            "$top": str(min(page_size, 999)),
            "$expand": "fields",
        }

        qq = self._escape_odata(q)
        if q:
            # best-effort: Graph a veces falla con contains (depende del tipo/columna)
            params["$filter"] = " or ".join(
                [
                    f"startswith(fields/{self.field_id}, '{qq}')",
                    f"contains(fields/{self.field_name}, '{qq}')",
                ]
            )

        try:
            data = self._get_json_any(path, params=params)
        except Exception as e:
            # fallback: solo por KKS (startsWith) si falla el filtro “completo”
            if q:
                params["$filter"] = f"startswith(fields/{self.field_id}, '{qq}')"
                data = self._get_json_any(path, params=params)
            else:
                raise

        # saltar páginas usando nextLink (si alguien usa page>1)
        for _ in range(1, page):
            nxt = data.get("@odata.nextLink") if isinstance(data, dict) else None
            if not nxt:
                return [], (page - 1) * page_size
            data = self._get_json_any(nxt)

        items: List[Dict[str, Any]] = []
        for it in (data.get("value") or []) if isinstance(data, dict) else []:
            cid, meta = self._parse_item(it)
            if cid:
                items.append({"id": cid, **meta})

        # Total aproximado (igual a tu implementación actual)
        total = (page - 1) * page_size + len(items) + (1 if isinstance(data, dict) and data.get("@odata.nextLink") else 0)
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
