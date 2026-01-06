from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any, Optional

try:
    import requests
    from requests import RequestException
except Exception:
    requests = None  # type: ignore
    class RequestException(Exception):
        pass

from .settings import SPSettings
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception

LOG = logging.getLogger(__name__)

from .runtime import get_current_operation, get_runtime_context


@dataclass
class GraphError(RuntimeError):
    status_code: int
    url: str
    body: str

    def __str__(self) -> str:
        tail = self.body
        if len(tail) > 500:
            tail = tail[:500] + "..."
        return f"Graph request failed: {self.status_code} {self.url} {tail}"


def _is_retryable_graph_error(exc: Exception) -> bool:
    if isinstance(exc, GraphError):
        if exc.status_code in (408, 429):
            return True
        if exc.status_code >= 500:
            return True
        return False
    if isinstance(exc, RequestException):
        return True
    if isinstance(exc, TimeoutError):
        return True
    return False


def _log_retry(retry_state) -> None:
    wait = getattr(getattr(retry_state, "next_action", None), "sleep", 0) or 0
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    LOG.warning(
        "SharePoint retry attempt %s in %.2fs due to %s",
        retry_state.attempt_number,
        wait,
        exc,
    )


def _sharepoint_retry():
    return retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=1, max=30),
        retry=retry_if_exception(_is_retryable_graph_error),
        before_sleep=_log_retry,
        reraise=True,
    )


class GraphSession:
    """
    Sesión para Microsoft Graph:
    - token client_credentials cacheado
    - headers estándar
    - GET/POST/PUT con retry automático ante 401 (token expirado)
    """

    def __init__(self, settings: SPSettings):
        if requests is None:
            raise RuntimeError("Missing dependency: requests")
        self.s = settings
        self._token: Optional[str] = None
        self._token_exp_ts: float = 0.0
        self._http = requests.Session()

    def _token_url(self) -> str:
        return f"https://login.microsoftonline.com/{self.s.tenant_id}/oauth2/v2.0/token"

    def _ensure_token(self) -> str:
        now = time.time()
        if self._token and now < (self._token_exp_ts - 60):
            return self._token

        data = {
            "client_id": self.s.client_id,
            "client_secret": self.s.client_secret,
            "grant_type": "client_credentials",
            "scope": self.s.scope,
        }
        r = self._http.post(self._token_url(), data=data, timeout=self.s.timeout_s)
        if r.status_code >= 400:
            raise GraphError(r.status_code, self._token_url(), r.text or "")

        payload = r.json() if r.text else {}
        tok = payload.get("access_token")
        exp = int(payload.get("expires_in", 3599) or 3599)
        if not tok:
            raise RuntimeError(f"Token response missing access_token: {payload}")

        self._token = str(tok)
        self._token_exp_ts = now + max(60, exp)
        return self._token

    def _headers(self, extra: Optional[dict] = None) -> dict:
        h = {
            "Authorization": f"Bearer {self._ensure_token()}",
            "Accept": "application/json",
            # útil para listas grandes / warnings
            "Prefer": "HonorNonIndexedQueriesWarningMayFailRandomly",
        }
        if extra:
            h.update(extra)
        return h

    def _abs_url(self, url_or_path: str) -> str:
        if url_or_path.startswith("http://") or url_or_path.startswith("https://"):
            return url_or_path
        return f"{self.s.graph_base}/{url_or_path.lstrip('/')}"

    @_sharepoint_retry() 
    def request_json(self, method: str, url_or_path: str, *, params: dict | None = None, json_body: Any | None = None, headers: dict | None = None) -> dict:
        url = self._abs_url(url_or_path)
        ctx = get_runtime_context()
        LOG.info(
            "Graph request start %s",
            {
                "operation": get_current_operation(),
                "method": method.upper(),
                "url": url,
                "timeout_s": self.s.timeout_s,
                "tenacity": True,
                "config_loaded": ctx.config_loaded,
                "config_path": ctx.config_path,
                "base_dir": ctx.base_dir,
                "appdata_dir": ctx.appdata_dir,
                "cwd": os.getcwd(),
                "api_server": ctx.api_server,
                "http_proxy": os.getenv("HTTP_PROXY"),
                "https_proxy": os.getenv("HTTPS_PROXY"),
                "no_proxy": os.getenv("NO_PROXY"),
            },
        )
        try:
            r = self._http.request(
                method.upper(),
                url,
                headers=self._headers(headers),
                params=params,
                json=json_body,
                timeout=self.s.timeout_s,
            )
        except Exception as exc:
            LOG.exception(
                "Graph request failed before response %s",
                {
                    "operation": get_current_operation(),
                    "method": method.upper(),
                    "url": url,
                    "error_type": type(exc).__name__,
                    "error": repr(exc),
                    "cause": repr(getattr(exc, "__cause__", None)),
                },
            )
            raise

        if r.status_code == 401:
            # token expirado/invalidado -> refresh y retry
            self._token = None
            r = self._http.request(
                method.upper(),
                url,
                headers=self._headers(headers),
                params=params,
                json=json_body,
                timeout=self.s.timeout_s,
            )

        if r.status_code >= 400:
            LOG.error(
                "Graph request failed with status %s",
                {
                    "operation": get_current_operation(),
                    "method": method.upper(),
                    "url": url,
                    "status_code": r.status_code,
                    "response_body": (r.text or "")[:500],
                },
            )
            raise GraphError(r.status_code, url, r.text or "")

        if not r.text:
            return {}
        try:
            return r.json()
        except Exception:
            # a veces Graph responde texto
            return {"_raw": r.text}

    def get_json(self, url_or_path: str, params: dict | None = None) -> dict:
        return self.request_json("GET", url_or_path, params=params)

    def post_json(self, url_or_path: str, payload: dict) -> dict:
        return self.request_json("POST", url_or_path, json_body=payload)

    def patch_json(self, url_or_path: str, payload: dict) -> dict:
        return self.request_json("PATCH", url_or_path, json_body=payload)

    @_sharepoint_retry()
    def put_bytes(self, url_or_path: str, content: bytes, *, content_type: str = "application/octet-stream") -> dict:
        url = self._abs_url(url_or_path)
        ctx = get_runtime_context()
        LOG.info(
            "Graph request start %s",
            {
                "operation": get_current_operation(),
                "method": "PUT",
                "url": url,
                "timeout_s": self.s.timeout_s,
                "tenacity": True,
                "config_loaded": ctx.config_loaded,
                "config_path": ctx.config_path,
                "base_dir": ctx.base_dir,
                "appdata_dir": ctx.appdata_dir,
                "cwd": os.getcwd(),
                "api_server": ctx.api_server,
                "http_proxy": os.getenv("HTTP_PROXY"),
                "https_proxy": os.getenv("HTTPS_PROXY"),
                "no_proxy": os.getenv("NO_PROXY"),
            },
        )
        try:
            r = self._http.put(
                url,
                headers=self._headers({"Content-Type": content_type}),
                data=content,
                timeout=self.s.timeout_s,
            )
        except Exception as exc:
            LOG.exception(
                "Graph request failed before response %s",
                {
                    "operation": get_current_operation(),
                    "method": "PUT",
                    "url": url,
                    "error_type": type(exc).__name__,
                    "error": repr(exc),
                    "cause": repr(getattr(exc, "__cause__", None)),
                },
            )
            raise

        if r.status_code == 401:
            self._token = None
            r = self._http.put(
                url,
                headers=self._headers({"Content-Type": content_type}),
                data=content,
                timeout=self.s.timeout_s,
            )

        if r.status_code >= 400:
            LOG.error(
                "Graph request failed with status %s",
                {
                    "operation": get_current_operation(),
                    "method": "PUT",
                    "url": url,
                    "status_code": r.status_code,
                    "response_body": (r.text or "")[:500],
                },
            )
            raise GraphError(r.status_code, url, r.text or "")

        return r.json() if r.text else {}

    def put_json(self, url_or_path: str, obj: Any) -> dict:
        raw = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        return self.put_bytes(url_or_path, raw, content_type="application/json")

    @_sharepoint_retry()
    def delete(self, url_or_path: str) -> None:
        url = self._abs_url(url_or_path)
        ctx = get_runtime_context()
        LOG.info(
            "Graph request start %s",
            {
                "operation": get_current_operation(),
                "method": "DELETE",
                "url": url,
                "timeout_s": self.s.timeout_s,
                "tenacity": True,
                "config_loaded": ctx.config_loaded,
                "config_path": ctx.config_path,
                "base_dir": ctx.base_dir,
                "appdata_dir": ctx.appdata_dir,
                "cwd": os.getcwd(),
                "api_server": ctx.api_server,
                "http_proxy": os.getenv("HTTP_PROXY"),
                "https_proxy": os.getenv("HTTPS_PROXY"),
                "no_proxy": os.getenv("NO_PROXY"),
            },
        )
        try:
            r = self._http.delete(
                url,
                headers=self._headers(),
                timeout=self.s.timeout_s,
            )
        except Exception as exc:
            LOG.exception(
                "Graph request failed before response %s",
                {
                    "operation": get_current_operation(),
                    "method": "DELETE",
                    "url": url,
                    "error_type": type(exc).__name__,
                    "error": repr(exc),
                    "cause": repr(getattr(exc, "__cause__", None)),
                },
            )
            raise

        if r.status_code == 401:
            self._token = None
            r = self._http.delete(
                url,
                headers=self._headers(),
                timeout=self.s.timeout_s,
            )

        if r.status_code >= 400:
            LOG.error(
                "Graph request failed with status %s",
                {
                    "operation": get_current_operation(),
                    "method": "DELETE",
                    "url": url,
                    "status_code": r.status_code,
                    "response_body": (r.text or "")[:500],
                },
            )
            raise GraphError(r.status_code, url, r.text or "")