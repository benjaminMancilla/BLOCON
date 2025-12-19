from __future__ import annotations

from typing import Iterable, Optional

from ..settings import SPSettings, load_settings
from ..graph_session import GraphSession
from ..resolver import SPResolver, escape_odata_literal


class SharePointFailuresClient:
    """
    Cliente de sólo lectura para la lista de fallas en SharePoint vía Microsoft Graph.
    Refactor: usa GraphSession + SPResolver.
    """

    def __init__(
        self,
        *,
        settings: SPSettings,
        failures_list_id: Optional[str] = None,
        failures_list_name: Optional[str] = None,
        field_component: Optional[str] = None,
        field_date: Optional[str] = None,
        field_type: Optional[str] = None,
    ):
        self.settings = settings
        self.session = GraphSession(settings)
        self.resolver = SPResolver(self.session)

        # Permite override; si no, toma defaults desde settings.failures
        self.failures_list_id = failures_list_id or settings.failures.list_id
        self.failures_list_name = failures_list_name or settings.failures.list_name

        self.field_component = field_component or settings.failures.field_component
        self.field_date = field_date or settings.failures.field_date
        self.field_type = field_type or settings.failures.field_type

        # cache interno
        self._resolved_list_id: Optional[str] = None

    @classmethod
    def from_env(cls, project_root: str | None = None, dotenv_path: str | None = None) -> "SharePointFailuresClient":
        """
        Mantiene firma. Construye settings desde .env.
        """
        settings = load_settings(project_root=project_root, dotenv_path=dotenv_path)
        # Validación específica de este cliente
        settings.site.validate()
        settings.failures.validate()

        return cls(settings=settings)

    @staticmethod
    def _chunk(xs: list[str], n: int) -> Iterable[list[str]]:
        step = max(1, int(n))
        for i in range(0, len(xs), step):
            yield xs[i : i + step]

    def _resolve_failures_list_id(self) -> str:
        if self._resolved_list_id:
            return self._resolved_list_id

        lid = self.resolver.list_id(
            list_id=self.failures_list_id,
            list_name=self.failures_list_name,
        )
        self._resolved_list_id = lid
        return lid

    def fetch_failures_for_components(
        self,
        component_ids: list[str],
        *,
        chunk_size: int = 10,
        top: int = 999,
    ) -> list[dict]:
        """
        Firma compatible: recibe IDs y retorna filas normalizadas:
          {"ID", "Component_ID", "failure_date", "type_failure"}
        """
        comp_ids = [str(c).strip() for c in (component_ids or []) if str(c).strip()]
        if not comp_ids:
            return []

        site_id = self.resolver.site_id()
        list_id = self._resolve_failures_list_id()

        fcomp = self.field_component
        fdate = self.field_date
        ftype = self.field_type

        rows: list[dict] = []
        safe_top = str(min(max(1, int(top)), 999))

        for batch in self._chunk(comp_ids, chunk_size):
            clauses = [f"fields/{fcomp} eq '{escape_odata_literal(cid)}'" for cid in batch]
            odata_filter = " or ".join(clauses)

            path = f"sites/{site_id}/lists/{list_id}/items"
            params = {
                "$select": "id,fields",
                "$expand": f"fields($select={fcomp},{fdate},{ftype})",
                "$filter": odata_filter,
                "$top": safe_top,
            }

            data = self.session.get_json(path, params=params)

            while True:
                vals = data.get("value", []) if isinstance(data, dict) else []
                for it in vals:
                    fields = (it or {}).get("fields") or {}
                    rows.append(
                        {
                            "ID": it.get("id"),
                            "Component_ID": str(fields.get(fcomp, "")).strip(),
                            "failure_date": fields.get(fdate),
                            "type_failure": fields.get(ftype),
                        }
                    )

                next_link = data.get("@odata.nextLink") if isinstance(data, dict) else None
                if not next_link:
                    break
                data = self.session.get_json(next_link)

        return rows
