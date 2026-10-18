import React, { useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';
import { SurfaceCard } from '../../../ui/components/SurfaceCard';
import { useReliabilityCurve } from '../hooks/useReliabilityCurve';

interface ReliabilityChartPanelProps {
  nodeId: string;
  nodeType: 'gate' | 'component';
  failureHistoryCount?: number;
  curveParams?: Record<string, unknown> | null;
}

export const ReliabilityChartPanel: React.FC<ReliabilityChartPanelProps> = ({
  nodeId,
  nodeType,
  failureHistoryCount = 5,
  curveParams = null,
}) => {
  const { data, state, parameters } = useReliabilityCurve(
    nodeId,
    nodeType,
    failureHistoryCount,
    curveParams,
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' }),
    [],
  );
  const tooltipFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    [],
  );

  return (
    <div className="reliability-chart-wrapper">
      <h3 className="reliability-chart-title">
        Curva de Confiabilidad
      </h3>
      
      <SurfaceCard className="reliability-chart-card">
        {state === 'insufficient_data' ? (
          <div className="reliability-chart-empty-state">
            <span className="reliability-chart-empty-icon">⚠️</span>
            <p>Fallas insuficientes para calcular la curva.</p>
            <span className="reliability-chart-empty-hint">
              Se requieren al menos 2 eventos registrados.
            </span>
          </div>
        ) : state === 'needs_evaluation' ? (
          <div className="reliability-chart-empty-state">
            <span className="reliability-chart-empty-icon">🧮</span>
            <p>Datos no calculados. Por favor ejecute una evaluación del diagrama.</p>
          </div>
        ) : state === 'loading' ? (
          <div className="reliability-chart-empty-state">
            <span className="reliability-chart-empty-icon">⏳</span>
            <p>Cargando curva de confiabilidad...</p>
          </div>
        ) : (
          <div className="reliability-chart-content">
            <div className="reliability-chart-plot">
              <ResponsiveContainer>
                <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRel" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: Date) => dateFormatter.format(new Date(value))}
                  />
                  <YAxis 
                    domain={[0, 1]} 
                    tick={{ fontSize: 10 }} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${Math.round(value * 100)}%`}
                  />
                  <Tooltip 
                    formatter={(value: number | undefined) =>
                      value !== undefined
                        ? [`${(value * 100).toFixed(1)}%`, 'Confiabilidad']
                        : ['N/A', 'Confiabilidad']}
                    labelFormatter={(label) => `Fecha: ${tooltipFormatter.format(new Date(label))}`}
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="reliability" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorRel)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {parameters ? (
              <div className="reliability-chart-legend">
                <span>Parámetros:</span>
                <strong>{parameters}</strong>
              </div>
            ) : null}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
};