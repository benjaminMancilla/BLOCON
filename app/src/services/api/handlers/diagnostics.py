from __future__ import annotations

import os
import socket
from urllib.parse import urlparse

from src.services.remote.graph_session import GraphSession, GraphError
from src.services.remote.runtime import get_runtime_context, resolve_appdata_dir
from src.services.remote.settings import load_settings

from .base import BaseHandler


class DiagnosticsHandler(BaseHandler):
    def handle_cloud_diagnostics(self) -> None:
        ctx = get_runtime_context()
        appdata_dir = ctx.appdata_dir or resolve_appdata_dir(app_name="Blocon")
        config_path = ctx.config_path or os.path.join(appdata_dir, ".env")
        config_dat = os.path.join(appdata_dir, "config.dat")

        response = {
            "paths": {
                "cwd": os.getcwd(),
                "base_dir": ctx.base_dir,
                "appdata_dir": appdata_dir,
                "config_env_path": config_path,
                "config_dat_path": config_dat,
            },
            "config": {
                "env_exists": os.path.exists(config_path),
                "config_dat_exists": os.path.exists(config_dat),
            },
            "proxy": {
                "http_proxy": os.getenv("HTTP_PROXY"),
                "https_proxy": os.getenv("HTTPS_PROXY"),
                "no_proxy": os.getenv("NO_PROXY"),
            },
            "can_resolve_host": {},
            "can_open_session": {
                "ok": False,
            },
        }

        settings = None
        try:
            settings = load_settings(dotenv_path=config_path)
        except Exception as exc:
            response["can_open_session"] = {
                "ok": False,
                "error": f"settings_load_failed: {type(exc).__name__}: {exc}",
            }

        hosts = []
        graph_base = os.getenv("SP_GRAPH_BASE", "https://graph.microsoft.com/v1.0")
        graph_host = urlparse(graph_base).hostname
        if graph_host:
            hosts.append(("graph_base", graph_host))
        if settings and settings.site.hostname:
            hosts.append(("site_hostname", settings.site.hostname))

        for label, host in hosts:
            try:
                socket.getaddrinfo(host, 443)
                response["can_resolve_host"][label] = {"host": host, "ok": True}
            except Exception as exc:
                response["can_resolve_host"][label] = {
                    "host": host,
                    "ok": False,
                    "error": f"{type(exc).__name__}: {exc}",
                }

        if settings:
            try:
                session = GraphSession(settings)
                session.get_json("sites/root")
                response["can_open_session"] = {"ok": True}
            except GraphError as exc:
                response["can_open_session"] = {
                    "ok": False,
                    "error": f"GraphError {exc.status_code}",
                    "details": str(exc),
                }
            except Exception as exc:
                response["can_open_session"] = {
                    "ok": False,
                    "error": f"{type(exc).__name__}: {exc}",
                }

        self._send_json(200, response)