from __future__ import annotations

import json
import os
from typing import Optional

from ..settings import SPSettings, load_settings
from ..graph_session import GraphSession, GraphError
from ..resolver import SPResolver


class SharePointSnapshotClient:
    """
    Cliente para snapshot global en biblioteca de documentos (Drive) vía Graph.
    - Mantiene la API: from_env(), load_snapshot(), save_snapshot()
    - Refactor: usa GraphSession + SPResolver
    """

    def __init__(
        self,
        *,
        settings: SPSettings,
        snapshots_library_id: Optional[str] = None,
        snapshots_library_name: Optional[str] = None,
        snapshot_filename: str = "snapshot_global.json",
    ):
        self.settings = settings
        self.session = GraphSession(settings)
        self.resolver = SPResolver(self.session)

        # Drive (library) donde vive el snapshot
        self.snapshots_library_id = snapshots_library_id or settings.events.snapshots_library_id
        self.snapshots_library_name = snapshots_library_name or settings.events.snapshots_library_name

        self.snapshot_filename = (snapshot_filename or "snapshot_global.json").strip() or "snapshot_global.json"

        self._resolved_drive_id: Optional[str] = None

    @classmethod
    def from_env(cls, project_root: str | None = None, dotenv_path: str | None = None) -> "SharePointSnapshotClient":
        """
        Mantiene firma. Construye settings desde .env.
        """
        settings = load_settings(project_root=project_root, dotenv_path=dotenv_path)
        settings.site.validate()

        # Este nombre existe en tu versión anterior del cliente :contentReference[oaicite:1]{index=1}
        snapshot_filename = (os.getenv("SP_GLOBAL_SNAPSHOT_FILE") or "snapshot_global.json").strip() or "snapshot_global.json"

        # Para snapshot necesitas sí o sí una library (id o nombre)
        lib_id = settings.events.snapshots_library_id
        lib_name = settings.events.snapshots_library_name
        if not (lib_id or lib_name):
            raise RuntimeError("Missing SP_SNAPSHOTS_LIBRARY_ID or SP_SNAPSHOTS_LIBRARY_NAME")

        return cls(
            settings=settings,
            snapshot_filename=snapshot_filename,
        )

    def _resolve_drive_id(self) -> str:
        if self._resolved_drive_id:
            return self._resolved_drive_id

        did = self.resolver.drive_id(
            drive_id=self.snapshots_library_id,
            drive_name=self.snapshots_library_name,
        )
        self._resolved_drive_id = did
        return did

    def save_snapshot(self, snapshot: dict) -> None:
        site_id = self.resolver.site_id()
        drive_id = self._resolve_drive_id()
        fname = self.snapshot_filename

        # PUT content al archivo
        path = f"sites/{site_id}/drives/{drive_id}/root:/{fname}:/content"
        payload = json.dumps(snapshot or {}, ensure_ascii=False).encode("utf-8")
        self.session.put_bytes(path, payload, content_type="application/json")

    def load_snapshot(self) -> dict:
        site_id = self.resolver.site_id()
        drive_id = self._resolve_drive_id()
        fname = self.snapshot_filename

        path = f"sites/{site_id}/drives/{drive_id}/root:/{fname}:/content"

        try:
            # El endpoint /content devuelve el JSON del archivo (no un objeto Graph),
            # pero igual se parsea como JSON y queda dict.
            data = self.session.get_json(path)
            return data if isinstance(data, dict) else {}
        except GraphError as e:
            if e.status_code == 404:
                return {}
            raise
