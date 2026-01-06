from __future__ import annotations

import os
import sys
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

    snapshot_threshold_bytes: int = 100 * 1024

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


_env_loaded = False
_env_path_used: Optional[str] = None


def _find_env_file() -> Optional[str]:
    """
    Busca el archivo .env en el siguiente orden:
    1. Junto al ejecutable (PyInstaller)
    2. En bin/.env si el ejecutable está en bin/
    3. En el directorio app/ del proyecto
    4. En el directorio raíz del proyecto
    5. Usando find_dotenv() como fallback
    """
    candidates = []
    
    if getattr(sys, 'frozen', False):
        exe_dir = os.path.dirname(sys.executable)
        candidates.append(os.path.join(exe_dir, ".env"))
        candidates.append(os.path.join(os.path.dirname(exe_dir), ".env"))
    
    module_dir = os.path.dirname(os.path.abspath(__file__))

    current = module_dir
    for _ in range(5):
        candidates.append(os.path.join(current, ".env"))
        if os.path.basename(current) == "app":
            candidates.append(os.path.join(os.path.dirname(current), ".env"))
            break
        current = os.path.dirname(current)
    
    candidates.append(os.path.join(os.getcwd(), ".env"))
    
    cwd = os.getcwd()
    for _ in range(3):
        cwd = os.path.dirname(cwd)
        candidates.append(os.path.join(cwd, ".env"))
    
    for path in candidates:
        if os.path.isfile(path):
            return path
    
    return None


def _load_env_once(project_root: str | None = None, dotenv_path: str | None = None) -> None:
    """
    Carga .env UNA SOLA VEZ por proceso.
    Llamadas subsecuentes son no-ops.
    """
    global _env_loaded, _env_path_used
    
    if _env_loaded:
        return
    
    if load_dotenv is None:
        print("Warning: python-dotenv not available, skipping .env loading", file=sys.stderr)
        _env_loaded = True
        return

    if dotenv_path:
        if os.path.isfile(dotenv_path):
            load_dotenv(dotenv_path, override=False)
            _env_path_used = dotenv_path
            print(f"Loaded .env from: {dotenv_path}", file=sys.stderr)
            _env_loaded = True
            return
        else:
            print(f"Warning: Specified .env not found: {dotenv_path}", file=sys.stderr)
    
    if project_root:
        p = os.path.join(project_root, ".env")
        if os.path.isfile(p):
            load_dotenv(p, override=False)
            _env_path_used = p
            print(f"Loaded .env from: {p}", file=sys.stderr)
            _env_loaded = True
            return
    
    env_path = _find_env_file()
    if env_path:
        load_dotenv(env_path, override=False)
        _env_path_used = env_path
        print(f"Loaded .env from: {env_path}", file=sys.stderr)
        _env_loaded = True
        return
    
    if find_dotenv is not None:
        p = find_dotenv(usecwd=True) or ""
        if p and os.path.isfile(p):
            load_dotenv(p, override=False)
            _env_path_used = p
            print(f"Loaded .env from: {p}", file=sys.stderr)
            _env_loaded = True
            return
    
    print("Warning: No .env file found. SharePoint integration may not work.", file=sys.stderr)
    _env_loaded = True


def _getenv(key: str, default: str = "") -> str:
    return (os.getenv(key) or default).strip()


def load_settings(project_root: str | None = None, dotenv_path: str | None = None) -> SPSettings:
    """Carga settings desde env (.env) - con cache de .env."""
    _load_env_once(project_root=project_root, dotenv_path=dotenv_path)

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
    s.validate()
    return s
