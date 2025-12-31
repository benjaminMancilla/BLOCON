from __future__ import annotations

import os
from typing import Any, Dict, List

from .utils import default_user_data_dir

from .repositories import (
    ComponentsCacheRepo,
    FailuresCacheRepo,
    JsonRepo,
    JsonlRepo,
    DraftRepo,
    DraftsRepo,
    DiagramViewRepo,
)


class LocalWorkspaceStore:
    """
    Facade local: agrupa las 3 áreas que quieres sacar de CloudClient:
      1) eventos locales (JSONL)
      2) snapshot local (JSON)
      3) caches (components + failures)

    Además incluye manifest local (porque hoy CloudClient también lo persiste local).
    """

    def __init__(
        self,
        workspace_dir: str | None = None,
        *,
        data_dirname: str = "data",
        cache_dirname: str = "cache",
        snapshot_filename: str = "snapshot.json",
        manifest_filename: str = "components.manifest.json",
        events_filename: str = "events.jsonl",
    ):
        base = workspace_dir or default_user_data_dir(app_name="BLOCON")

        self.cache_dir = os.path.join(base, cache_dirname)
        os.makedirs(self.cache_dir, exist_ok=True)

        self.data_dir = os.path.join(base, data_dirname)
        os.makedirs(self.data_dir, exist_ok=True)

        self.snapshot = JsonRepo(
            path=os.path.join(self.data_dir, snapshot_filename),
            add_saved_at=True,
        )
        self.manifest = JsonRepo(
            path=os.path.join(self.data_dir, manifest_filename),
            add_saved_at=True,
        )
        self.events = JsonlRepo(
            path=os.path.join(self.data_dir, events_filename),
        )

        self.components_cache = ComponentsCacheRepo(data_dir=self.cache_dir)
        self.failures_cache = FailuresCacheRepo(data_dir=self.cache_dir)
        self.draft = DraftRepo(data_dir=self.data_dir)
        self.drafts = DraftsRepo(data_dir=self.data_dir)
        self.diagram_view = DiagramViewRepo(data_dir=self.cache_dir)

    # --- snapshot ---
    def load_snapshot(self) -> Dict[str, Any]:
        v = self.snapshot.load({})
        return v if isinstance(v, dict) else {}

    def save_snapshot(self, snapshot: Dict[str, Any]) -> None:
        self.snapshot.save(dict(snapshot or {}))

    # --- manifest ---
    def load_manifest(self) -> Dict[str, Any]:
        v = self.manifest.load({})
        return v if isinstance(v, dict) else {}

    def save_manifest(self, manifest: Dict[str, Any]) -> None:
        self.manifest.save(dict(manifest or {}))

    # --- events ---
    def load_events(self) -> List[dict]:
        return self.events.load_all()

    def append_events(self, events: List[dict]) -> int:
        self._validate_event_versions(events, context="append_events")
        return self.events.append_many(events or [])

    def replace_events(self, events: List[dict]) -> None:
        self._validate_event_versions(events, context="replace_events")
        self.events.replace_all(events or [])

        # dentro de LocalWorkspaceStore
    def eventsourcing_events_path(self, filename: str = "events.local.jsonl") -> str:
        d = os.path.join(self.data_dir, "eventsourcing")
        os.makedirs(d, exist_ok=True)
        return os.path.join(d, filename)
    
    def _validate_event_versions(self, events: List[dict], context: str) -> None:
        invalid_indices = [
            idx
            for idx, ev in enumerate(events or [])
            if isinstance(ev, dict) and ev.get("version") is None
        ]
        if invalid_indices:
            sample = ", ".join(str(idx) for idx in invalid_indices[:5])
            raise ValueError(
                f"LocalWorkspaceStore.{context}: event version is None "
                f"(indices: {sample})"
            )


    # --- components cache ---
    def load_components_cache(self) -> Dict[str, Dict]:
        return self.components_cache.load()

    def upsert_components_cache(self, items: List[Dict[str, Any]]) -> Dict[str, Dict]:
        return self.components_cache.upsert_many(items)

    # --- failures cache ---
    def load_failures_cache(self) -> Dict[str, Any]:
        return self.failures_cache.load()

    def save_failures_cache(self, data: Dict[str, Any]) -> None:
        self.failures_cache.save(data)
    
        # --- diagram view ---
    def load_diagram_view(self) -> Dict[str, Any]:
        view = self.diagram_view.load()
        return view if isinstance(view, dict) else {"collapsedGateIds": []}

    def save_diagram_view(self, view: Dict[str, Any]) -> None:
        self.diagram_view.save(view or {})

    # --- components (fallback local) ---
    def fetch_components(self, ids: List[str]) -> Dict[str, Dict[str, Any]]:
        return self.components_cache.get_many(ids)

    def search_components(self, query: str, page: int = 1, page_size: int = 20):
        return self.components_cache.search(query=query, page=page, page_size=page_size)

    # --- failures (fallback local) ---
    def fetch_failures_by_ids(self, component_ids: List[str], page: int = 1, page_size: int = 200):
        return self.failures_cache.fetch_failures_by_ids(component_ids, page=page, page_size=page_size)

    # --- draft (fallback local) ---
    def draft_paths(self) -> Dict[str, str]:
        return self.draft.paths()

    def draft_exists_any(self) -> bool:
        return self.draft.exists_any()

    def draft_exists_complete(self) -> bool:
        return self.draft.exists_complete()

    def draft_load(self) -> tuple[Dict[str, Any], List[dict], Dict[str, Any]]:
        # (snapshot_dict, events_dicts, meta_dict)
        return self.draft.load_draft()

    def draft_save(self, *, snapshot: Dict[str, Any], events: List[dict], base_version: int) -> None:
        self.draft.save_draft(snapshot=snapshot, events=events, base_version=int(base_version))

    def draft_delete(self) -> None:
        self.draft.delete_draft()

    def draft_check(self, cloud_head: int) -> Dict[str, Any]:
        # status: missing | incomplete | ok | conflict | unknown
        return self.draft.check_against_cloud_head(int(cloud_head))

    def draft_delete_if_conflict(self, cloud_head: int) -> bool:
        return self.draft.delete_if_conflict(int(cloud_head))

   # --- drafts (multi) ---
    def drafts_list(self) -> List[Dict[str, Any]]:
        return self.drafts.list_drafts()

    def drafts_create(
        self,
        *,
        snapshot: Dict[str, Any],
        events: List[dict],
        base_version: int,
        name: str | None = None,
    ) -> Dict[str, Any]:
        return self.drafts.create_draft(
            snapshot=snapshot,
            events=events,
            base_version=int(base_version),
            name=name,
        )

    def drafts_save(
        self,
        *,
        draft_id: str,
        snapshot: Dict[str, Any],
        events: List[dict],
        base_version: int,
        name: str | None = None,
    ) -> Dict[str, Any]:
        return self.drafts.save_draft(
            draft_id=draft_id,
            snapshot=snapshot,
            events=events,
            base_version=int(base_version),
            name=name,
        )

    def drafts_rename(self, *, draft_id: str, name: str) -> Dict[str, Any]:
        return self.drafts.rename_draft(draft_id=draft_id, name=name)

    def drafts_delete(self, *, draft_id: str) -> bool:
        return self.drafts.delete_draft(draft_id=draft_id)

    def drafts_load(self, *, draft_id: str, cloud_head: int) -> Dict[str, Any]:
        return self.drafts.load_draft(draft_id=draft_id, cloud_head=int(cloud_head))

# Alias por compat / naming
LocalCloudStore = LocalWorkspaceStore
