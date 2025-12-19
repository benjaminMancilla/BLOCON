import os
import time
import json
from typing import Any

def iso_utc() -> str:
    # Mismo formato que usabas en cloud.py: YYYY-mm-ddTHH:MM:SSZ
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _safe_makedirs(path: str) -> None:
    d = os.path.dirname(path)
    if d:
        os.makedirs(d, exist_ok=True)

def _atomic_write_text(path: str, text: str, encoding: str = "utf-8") -> None:
    """
    Escritura atómica: escribe a .tmp y reemplaza.
    Evita archivos corruptos si se corta la app.
    """
    _safe_makedirs(path)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding=encoding) as f:
        f.write(text)
    os.replace(tmp, path)


def _read_json_file(path: str, default: Any) -> Any:
    try:
        if not os.path.exists(path):
            return default
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default
    
def default_user_data_dir(app_name: str) -> str:
    base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
    return os.path.join(base, app_name)