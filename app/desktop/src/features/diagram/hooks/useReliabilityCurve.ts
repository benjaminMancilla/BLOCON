import { useMemo } from 'react';

export interface ReliabilityPoint {
  time: Date;
  reliability: number;
}

type ReliabilityState = 'loading' | 'insufficient_data' | 'needs_evaluation' | 'ready';

interface UseReliabilityCurveResult {
  data: ReliabilityPoint[];
  state: ReliabilityState;
  parameters: string | null;
}

const parseDateValue = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value < 1e12 ? value * 1000 : value;
    const parsed = new Date(milliseconds);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const getNumberValue = (record: Record<string, unknown> | null, key: string): number | null => {
  if (!record) return null;
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const formatParameter = (value: number): string => {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 4 }).format(value);
};

/**
 * Hook para obtener/calcular la curva de confiabilidad.
 * Calcula la curva de confiabilidad usando los parámetros del nodo.
 */
export function useReliabilityCurve(
  nodeId: string,
  nodeType: 'gate' | 'component',
  failureCount: number = 5,
  curveParams: Record<string, unknown> | null = null
): UseReliabilityCurveResult {
  const { data, state, parameters } = useMemo(() => {
    const isInsufficient = failureCount < 2 || nodeId.endsWith('_empty');

    if (isInsufficient) {
      return { data: [], state: 'insufficient_data' as const, parameters: null };
    }

    if (!curveParams) {
      return { data: [], state: 'needs_evaluation' as const, parameters: null };
    }

    const curveTypeRaw =
      typeof curveParams.type === 'string'
        ? curveParams.type
        : typeof curveParams.kind === 'string'
          ? curveParams.kind
          : null;
    const curveType = curveTypeRaw ? curveTypeRaw.toLowerCase() : null;
    const params =
      curveParams.params && typeof curveParams.params === 'object'
        ? (curveParams.params as Record<string, unknown>)
        : curveParams;

    const lambda = getNumberValue(params, 'lambda');
    const alpha = getNumberValue(params, 'alpha');
    const beta = getNumberValue(params, 'beta');

    if (curveType === 'exponential' && lambda === null) {
      return { data: [], state: 'needs_evaluation' as const, parameters: null };
    }
    if (curveType === 'weibull' && (alpha === null || beta === null)) {
      return { data: [], state: 'needs_evaluation' as const, parameters: null };
    }
    if (curveType !== 'exponential' && curveType !== 'weibull') {
      return { data: [], state: 'needs_evaluation' as const, parameters: null };
    }

    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setMonth(rangeStart.getMonth() - 1);
    const rangeEnd = new Date(now);
    rangeEnd.setMonth(rangeEnd.getMonth() + 1);
    const totalRange = rangeEnd.getTime() - rangeStart.getTime();
    const pointCount: number = 25;
    const referenceDate =
      parseDateValue(curveParams.reference_date) ??
      parseDateValue(curveParams.referenceDate) ??
      rangeStart;

    const parameterLabel =
      curveType === 'exponential' && lambda !== null
        ? `λ: ${formatParameter(lambda)}`
        : curveType === 'weibull' && alpha !== null && beta !== null
          ? `α: ${formatParameter(alpha)}, β: ${formatParameter(beta)}`
          : null;

    const points: ReliabilityPoint[] = [];
    for (let index = 0; index < pointCount; index += 1) {
      const ratio = pointCount === 1 ? 0 : index / (pointCount - 1);
      const time = new Date(rangeStart.getTime() + totalRange * ratio);
      const deltaTimeDays = Math.max(
        0,
        (time.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const reliability =
        curveType === 'exponential' && lambda !== null
          ? Math.exp(-lambda * deltaTimeDays)
          : curveType === 'weibull' && alpha !== null && beta !== null
            ? Math.exp(-Math.pow(deltaTimeDays / alpha, beta))
            : 0;
      points.push({ time, reliability: Number(reliability.toFixed(4)) });
    }

    return { data: points, state: 'ready' as const, parameters: parameterLabel };
  }, [curveParams, failureCount, nodeId, nodeType]);

  return {
    data,
    state,
    parameters,
  };
}