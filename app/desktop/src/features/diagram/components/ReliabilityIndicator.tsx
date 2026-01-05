import { useId } from "react";

type ReliabilityStatusKey =
  | "neutral"
  | "optimal"
  | "acceptable"
  | "moderate"
  | "danger";

type ReliabilityStatus = {
  key: ReliabilityStatusKey;
  label: string;
  description: string;
};

type TopbarReliabilityIndicatorProps = {
  reliabilityTotal: number | null | undefined;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const getReliabilityStatus = (
  reliabilityTotal: number | null | undefined
): ReliabilityStatus => {
  if (reliabilityTotal === null || reliabilityTotal === undefined) {
    return { key: "neutral", label: "—", description: "Sin datos" };
  }

  const normalized = clamp(reliabilityTotal, 0, 1);

  if (normalized >= 0.98) {
    return {
      key: "optimal",
      label: "Óptimo",
      description: "Óptimo / Muy excelente",
    };
  }

  if (normalized >= 0.95) {
    return {
      key: "acceptable",
      label: "Aceptable",
      description: "Bueno / Aceptable",
    };
  }

  if (normalized >= 0.9) {
    return {
      key: "moderate",
      label: "Moderado",
      description: "Moderado / Riesgo medio",
    };
  }

  return {
    key: "danger",
    label: "Peligro",
    description: "Bajo / Peligro",
  };
};

export const TopbarReliabilityIndicator = ({
  reliabilityTotal,
}: TopbarReliabilityIndicatorProps) => {
  const gradientId = useId();
  const status = getReliabilityStatus(reliabilityTotal);
  const normalized =
    reliabilityTotal === null || reliabilityTotal === undefined
      ? 0
      : clamp(reliabilityTotal, 0, 1);
  const percentage = normalized * 100;
  const displayValue =
    reliabilityTotal === null || reliabilityTotal === undefined
      ? "—"
      : `${percentage.toFixed(1)}%`;

  const MIN_REALISTIC = 0.6;
  const adjusted = clamp(normalized, MIN_REALISTIC, 1);
  const linear = (adjusted - MIN_REALISTIC) / (1 - MIN_REALISTIC);
  const exponent = 3.2;
  const ringScale = Math.pow(linear, exponent);

  const size = 64;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ringScale);

  return (
    <div
      className={`topbar-reliability topbar-reliability--${status.key}`}
      title={status.key === "neutral" ? undefined : status.description}
    >
      <div className="topbar-reliability__ring" aria-hidden="true">
        <svg
          className="topbar-reliability__ring-svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--reliability-color-soft)" />
              <stop offset="100%" stopColor="var(--reliability-color)" />
            </linearGradient>
          </defs>
          <circle
            className="topbar-reliability__track"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          <circle
            className="topbar-reliability__progress"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ stroke: `url(#${gradientId})` }}
          />
        </svg>
        <span className="topbar-reliability__value">{displayValue}</span>
      </div>
      <span className="topbar-reliability__status-pill">{status.label}</span>
    </div>
  );
};