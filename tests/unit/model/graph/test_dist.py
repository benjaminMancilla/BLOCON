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

def test_get_sorted_fail_dates_parses_and_sorts(monkeypatch):
    def fake_cache(*args, **kwargs):
        return {
            "items": {
                "C1": {
                    "rows": [
                        ["2025-02-01T10:00:00", "x"],   # ISO datetime
                        ["2025-01-01", "y"],            # YYYY-MM-DD
                        ["bad-date", "z"],              # inválida (se ignora)
                        ["2025-01-15", "w"],            # YYYY-MM-DD
                    ]
                }
            }
        }

    monkeypatch.setattr(dist_mod, "load_failures_cache", fake_cache)

    out = dist_mod._get_sorted_fail_dates("C1", project_root=None, cache=None)
    assert out == [
        datetime(2025, 1, 1),
        datetime(2025, 1, 15),
        datetime(2025, 2, 1, 10, 0, 0),
    ]


def test_get_sorted_fail_dates_returns_empty_when_component_missing(monkeypatch):
    monkeypatch.setattr(dist_mod, "load_failures_cache", lambda *a, **k: {"items": {}})
    assert dist_mod._get_sorted_fail_dates("C404", project_root=None, cache=None) == []


def test_build_edad_delta_returns_empty_if_less_than_two_valid_dates(monkeypatch):
    def fake_cache(*args, **kwargs):
        return {"items": {"C1": {"rows": [["bad-date", "x"], ["2025-01-01", "correctivo"]]}}}

    monkeypatch.setattr(dist_mod, "load_failures_cache", fake_cache)

    edad, delta, fechas = dist_mod._build_edad_delta("C1", project_root=None, cache=None)
    assert edad == []
    assert delta == []
    assert fechas == []


def test_build_edad_delta_builds_intervals_and_delta_mapping(monkeypatch):
    # 3 fechas válidas => 2 intervalos
    def fake_cache(*args, **kwargs):
        return {
            "items": {
                "C1": {
                    "rows": [
                        ["2025-01-01", "preventivo"],             # delta=1
                        ["2025-01-11", "correctivo"],             # delta=0
                        ["2025-01-21", "M2 - Aviso de averia"],   # delta=0 (case-insensitive)
                    ]
                }
            }
        }

    monkeypatch.setattr(dist_mod, "load_failures_cache", fake_cache)

    edad, delta, fechas = dist_mod._build_edad_delta("C1", project_root=None, cache=None)

    assert edad == [10.0, 10.0]  # días
    assert delta == [0, 0]       # correctivo y M2 -> 0
    assert fechas == [datetime(2025, 1, 11), datetime(2025, 1, 21)]


def test_weibull_loglike_invalid_beta_or_eta_returns_big_negative():
    ll1 = dist_mod._weibull_loglike(beta=0.0, eta=10.0, edad=[1.0], delta=[1])
    ll2 = dist_mod._weibull_loglike(beta=2.0, eta=0.0, edad=[1.0], delta=[1])
    assert ll1 <= -1e17
    assert ll2 <= -1e17


def test_weibull_loglike_negative_t_returns_big_negative():
    ll = dist_mod._weibull_loglike(beta=2.0, eta=10.0, edad=[-1.0], delta=[1])
    assert ll <= -1e17


def test_weibull_loglike_delta1_uses_logR():
    # delta==1 => ll = log(R) = - (t/eta)^beta
    beta, eta, t = 2.0, 10.0, 3.0
    expected = -((t / eta) ** beta)
    ll = dist_mod._weibull_loglike(beta=beta, eta=eta, edad=[t], delta=[1])
    assert math.isclose(ll, expected, rel_tol=0, abs_tol=1e-12)


def test_weibull_loglike_delta0_uses_logf():
    # delta==0 => ll = log(f) = log(lambda*R)
    beta, eta, t = 2.0, 10.0, 3.0
    x = (t / eta) ** beta
    R = math.exp(-x)
    lam = (beta / eta) * ((t / eta) ** (beta - 1))
    f = lam * R
    expected = math.log(f)

    ll = dist_mod._weibull_loglike(beta=beta, eta=eta, edad=[t], delta=[0])
    assert math.isclose(ll, expected, rel_tol=0, abs_tol=1e-12)


def test_search_weibull_mle_moves_towards_better_params(monkeypatch):
    # Creamos una "loglike" artificial con máximo en (beta=3, eta=10)
    def fake_ll(beta, eta, edad, delta):
        return -((beta - 3.0) ** 2) - ((eta - 10.0) ** 2)

    monkeypatch.setattr(dist_mod, "_weibull_loglike", fake_ll)

    beta, eta = dist_mod._search_weibull_mle(edad=[5.0, 6.0, 7.0], delta=[1, 0, 1])

    assert abs(beta - 3.0) < 1.0   # no exige exactitud, pero sí que se mueva
    assert abs(eta - 10.0) < 5.0
    assert eta > 0.0


def test_exp_mle_lambda_basic():
    lam = dist_mod._exp_mle_lambda([2.0, 2.0, 2.0])
    assert math.isclose(lam, 0.5, rel_tol=0, abs_tol=1e-12)


def test_exp_mle_lambda_protects_against_zero_mean():
    lam = dist_mod._exp_mle_lambda([0.0, 0.0])
    assert lam == 1.0 / 1e-6


def test_optimize_curve_params_exponential_path(monkeypatch):
    monkeypatch.setattr(dist_mod, "_build_edad_delta", lambda *a, **k: ([1.0, 2.0], [1, 0], []))
    monkeypatch.setattr(dist_mod, "_exp_mle_lambda", lambda edad: 0.123)

    out = dist_mod.optimize_curve_params("exponential", "C1", project_root=None, min_points=2, cache=None)
    assert out == {"lambda": 0.123}


def test_optimize_curve_params_weibull_path(monkeypatch):
    monkeypatch.setattr(dist_mod, "_build_edad_delta", lambda *a, **k: ([1.0, 2.0], [1, 0], []))
    monkeypatch.setattr(dist_mod, "_search_weibull_mle", lambda edad, delta: (2.5, 100.0))

    out = dist_mod.optimize_curve_params("weibull", "C1", project_root=None, min_points=2, cache=None)
    assert out == {"eta": 100.0, "beta": 2.5}


def test_optimize_curve_params_unknown_kind_returns_none(monkeypatch):
    monkeypatch.setattr(dist_mod, "_build_edad_delta", lambda *a, **k: ([1.0, 2.0], [1, 0], []))

    out = dist_mod.optimize_curve_params("something_else", "C1", project_root=None, min_points=2, cache=None)
    assert out is None


def test_reliability_returns_fallback_when_params_none(monkeypatch):
    monkeypatch.setattr(dist_mod, "optimize_curve_params", lambda *a, **k: None)

    d = Dist(kind="exponential")
    r = d.reliability("C1", 10, project_root=None, cache=None)
    assert r == float(FALLBACK_R)


def test_reliability_weibull_eta_le_0_returns_fallback(monkeypatch):
    monkeypatch.setattr(dist_mod, "optimize_curve_params", lambda *a, **k: {"eta": 0.0, "beta": 2.0})

    d = Dist(kind="weibull")
    r = d.reliability("C1", 10, project_root=None, cache=None)
    assert r == float(FALLBACK_R)


def test_reliability_unknown_kind_returns_fallback(monkeypatch):
    # en runtime puedes instanciar un kind inválido aunque el type sea Literal
    monkeypatch.setattr(dist_mod, "optimize_curve_params", lambda *a, **k: {"lambda": 0.1})

    d = Dist(kind="unknown")
    r = d.reliability("C1", 10, project_root=None, cache=None)
    assert r == float(FALLBACK_R)
