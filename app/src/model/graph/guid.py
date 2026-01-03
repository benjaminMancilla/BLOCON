from __future__ import annotations

import uuid

GATE_GUID_NAMESPACE = uuid.UUID("8f5a2b2c-0f5d-4bfb-9a2e-39a02d34830e")


def new_gate_guid() -> str:
    return str(uuid.uuid4())


def deterministic_gate_guid(
    *,
    event_kind: str,
    event_version: int | None,
    gate_id: str,
    event_ts: str | None,
) -> str:
    version_part = str(event_version) if event_version is not None else "unknown"
    ts_part = event_ts or "unknown"
    seed = f"{event_kind}|{version_part}|{gate_id}|{ts_part}"
    return str(uuid.uuid5(GATE_GUID_NAMESPACE, seed))