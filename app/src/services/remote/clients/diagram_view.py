from __future__ import annotations

import json
import os
from typing import Optional

from ..settings import SPSettings, load_settings
from ..graph_session import GraphSession, GraphError
from ..resolver import SPResolver


class SharePointDiagramViewClient:
    """Cliente para la vista global en biblioteca de documentos vía Graph."""

    def __init__(
        self,
        *,
        settings: SPSettings,
        views_library_id: Optional[str] = None,
        views_library_name: Optional[str] = None,
        view_filename: str = "diagram_view.global.json",
    ) -> None:
        self.settings = settings
        self.session = GraphSession(settings)
        self.resolver = SPResolver(self.session)

        self.views_library_id = views_library_id or settings.events.snapshots_library_id
        self.views_library_name = views_library_name or settings.events.snapshots_library_name
        self.view_filename = (view_filename or "diagram_view.global.json").strip() or "diagram_view.global.json"

        self._resolved_drive_id: Optional[str] = None

    @classmethod
    def from_env(
        cls,
        project_root: str | None = None,
        dotenv_path: str | None = None,
    ) -> "SharePointDiagramViewClient":
        settings = load_settings(project_root=project_root, dotenv_path=dotenv_path)
        settings.site.validate()

        view_filename = (os.getenv("SP_GLOBAL_VIEW_FILE") or "diagram_view.global.json").strip() or "diagram_view.global.json"
        lib_id = os.getenv("SP_GLOBAL_VIEW_LIBRARY_ID") or settings.events.snapshots_library_id
        lib_name = os.getenv("SP_GLOBAL_VIEW_LIBRARY_NAME") or settings.events.snapshots_library_name

        if not (lib_id or lib_name):
            raise RuntimeError("Missing SP_GLOBAL_VIEW_LIBRARY_ID or SP_GLOBAL_VIEW_LIBRARY_NAME")

        return cls(
            settings=settings,
            views_library_id=lib_id or None,
            views_library_name=lib_name or None,
            view_filename=view_filename,
        )

    def _resolve_drive_id(self) -> str:
        if self._resolved_drive_id:
            return self._resolved_drive_id
        did = self.resolver.drive_id(
            drive_id=self.views_library_id,
            drive_name=self.views_library_name,
        )
        self._resolved_drive_id = did
        return did

    def load_global_view(self) -> dict | None:
        site_id = self.resolver.site_id()
        drive_id = self._resolve_drive_id()
        fname = self.view_filename
        path = f"sites/{site_id}/drives/{drive_id}/root:/{fname}:/content"

        try:
            data = self.session.get_json(path)
        except GraphError as exc:
            if exc.status_code == 404:
                return None
            raise
        return data if isinstance(data, dict) else {}

    def save_global_view(self, view: dict) -> None:
        site_id = self.resolver.site_id()
        drive_id = self._resolve_drive_id()
        fname = self.view_filename
        path = f"sites/{site_id}/drives/{drive_id}/root:/{fname}:/content"
        payload = json.dumps(view or {}, ensure_ascii=False).encode("utf-8")
        self.session.put_bytes(path, payload, content_type="application/json")

    def delete_global_view(self) -> bool:
        site_id = self.resolver.site_id()
        drive_id = self._resolve_drive_id()
        fname = self.view_filename
        path = f"sites/{site_id}/drives/{drive_id}/root:/{fname}"

        try:
            self.session.delete(path)
            return True
        except GraphError as exc:
            if exc.status_code == 404:
                return False
            raise