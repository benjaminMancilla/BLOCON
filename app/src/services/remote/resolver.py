from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .graph_session import GraphSession


def escape_odata_literal(value: str) -> str:
    # OData: las comillas simples se escapan duplicándolas
    return value.replace("'", "''")


@dataclass
class SPResolver:
    """
    Resuelve y cachea:
    - site_id (desde hostname:path)
    - list_id (desde id o displayName)
    - drive_id (desde id o nombre de library)
    """
    session: GraphSession

    _site_id_cache: Optional[str] = None

    def site_id(self) -> str:
        # Si settings ya trae site_id, úsalo
        if self._site_id_cache:
            return self._site_id_cache

        s = self.session.s.site
        if s.site_id:
            self._site_id_cache = s.site_id
            return s.site_id

        # si no hay site_id, resolver por hostname:path
        s.validate()
        url = f"sites/{s.hostname}:{s.path}"
        data = self.session.get_json(url)
        sid = data.get("id")
        if not sid:
            raise RuntimeError(f"Cannot resolve site id: {data}")
        self._site_id_cache = str(sid)
        return self._site_id_cache

    def list_id(self, *, list_id: str | None, list_name: str | None) -> str:
        site_id = self.site_id()

        # Si viene id, validarlo (si 404, caer a nombre)
        if list_id:
            try:
                self.session.get_json(
                    f"sites/{site_id}/lists/{list_id}",
                    params={"$select": "id,displayName"},
                )
                return list_id
            except Exception as e:
                if "404" not in str(e):
                    raise
                list_id = None

        if not list_name:
            raise RuntimeError("Missing list_id or list_name")

        params = {
            "$select": "id,displayName",
            "$filter": f"displayName eq '{escape_odata_literal(list_name)}'",
        }
        data = self.session.get_json(f"sites/{site_id}/lists", params=params)
        vals = data.get("value", []) if isinstance(data, dict) else []
        if not vals:
            raise RuntimeError(f"Cannot find list '{list_name}'")
        lid = vals[0].get("id")
        if not lid:
            raise RuntimeError(f"List '{list_name}' missing id: {vals[0]}")
        return str(lid)

    def drive_id(self, *, drive_id: str | None, drive_name: str | None) -> str:
        site_id = self.site_id()

        if drive_id:
            # validar drive
            try:
                self.session.get_json(
                    f"sites/{site_id}/drives/{drive_id}",
                    params={"$select": "id,name,driveType"},
                )
                return drive_id
            except Exception as e:
                if "404" not in str(e):
                    raise
                drive_id = None

        if not drive_name:
            raise RuntimeError("Missing drive_id or drive_name")

        data = self.session.get_json(f"sites/{site_id}/drives")
        for it in data.get("value", []) if isinstance(data, dict) else []:
            if not isinstance(it, dict):
                continue
            if it.get("name") == drive_name or it.get("displayName") == drive_name:
                did = it.get("id")
                if did:
                    return str(did)

        raise RuntimeError(f"Cannot find drive/library '{drive_name}'")
