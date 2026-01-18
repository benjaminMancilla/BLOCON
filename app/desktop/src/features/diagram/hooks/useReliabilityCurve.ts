import { useMemo } from 'react';

export interface ReliabilityPoint {
  time: number;
  reliability: number;
}

interface UseReliabilityCurveResult {
  data: ReliabilityPoint[];
  hasInsufficientData: boolean;
  isLoading: boolean;
}

/**
 * Hook para obtener/calcular la curva de confiabilidad.
 * Por ahora implementa el placeholder con curva exponencial aleatoria.
 */
export function useReliabilityCurve(
  nodeId: string, 
  nodeType: 'gate' | 'component',
  failureCount: number = 5 
): UseReliabilityCurveResult {
  
  const { data, hasInsufficientData } = useMemo(() => {
    const isInsufficient = failureCount < 2 || nodeId.endsWith('_empty');

    if (isInsufficient) {
      return { data: [], hasInsufficientData: true };
    }

    const seed = nodeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const lambda = 0.05 + (seed % 10) / 200; // Lambda entre 0.05 y 0.1

    const points: ReliabilityPoint[] = [];
    for (let t = 0; t <= 50; t += 2.5) {
      points.push({
        time: t,
        reliability: Number(Math.exp(-lambda * t).toFixed(3)),
      });
    }

    return { data: points, hasInsufficientData: false };
  }, [nodeId, failureCount]);

  return {
    data,
    hasInsufficientData,
    isLoading: false,
  };
}