from __future__ import annotations

import os
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Optional
import contextvars


@dataclass
class RuntimeContext:
    base_dir: Optional[str] = None
    appdata_dir: Optional[str] = None
    config_path: Optional[str] = None
    api_server: Optional[str] = None
    config_loaded: bool = False
    config_source: Optional[str] = None


_context = RuntimeContext()
_current_operation: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "cloud_operation",
    default=None,
)


def resolve_appdata_dir(app_name: str = "Blocon") -> str:
    env_override = os.getenv("BLOCON_APPDATA_DIR") or os.getenv("BLOCON_APPDATA")
    if env_override:
        return env_override

    if sys.platform == "win32":
        local_appdata = os.getenv("LOCALAPPDATA")
        if local_appdata:
            return os.path.join(local_appdata, "com.blocon.desktop", app_name)

    base = os.getenv("LOCALAPPDATA") or os.path.expanduser("~")
    return os.path.join(base, app_name)


def set_runtime_context(**kwargs: object) -> None:
    for key, value in kwargs.items():
        if hasattr(_context, key):
            setattr(_context, key, value)


def get_runtime_context() -> RuntimeContext:
    return _context


def get_current_operation() -> Optional[str]:
    return _current_operation.get()


@contextmanager
def operation_context(operation: str):
    token = _current_operation.set(operation)
    try:
        yield
    finally:
        _current_operation.reset(token)