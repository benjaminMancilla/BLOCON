import math
from datetime import datetime
import pytest

import app.src.model.graph.dist as dist_mod
from app.src.model.graph.dist import Dist, FALLBACK_R


def test_parse_date_any_iso_and_invalid():
    dt = dist_mod._parse_date_any("2025-01-02")
    assert isinstance(dt, datetime)
    assert dist_mod._parse_date_any("not-a-date") is None


def test_has_enough_records_true_when_intervals_ge_min(monkeypatch):
    # 3 fechas => 2 intervalos (edad list len = 2)
    def fake_cache(*args, **kwargs):
        return {
            "items": {
                "C1": {
                    "rows": [
                        ["2025-01-01", "preventivo"],
                        ["2025-01-11", "correctivo"],
                        ["2025-01-21", "preventivo"],
                    ]
                }
            }
        }

    monkeypatch.setattr(dist_mod, "load_failures_cache", fake_cache)
    assert dist_mod.has_enough_records("C1", project_root=None, min_points=2) is True
    assert dist_mod.has_enough_records("C1", project_root=None, min_points=3) is False


def test_optimize_curve_params_returns_none_when_insufficient_points(monkeypatch):
    monkeypatch.setattr(dist_mod, "_build_edad_delta", lambda *a, **k: ([], [], []))
    out = dist_mod.optimize_curve_params("exponential", "C1", project_root=None, min_points=2)
    assert out is None


def test_reliability_returns_fallback_when_no_failures(monkeypatch):
    # fuerza que no existan fechas en historial
    monkeypatch.setattr(dist_mod, "_get_sorted_fail_dates", lambda *a, **k: [])
    d = Dist(kind="exponential")
    r = d.reliability("C1", "2025-02-01")
    assert r == float(FALLBACK_R)


def test_reliability_returns_1_if_eval_before_last_failure(monkeypatch):
    # si la evaluación es antes que la última falla => edad_dias < 0 => 1.0
    monkeypatch.setattr(dist_mod, "_get_sorted_fail_dates", lambda *a, **k: [datetime(2025, 2, 1)])
    d = Dist(kind="exponential")
    r = d.reliability("C1", "2025-01-01")
    assert r == 1.0


def test_reliability_exponential_numeric_age_uses_stubbed_params(monkeypatch):
    # caso numérico: no necesita historial; sólo valida exp(-lambda * edad)
    monkeypatch.setattr(dist_mod, "optimize_curve_params", lambda *a, **k: {"lambda": 0.1})
    d = Dist(kind="exponential")

    r = d.reliability("C1", 10)  # 10 días
    assert math.isclose(r, math.exp(-0.1 * 10), rel_tol=0, abs_tol=1e-12)


def test_reliability_weibull_numeric_age_uses_stubbed_params(monkeypatch):
    monkeypatch.setattr(dist_mod, "optimize_curve_params", lambda *a, **k: {"eta": 100.0, "beta": 2.0})
    d = Dist(kind="weibull")

    r = d.reliability("C1", 10)  # x=(10/100)^2=0.01 => exp(-0.01)
    assert math.isclose(r, math.exp(-0.01), rel_tol=0, abs_tol=1e-12)


def test_reliability_date_computes_age_from_last_failure(monkeypatch):
    # fija última falla = 2025-01-01, eval=2025-01-11 => edad=10 días
    monkeypatch.setattr(dist_mod, "_get_sorted_fail_dates", lambda *a, **k: [datetime(2025, 1, 1)])
    monkeypatch.setattr(dist_mod, "optimize_curve_params", lambda *a, **k: {"lambda": 0.2})

    d = Dist(kind="exponential")
    r = d.reliability("C1", "2025-01-11")
    assert math.isclose(r, math.exp(-0.2 * 10.0), rel_tol=0, abs_tol=1e-12)
