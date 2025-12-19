from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

try:
    from dotenv import load_dotenv, find_dotenv
except Exception:
    load_dotenv = None
    find_dotenv = None


@dataclass(frozen=True)
class SPSiteSettings:
    site_id: Optional[str]
    hostname: Optional[str]
    path: Optional[str]

    def validate(self) -> None:
        # Site id o (hostname+path)
        if self.site_id:
            return
        if not (self.hostname and self.path):
            raise RuntimeError("Missing SP_SITE_ID or (SP_SITE_HOSTNAME + SP_SITE_PATH)")


@dataclass(frozen=True)
class SPEventsSettings:
    list_id: Optional[str]
    list_name: Optional[str]

    snapshots_library_id: Optional[str]
    snapshots_library_name: Optional[str]

    field_kind: str
    field_ts: str
    field_actor: str
    field_version: str
    field_payload: str
    field_snapshot_file: str

    snapshot_threshold_bytes: int = 100 * 1024  # default 100KB

    def validate(self) -> None:
        if not (self.list_id or self.list_name):
            raise RuntimeError("Missing SP_EVENTS_LIST_ID or SP_EVENTS_LIST_NAME")


@dataclass(frozen=True)
class SPFailuresSettings:
    list_id: Optional[str]
    list_name: Optional[str]

    field_component: str
    field_date: str
    field_type: str

    def validate(self) -> None:
        if not (self.list_id or self.list_name):
            raise RuntimeError("Missing SP_FAILURES_LIST_ID or SP_FAILURES_LIST_NAME")


@dataclass(frozen=True)
class SPComponentsSettings:
    list_id: Optional[str]
    list_name: Optional[str]

    field_id: str
    field_name: str
    field_subtype: str
    field_type: str
    field_insid: str

    def validate(self) -> None:
        if not (self.list_id or self.list_name):
            raise RuntimeError("Missing SP_COMPONENTS_LIST_ID or SP_COMPONENTS_LIST_NAME")


@dataclass(frozen=True)
class SPSettings:
    tenant_id: str
    client_id: str
    client_secret: str

    graph_base: str
    scope: str
    timeout_s: int

    site: SPSiteSettings
    events: SPEventsSettings
    failures: SPFailuresSettings
    components: SPComponentsSettings

    def validate(self) -> None:
        if not (self.tenant_id and self.client_id and self.client_secret):
            raise RuntimeError("Missing SP_TENANT_ID / SP_CLIENT_ID / SP_CLIENT_SECRET")
        self.site.validate()
        # Ojo: puedes usar solo algunos módulos (por eso no forzamos validate de todo aquí)
        # Si quieres validarlos todos, descomenta:
        # self.events.validate()
        # self.failures.validate()
        # self.components.validate()


def _load_env(project_root: str | None = None, dotenv_path: str | None = None) -> None:
    """Carga .env una sola vez, si python-dotenv está disponible."""
    if load_dotenv is None:
        return

    if dotenv_path:
        load_dotenv(dotenv_path, override=False)
        return

    if project_root:
        p = os.path.join(project_root, ".env")
        load_dotenv(p, override=False)
        return

    # fallback: busca .env desde cwd
    if find_dotenv is not None:
        p = find_dotenv(usecwd=True) or ""
        if p:
            load_dotenv(p, override=False)


def _getenv(key: str, default: str = "") -> str:
    return (os.getenv(key) or default).strip()


def load_settings(project_root: str | None = None, dotenv_path: str | None = None) -> SPSettings:
    """
    Carga settings desde env (.env) siguiendo tus variables.

    Nota: no obliga a que Events/Failures/Components estén completos, porque
    puedes instanciar solo algunos clientes. Cada sub-settings tiene validate().
    """
    _load_env(project_root=project_root, dotenv_path=dotenv_path)

    tenant_id = _getenv("SP_TENANT_ID")
    client_id = _getenv("SP_CLIENT_ID")
    client_secret = _getenv("SP_CLIENT_SECRET")

    graph_base = _getenv("SP_GRAPH_BASE", "https://graph.microsoft.com/v1.0")
    scope = _getenv("SP_GRAPH_SCOPE", "https://graph.microsoft.com/.default")

    timeout_s = 30
    try:
        t = _getenv("SP_TIMEOUT_S", "")
        if t:
            timeout_s = int(float(t))
    except Exception:
        timeout_s = 30

    site = SPSiteSettings(
        site_id=_getenv("SP_SITE_ID", "") or None,
        hostname=_getenv("SP_SITE_HOSTNAME", "") or None,
        path=_getenv("SP_SITE_PATH", "") or None,
    )

    # Events
    snapshot_threshold_bytes = 100 * 1024
    try:
        th = _getenv("SP_EVENTS_SNAPSHOT_THRESHOLD_KB", "")
        if th:
            snapshot_threshold_bytes = int(float(th)) * 1024
    except Exception:
        snapshot_threshold_bytes = 100 * 1024

    events = SPEventsSettings(
        list_id=_getenv("SP_EVENTS_LIST_ID", "") or None,
        list_name=_getenv("SP_EVENTS_LIST_NAME", "") or None,
        snapshots_library_id=_getenv("SP_SNAPSHOTS_LIBRARY_ID", "") or None,
        snapshots_library_name=_getenv("SP_SNAPSHOTS_LIBRARY_NAME", "") or None,
        field_kind=_getenv("SP_EVENTS_FIELD_KIND", "kind"),
        field_ts=_getenv("SP_EVENTS_FIELD_TS", "ts"),
        field_actor=_getenv("SP_EVENTS_FIELD_ACTOR", "actor"),
        field_version=_getenv("SP_EVENTS_FIELD_VERSION", "version"),
        field_payload=_getenv("SP_EVENTS_FIELD_PAYLOAD", "payload"),
        field_snapshot_file=_getenv("SP_EVENTS_FIELD_SNAPSHOT_FILE", "snapshot_file"),
        snapshot_threshold_bytes=snapshot_threshold_bytes,
    )

    failures = SPFailuresSettings(
        list_id=_getenv("SP_FAILURES_LIST_ID", "") or None,
        list_name=_getenv("SP_FAILURES_LIST_NAME", "") or None,
        field_component=_getenv("SP_FAILURES_FIELD_COMPONENT", "Component_ID"),
        field_date=_getenv("SP_FAILURES_FIELD_DATE", "failure_date"),
        field_type=_getenv("SP_FAILURES_FIELD_TYPE", "type_failure"),
    )

    components = SPComponentsSettings(
        list_id=_getenv("SP_COMPONENTS_LIST_ID", "") or None,
        list_name=_getenv("SP_COMPONENTS_LIST_NAME", "") or None,
        field_id=_getenv("SP_COMPONENTS_FIELD_ID", "kks"),
        field_name=_getenv("SP_COMPONENTS_FIELD_NAME", "kks_name"),
        field_subtype=_getenv("SP_COMPONENTS_FIELD_SUBTYPE", "Subtype_Text"),
        field_type=_getenv("SP_COMPONENTS_FIELD_TYPE", "Type_text"),
        field_insid=_getenv("SP_COMPONENTS_FIELD_INSID", "insID"),
    )

    s = SPSettings(
        tenant_id=tenant_id,
        client_id=client_id,
        client_secret=client_secret,
        graph_base=graph_base.rstrip("/"),
        scope=scope,
        timeout_s=timeout_s,
        site=site,
        events=events,
        failures=failures,
        components=components,
    )
    # Validación mínima: credenciales + site info
    s.validate()
    return s
