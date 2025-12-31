from __future__ import annotations

import json
import time
from typing import Any, Optional

from ..settings import SPSettings, load_settings
from ..graph_session import GraphSession, GraphError
from ..resolver import SPResolver

from ....model.eventsourcing.events import event_from_dict


class SharePointEventsClient:
    """Cliente para leer/escribir eventos en SharePoint List + (opcional) Document Library para snapshots."""

    def __init__(
        self,
        *,
        settings: SPSettings,
        events_list_id: Optional[str] = None,
        events_list_name: Optional[str] = None,
        snapshots_library_id: Optional[str] = None,
        snapshots_library_name: Optional[str] = None,
        field_kind: str = "kind",
        field_ts: str = "ts",
        field_actor: str = "actor",
        field_version: str = "version",
        field_payload: str = "payload",
        field_snapshot_file: str = "snapshot_file",
        snapshot_threshold_bytes: int = 100 * 1024,
    ):
        self.settings = settings
        self.session = GraphSession(settings)
        self.resolver = SPResolver(self.session)

        self.events_list_id = events_list_id
        self.events_list_name = events_list_name

        self.snapshots_library_id = snapshots_library_id
        self.snapshots_library_name = snapshots_library_name

        self.field_kind = field_kind
        self.field_ts = field_ts
        self.field_actor = field_actor
        self.field_version = field_version
        self.field_payload = field_payload
        self.field_snapshot_file = field_snapshot_file

        try:
            self.snapshot_threshold_bytes = max(1024, int(snapshot_threshold_bytes))
        except Exception:
            self.snapshot_threshold_bytes = 100 * 1024

        # caches
        self._site_id: Optional[str] = None
        self._events_list_resolved_id: Optional[str] = None
        self._drive_id: Optional[str] = None

    @classmethod
    def from_env(cls, project_root: str | None = None, dotenv_path: str | None = None) -> "SharePointEventsClient":
        settings = load_settings(project_root=project_root, dotenv_path=dotenv_path)
        settings.site.validate()
        settings.events.validate()

        return cls(
            settings=settings,
            events_list_id=settings.events.list_id,
            events_list_name=settings.events.list_name,
            snapshots_library_id=settings.events.snapshots_library_id,
            snapshots_library_name=settings.events.snapshots_library_name,
            field_kind=settings.events.field_kind,
            field_ts=settings.events.field_ts,
            field_actor=settings.events.field_actor,
            field_version=settings.events.field_version,
            field_payload=settings.events.field_payload,
            field_snapshot_file=settings.events.field_snapshot_file,
            snapshot_threshold_bytes=settings.events.snapshot_threshold_bytes,
        )

    # ---------------- internals ----------------

    def _resolve_site_id(self) -> str:
        if self._site_id:
            return self._site_id
        self._site_id = self.resolver.site_id()
        return self._site_id

    def _resolve_events_list_id(self) -> str:
        if self._events_list_resolved_id:
            return self._events_list_resolved_id
        self._events_list_resolved_id = self.resolver.list_id(
            list_id=self.events_list_id,
            list_name=self.events_list_name,
        )
        return self._events_list_resolved_id

    def _has_snapshot_library(self) -> bool:
        return bool(self.snapshots_library_id or self.snapshots_library_name)

    def _resolve_snapshots_drive_id(self) -> str:
        if self._drive_id:
            return self._drive_id
        self._drive_id = self.resolver.drive_id(
            drive_id=self.snapshots_library_id,
            drive_name=self.snapshots_library_name,
        )
        return self._drive_id

    @staticmethod
    def _payload_size(obj: Any) -> int:
        try:
            return len(json.dumps(obj, ensure_ascii=False).encode("utf-8"))
        except Exception:
            try:
                return len(str(obj).encode("utf-8"))
            except Exception:
                return 0

    @staticmethod
    def _event_to_dict(ev: Any) -> Optional[dict]:
        if isinstance(ev, dict):
            return dict(ev)
        if hasattr(ev, "to_dict") and callable(getattr(ev, "to_dict")):
            try:
                return ev.to_dict()
            except Exception:
                return None
        if hasattr(ev, "__dict__"):
            try:
                return dict(ev.__dict__)
            except Exception:
                return None
        return None

    @staticmethod
    def _sanitize_for_filename(value: str) -> str:
        clean = []
        for ch in str(value or ""):
            if ch.isalnum() or ch in ("-", "_"):
                clean.append(ch)
            else:
                clean.append("-")
        out = "".join(clean).strip("-") or "snapshot"
        return out[:120]

    def _upload_snapshot_to_library(self, data: dict, version: int | None, ts: str | None) -> str:
        site_id = self._resolve_site_id()
        drive_id = self._resolve_snapshots_drive_id()

        safe_ts = self._sanitize_for_filename(ts or time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()))
        safe_v = str(version) if version is not None else "0"
        fname = f"event_snapshot_{safe_ts}_v{safe_v}.json"

        path = f"sites/{site_id}/drives/{drive_id}/root:/{fname}:/content"
        payload = json.dumps(data or {}, ensure_ascii=False).encode("utf-8")
        res = self.session.put_bytes(path, payload, content_type="application/json")

        # guardamos el nombre usado como referencia (compat con tu lógica actual)
        if isinstance(res, dict):
            return res.get("name") or fname
        return fname

    def _download_snapshot_from_library(self, doc_ref: str) -> dict:
        if not doc_ref:
            return {}

        site_id = self._resolve_site_id()
        drive_id = self._resolve_snapshots_drive_id()

        # compat: si viene como "path/name.json" o "name.json", bajar por root:/...:/content
        if "/" in doc_ref or str(doc_ref).endswith(".json"):
            path_part = str(doc_ref).strip("/")
            path = f"sites/{site_id}/drives/{drive_id}/root:/{path_part}:/content"
        else:
            # si algún día guardas item-id, esto también funciona:
            path = f"sites/{site_id}/drives/{drive_id}/items/{doc_ref}/content"

        data = self.session.get_json(path)
        return data if isinstance(data, dict) else {}

    def _post_event_fields(self, fields: dict) -> None:
        site_id = self._resolve_site_id()
        list_id = self._resolve_events_list_id()
        path = f"sites/{site_id}/lists/{list_id}/items"
        self.session.post_json(path, {"fields": fields})

    @staticmethod
    def _escape_odata(value: str) -> str:
        return (value or "").replace("'", "''")

    def _query_events_filtered(
        self,
        *,
        filter_clause: str,
        offset: int,
        limit: int,
        order_by: str | None = None,
    ) -> tuple[list[dict], int]:
        site_id = self._resolve_site_id()
        list_id = self._resolve_events_list_id()

        select_fields = [
            self.field_kind,
            self.field_ts,
            self.field_actor,
            self.field_version,
            self.field_payload,
            self.field_snapshot_file,
        ]
        select_fields = [f for f in select_fields if f]

        limit = max(1, int(limit))
        offset = max(0, int(offset))

        params: dict[str, str] = {
            "$select": "id,fields",
            "$expand": f"fields($select={','.join(select_fields)})",
            "$filter": filter_clause,
            "$top": str(min(limit, 200)),
        }

        if order_by:
            params["$orderby"] = f"fields/{order_by} asc"

        path = f"sites/{site_id}/lists/{list_id}/items"

        data = self.session.request_json("GET", path, params=params)
        total = 0

        out: list[dict] = []
        skip_remaining = offset

        while True:
            items = data.get("value", []) if isinstance(data, dict) else []
            total += len(items)

            for it in items:
                if skip_remaining > 0:
                    skip_remaining -= 1
                    continue
                if len(out) >= limit:
                    continue
                fields = (it or {}).get("fields") or {}
                ev_dict = self._build_event_dict(fields)
                if not ev_dict:
                    continue
                try:
                    ev_obj = event_from_dict(ev_dict)
                    out.append(ev_obj.to_dict())
                except Exception:
                    continue

            next_link = data.get("@odata.nextLink") if isinstance(data, dict) else None
            if not next_link:
                break
            data = self.session.request_json("GET", next_link)

        return out, total
    
    # ---------------- public API ----------------

    def get_max_version(self) -> int:
        if not self.field_version:
            return 0

        try:
            site_id = self._resolve_site_id()
            list_id = self._resolve_events_list_id()
            params = {
                "$orderby": f"fields/{self.field_version} desc",
                "$top": "1",
                "$expand": "fields",
            }
            path = f"sites/{site_id}/lists/{list_id}/items"
            data = self.session.request_json("GET", path, params=params)
            items = data.get("value", []) if isinstance(data, dict) else []
            if not items:
                return 0
            fields = (items[0] or {}).get("fields") or {}
            value = fields.get(self.field_version)
            if value is None:
                return 0
            try:
                int_version = int(value)
                return int_version
            except Exception:
                return 0
        except Exception:
            return 0

    def append_events(self, events: list[dict]) -> int:
        if not events:
            return 0

        done = 0
        for raw in events:
            ev = self._event_to_dict(raw)
            if not ev:
                continue

            snapshot_ref: Optional[str] = None
            payload_for_list: dict = dict(ev)
            payload_text: str = ""

            if ev.get("kind") == "snapshot":
                data_obj = ev.get("data") or {}
                if self._has_snapshot_library():
                    try:
                        snapshot_ref = self._upload_snapshot_to_library(
                            data_obj,
                            ev.get("version"),
                            ev.get("ts"),
                        )
                        payload_for_list = {k: v for k, v in ev.items() if k != "data"}
                        payload_text = json.dumps(payload_for_list, ensure_ascii=False)
                    except Exception:
                        snapshot_ref = None

                if snapshot_ref is None:
                    try:
                        payload_text = json.dumps(payload_for_list, ensure_ascii=False)
                    except Exception:
                        payload_text = ""

            else:
                try:
                    payload_text = json.dumps(payload_for_list, ensure_ascii=False)
                except Exception:
                    payload_text = ""

            fields = {}
            if self.field_kind:
                fields[self.field_kind] = ev.get("kind")
            if self.field_ts:
                fields[self.field_ts] = ev.get("ts")
            if self.field_actor:
                fields[self.field_actor] = ev.get("actor")
            if self.field_version and ev.get("version") is not None:
                try:
                    fields[self.field_version] = int(ev.get("version"))
                except Exception:
                    fields[self.field_version] = ev.get("version")
            if self.field_payload:
                fields[self.field_payload] = payload_text
            if snapshot_ref and self.field_snapshot_file:
                fields[self.field_snapshot_file] = snapshot_ref

            self._post_event_fields(fields)
            done += 1

        return done

    def _build_event_dict(self, fields: dict) -> Optional[dict]:
        payload_raw = fields.get(self.field_payload) or ""
        payload_dict = {}
        if payload_raw:
            try:
                payload_dict = json.loads(payload_raw)
            except Exception as e:
                print(f"[_build_event_dict] Failed to parse payload JSON: {e}")
                payload_dict = {}

        ev = dict(payload_dict or {})
        ev["payload"] = payload_raw

        if self.field_kind and fields.get(self.field_kind) is not None:
            ev["kind"] = fields.get(self.field_kind)
        if self.field_ts and fields.get(self.field_ts) is not None:
            ev["ts"] = fields.get(self.field_ts)
        if self.field_actor and fields.get(self.field_actor) is not None:
            ev["actor"] = fields.get(self.field_actor)
        if self.field_version and fields.get(self.field_version) is not None:
            try:
                ev["version"] = int(fields.get(self.field_version))
            except Exception:
                ev["version"] = fields.get(self.field_version)

        doc_ref = fields.get(self.field_snapshot_file)
        if doc_ref:
            try:
                ev["data"] = self._download_snapshot_from_library(str(doc_ref))
                ev.setdefault("kind", "snapshot")
            except Exception:
                return None

        return ev if ev.get("kind") and ev.get("ts") else None

    def load_events(self, from_version: int = 0) -> list[dict]:
        site_id = self._resolve_site_id()
        list_id = self._resolve_events_list_id()

        select_fields = [
            self.field_kind,
            self.field_ts,
            self.field_actor,
            self.field_version,
            self.field_payload,
            self.field_snapshot_file,
        ]
        select_fields = [f for f in select_fields if f]

        params = {
            "$select": "id,fields",
            "$expand": f"fields($select={','.join(select_fields)})",
        }

        if self.field_version:
            params["$orderby"] = f"fields/{self.field_version} asc"
            if from_version and int(from_version) > 0:
                params["$filter"] = f"fields/{self.field_version} ge {int(from_version)}"

        path = f"sites/{site_id}/lists/{list_id}/items"
        data = self.session.get_json(path, params=params)

        out: list[dict] = []
        while True:
            for it in (data.get("value", []) if isinstance(data, dict) else []):
                fields = (it or {}).get("fields") or {}
                ev_dict = self._build_event_dict(fields)
                if not ev_dict:
                    continue
                if from_version and ev_dict.get("version") is not None and ev_dict["version"] < from_version:
                    continue
                try:
                    ev_obj = event_from_dict(ev_dict)
                    out.append(ev_obj.to_dict())
                except Exception:
                    continue

            next_link = data.get("@odata.nextLink") if isinstance(data, dict) else None
            if not next_link:
                break
            data = self.session.get_json(next_link)

        return out
    
    def search_events_by_version(self, version: int, offset: int = 0, limit: int = 50) -> tuple[list[dict], int]:
        if not self.field_version:
            return [], 0
        try:
            version_value = int(version)
        except Exception:
            return [], 0

        filter_clause = f"fields/{self.field_version} eq {version_value}"
        order_by = self.field_version or self.field_ts
        return self._query_events_filtered(
            filter_clause=filter_clause,
            offset=offset,
            limit=limit,
            order_by=order_by,
        )

    def search_events_by_kind(
        self,
        *,
        kind_prefix: str | None = None,
        kinds: list[str] | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> tuple[list[dict], int]:
        if not self.field_kind:
            return [], 0

        clauses = []
        if kind_prefix:
            escaped_prefix = self._escape_odata(kind_prefix)
            clauses.append(f"startswith(fields/{self.field_kind}, '{escaped_prefix}')")

        for kind in sorted({k for k in (kinds or []) if k}):
            escaped_kind = self._escape_odata(str(kind))
            clauses.append(f"fields/{self.field_kind} eq '{escaped_kind}'")

        if not clauses:
            return [], 0

        filter_clause = " or ".join(f"({clause})" for clause in clauses)
        order_by = self.field_version or self.field_ts
        return self._query_events_filtered(
            filter_clause=filter_clause,
            offset=offset,
            limit=limit,
            order_by=order_by,
        )

    def search_events_by_timestamp(
        self, timestamp_prefix: str, offset: int = 0, limit: int = 50
    ) -> tuple[list[dict], int]:
        if not self.field_ts or not timestamp_prefix:
            return [], 0

        escaped = self._escape_odata(timestamp_prefix)
        filter_clause = f"startswith(fields/{self.field_ts}, '{escaped}')"
        order_by = self.field_version or self.field_ts
        return self._query_events_filtered(
            filter_clause=filter_clause,
            offset=offset,
            limit=limit,
            order_by=order_by,
        )
