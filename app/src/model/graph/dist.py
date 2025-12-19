from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Literal, Optional, List, Tuple, Union
import math
from datetime import datetime, date

from ..failure.failure import MIN_INTERVALS_FOR_OPT, load_failures_cache
from ..failure.ports import FailuresCachePort

FALLBACK_R: float = 0.99

# ------------------ utilidades fechas ------------------

def _parse_date_any(x: Union[str, datetime, date, float, int]) -> Optional[datetime]:
    """Convierte entrada a datetime. Si es numérico, retorna None (se trata como 'edad en días')."""
    if isinstance(x, datetime):
        return x
    if isinstance(x, date):
        return datetime(x.year, x.month, x.day)
    if isinstance(x, (float, int)):
        return None
    if isinstance(x, str):
        # Esperado ISO 'YYYY-MM-DD' o 'YYYY-MM-DDTHH:MM:SS'
        try:
            return datetime.fromisoformat(x)
        except Exception:
            # intentos mínimos adicionales
            try:
                return datetime.strptime(x, "%Y-%m-%d")
            except Exception:
                return None
    return None

def _days_between(a: datetime, b: datetime) -> float:
    return (b - a).total_seconds() / 86400.0

# ------------------ lectura historial ------------------

def _get_sorted_fail_dates(
    comp_id: str,
    project_root: Optional[str],
    cache: Optional[FailuresCachePort],
) -> List[datetime]:
    """Toma el cache de fallas y retorna las fechas del componente ordenadas asc."""
    cache_data = load_failures_cache(project_root, cache=cache)
    items = (cache_data.get("items") or {}).get(comp_id, {})
    rows = items.get("rows", [])  # lista de [fecha, tipo]
    out: List[datetime] = []
    for tup in rows:
        if isinstance(tup, (list, tuple)) and tup:
            try:
                dt = datetime.fromisoformat(str(tup[0]))
                out.append(dt)
            except Exception:
                # tolerante: intenta sólo fecha YYYY-MM-DD
                try:
                    dt = datetime.strptime(str(tup[0]), "%Y-%m-%d")
                    out.append(dt)
                except Exception:
                    pass
    out.sort()
    return out

def _build_edad_delta(
    comp_id: str,
    project_root: Optional[str],
    cache: Optional[FailuresCachePort],
) -> Tuple[List[float], List[int], List[datetime]]:
    cache_data = load_failures_cache(project_root, cache=cache)
    items = (cache_data.get("items") or {}).get(comp_id, {})
    rows = items.get("rows", [])
    
    tmp: List[Tuple[datetime, str]] = []
    for tup in rows:
        if isinstance(tup, (list, tuple)) and tup:
            try:
                dt = datetime.fromisoformat(str(tup[0]))
            except Exception:
                try:
                    dt = datetime.strptime(str(tup[0]), "%Y-%m-%d")
                except Exception:
                    continue
            ty = str(tup[1]) if len(tup) > 1 else ""
            tmp.append((dt, ty))
    tmp.sort(key=lambda x: x[0])
    
    if len(tmp) < 2:
        return [], [], []
    
    edad: List[float] = []
    delta: List[int] = []
    fechas_filtradas: List[datetime] = []
    
    def _to_delta(tstr: str) -> int:
        s = tstr.strip().lower()
        if s in ("correctivo", "m2 - aviso de averia", "m2"):
            return 0
        return 1
    
    for i in range(1, len(tmp)):
        t_prev, _ = tmp[i - 1]
        t_cur, ty = tmp[i]
        edad.append(_days_between(t_prev, t_cur))
        delta.append(_to_delta(ty))
        fechas_filtradas.append(t_cur)
    
    return edad, delta, fechas_filtradas

def has_enough_records(
    comp_id: str,
    project_root: Optional[str],
    min_points: int = MIN_INTERVALS_FOR_OPT,
    *,
    cache: Optional[FailuresCachePort] = None,
) -> bool:
    edad, delta, _ = _build_edad_delta(comp_id, project_root, cache)
    return len(edad) >= min_points

# ------------------ máxima verosimilitud ------------------

def _weibull_loglike(beta: float, eta: float, edad: List[float], delta: List[int]) -> float:
    """
    Log-likelihood según el script del cliente:
    - lambda(t) = (β/η)*(t/η)^(β-1)
    - R(t) = exp(-(t/η)^β)
    - f(t) = lambda(t) * R(t)
    lnFOR = log(R) si delta==1, sino log(f)  (sí, “al revés” de lo clásico; respetamos el script)
    """
    if beta <= 0.0 or eta <= 0.0:
        return -1e18
    ll = 0.0
    for t, d in zip(edad, delta):
        if t < 0:
            return -1e18
        x = (t / eta) ** beta
        R = math.exp(-x)
        # evitar log(0)
        if d == 1:
            if R <= 0.0:
                return -1e18
            ll += math.log(max(R, 1e-300))
        else:
            # f = lambda * R
            lam = (beta / eta) * ((t / eta) ** (beta - 1)) if t > 0 else (beta / eta) * (0.0 ** (beta - 1) if beta > 1 else 0.0)
            f = lam * R
            if f <= 0.0:
                return -1e18
            ll += math.log(max(f, 1e-300))
    return ll

def _search_weibull_mle(edad: List[float], delta: List[int]) -> Tuple[float, float]:
    """
    Optimización liviana (sin SciPy): búsqueda por coordenadas + exploración local.
    Devuelve (beta, eta).
    """
    # inicializaciones simples
    mean_t = max(1e-3, sum(edad) / len(edad))
    beta = 2.0
    eta = mean_t

    best_ll = _weibull_loglike(beta, eta, edad, delta)

    # ciclos de refinamiento
    for _ in range(12):
        # barrido beta
        cand_betas = [beta * f for f in (0.5, 0.75, 1.0, 1.25, 1.5)]
        cand_betas += [max(0.2, beta + s) for s in (-0.8, -0.4, 0.4, 0.8)]
        cb = beta
        cll = best_ll
        for b in cand_betas:
            ll = _weibull_loglike(b, eta, edad, delta)
            if ll > cll:
                cb, cll = b, ll
        beta, best_ll = cb, cll

        # barrido eta
        cand_etas = [eta * f for f in (0.5, 0.75, 1.0, 1.25, 1.5)]
        cand_etas += [max(0.1, eta + s) for s in (-0.6 * mean_t, -0.3 * mean_t, 0.3 * mean_t, 0.6 * mean_t)]
        ce = eta
        cll = best_ll
        for e in cand_etas:
            ll = _weibull_loglike(beta, e, edad, delta)
            if ll > cll:
                ce, cll = e, ll
        eta, best_ll = ce, cll

    return beta, max(1e-6, eta)

def _exp_mle_lambda(edad: List[float]) -> float:
    # MLE clásico con datos completos; aquí seguimos sencillo.
    m = sum(edad) / len(edad)
    return 1.0 / max(m, 1e-6)

# ------------------ API pública ------------------

def optimize_curve_params(
    kind: Literal["exponential", "weibull"],
    comp_id: str,
    project_root: Optional[str] = None,
    min_points: int = MIN_INTERVALS_FOR_OPT,
    *,
    cache: Optional[FailuresCachePort] = None,
) -> Optional[Dict[str, float]]:
    """
    Estima parámetros a partir del historial de fallas del componente.
    - Requiere ≥ min_points (por defecto MIN_RECORDS_FOR_OPT).
    - Exponential → {'lambda': ...}
    - Weibull     → {'eta': ..., 'beta': ...}
    """
    edad, delta, _ = _build_edad_delta(comp_id, project_root, cache)
    if len(edad) < min_points:
        print(f"Not enough data points for optimization for component: {comp_id} (have {len(edad)}, need {min_points})")
        return None

    if kind == "exponential":
        lam = _exp_mle_lambda(edad)
        return {"lambda": float(lam)}
    elif kind == "weibull":
        beta, eta = _search_weibull_mle(edad, delta)
        return {"eta": float(eta), "beta": float(beta)}
    else:
        return None

@dataclass
class Dist:
    kind: Literal["exponential", "weibull"]

    def reliability(
        self,
        comp_id: str,
        t: Union[datetime, date, str, float, int],
        project_root: Optional[str] = None,
        *,
        cache: Optional[FailuresCachePort] = None,
    ) -> float:
        """
        R(t) evaluada para `comp_id`.
        - Si t es fecha/str: se interpreta como 'fecha de evaluación' y se usa
          la 'edad' = días desde la última falla registrada hasta t.
        - Si t es numérico: se asume 'edad' en días.
        Si no hay suficientes datos, retorna FALLBACK_R.
        """
        # 1) convertir t → edad_días
        dt = _parse_date_any(t)
        if dt is None and isinstance(t, (float, int)):
            edad_dias = float(t)
        else:
            # buscar última falla
            fechas = _get_sorted_fail_dates(comp_id, project_root, cache=cache)
            if not fechas:
                print("No failure records found for component:", comp_id)
                return float(FALLBACK_R)
            last_event = fechas[-1]
            edad_dias = _days_between(last_event, dt or last_event)
            if edad_dias < 0:
                # evaluación antes de la última falla: devolvemos R≈1
                return 1.0

        # 2) obtener parámetros
        params = optimize_curve_params(self.kind, comp_id, project_root=project_root, cache=cache)
        if params is None:
            print("Not enough data to optimize parameters for component:", comp_id)
            return float(FALLBACK_R)

        # 3) evaluar
        if self.kind == "exponential":
            lam = float(params.get("lambda", 1e-5))
            return math.exp(-lam * max(0.0, edad_dias))
        elif self.kind == "weibull":
            eta = float(params.get("eta", 12000.0))
            beta = float(params.get("beta", 1.3))
            if eta <= 0.0:
                print("Invalid eta parameter for component:", comp_id)
                return float(FALLBACK_R)
            x = (max(0.0, edad_dias) / eta) ** beta
            return math.exp(-x)
        else:
            return float(FALLBACK_R)

