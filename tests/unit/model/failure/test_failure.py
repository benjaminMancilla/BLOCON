from datetime import datetime, timezone
import pytest

from app.src.model.failure.failure import (
    _norm_row,
    reload_failures,
    ensure_min_records,
    load_failures_cache,
    save_failures_cache,
)


class DummyCache:
    def __init__(self, initial=None):
        self._data = initial if initial is not None else {}
        self.saved = None

    def load_failures_cache(self, project_root=None):
        return self._data

    def save_failures_cache(self, cache, project_root=None):
        self.saved = (cache, project_root)
        self._data = cache


class DummyClient:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def fetch_failures_for_components(self, component_ids):
        self.calls.append(list(component_ids))
        # devuelve filas de todos los componentes, el loader filtra por Component_ID
        return list(self.rows)


def test_norm_row_truncates_iso_and_strips():
    row = {"failure_date": "2025-01-01T12:34:56Z", "type_failure": "  correctivo "}
    d, t = _norm_row(row)
    assert d == "2025-01-01"
    assert t == "correctivo"


def test_load_failures_cache_none_cache_returns_empty():
    assert load_failures_cache(None, cache=None) == {}


def test_reload_failures_updates_requested_ids_and_saves_cache():
    cache = DummyCache(initial={"items": {"C0": {"rows": [("2025-01-01", "x")], "last_update": "old"}}})
    client = DummyClient(rows=[
        {"Component_ID": "C1", "failure_date": "2025-02-01T00:00:00Z", "type_failure": "A"},
        {"Component_ID": "C1", "failure_date": "2025-01-01", "type_failure": "B"},
        {"Component_ID": "C2", "failure_date": "2025-03-01", "type_failure": "C"},
    ])

    out = reload_failures(
        project_root="p",
        component_ids=["C1", "C2", "C3"],
        cache=cache,
        client=client,
        page_size=10,
    )

    assert "items" in out
    items = out["items"]
    # C1 y C2 vienen del cloud ordenados
    assert items["C1"]["rows"] == [("2025-01-01", "B"), ("2025-02-01", "A")]
    assert items["C2"]["rows"] == [("2025-03-01", "C")]
    # C3 se crea vacío
    assert items["C3"]["rows"] == []
    # Se guardó
    assert cache.saved is not None


def test_ensure_min_records_fetches_only_needed_and_updates_cache():
    cache = DummyCache(initial={"items": {
        "C1": {"rows": [("2025-01-01", "x")], "last_update": None},  # insuficiente
        "C2": {"rows": [("2025-01-01", "x"), ("2025-01-02", "y"), ("2025-01-03", "z")], "last_update": None},  # suficiente
    }})
    client = DummyClient(rows=[
        {"Component_ID": "C1", "failure_date": "2025-02-01", "type_failure": "A"},
        {"Component_ID": "C1", "failure_date": "2025-03-01", "type_failure": "B"},
    ])

    res = ensure_min_records(
        project_root="p",
        comp_ids=["C1", "C2"],
        min_records=3,
        cache=cache,
        client=client,
    )

    assert res["needed"] == ["C1"]
    assert res["k"] == 3
    # el cliente debió ser llamado con C1
    assert client.calls and client.calls[0] == ["C1"]
    # cache actualizado para C1
    assert cache._data["items"]["C1"]["rows"] == [("2025-02-01", "A"), ("2025-03-01", "B")]
