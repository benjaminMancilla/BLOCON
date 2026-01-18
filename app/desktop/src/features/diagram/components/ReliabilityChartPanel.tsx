import React from 'react';
import {
  LineChart,
  Line,
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
}

export const ReliabilityChartPanel: React.FC<ReliabilityChartPanelProps> = ({
  nodeId,
  nodeType,
  failureHistoryCount = 5
}) => {
  const { data, hasInsufficientData } = useReliabilityCurve(nodeId, nodeType, failureHistoryCount);

  return (
    <div className="reliability-chart-wrapper">
      <h3 className="reliability-chart-title">
        Curva de Confiabilidad
      </h3>
      
      <SurfaceCard className="reliability-chart-card">
        {hasInsufficientData ? (
          <div className="reliability-chart-empty-state">
            <span className="reliability-chart-empty-icon">⚠️</span>
            <p>Fallas insuficientes para calcular la curva.</p>
            <span className="reliability-chart-empty-hint">
              Se requieren al menos 2 eventos registrados.
            </span>
          </div>
        ) : (
          <div style={{ width: '100%', height: 180 }}>
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
                />
                <YAxis 
                  domain={[0, 1]} 
                  tick={{ fontSize: 10 }} 
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value * 100}%`}
                />
                <Tooltip 
                  formatter={(value: number | undefined) => value !== undefined ? [`${(value * 100).toFixed(1)}%`, 'Confiabilidad'] : ['N/A', 'Confiabilidad']}
                  labelFormatter={(label) => `Tiempo: ${label}h`}
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
        )}
      </SurfaceCard>
    </div>
  );
};