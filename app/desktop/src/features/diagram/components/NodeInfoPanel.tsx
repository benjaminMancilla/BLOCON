import { DiagramSidePanelLeft } from "./DiagramSidePanelLeft";
import type { NodeDetailsResponse } from "../../../services/nodeDetailsApi";

const formatReliability = (reliability: number | null) => {
  if (reliability === null) return "—";
  return `${(reliability * 100).toFixed(1)}%`;
};

const formatCalculationType = (value: string | null) => {
  if (!value) return "—";
  const normalized = value.toLowerCase();
  if (normalized.startsWith("wei")) return "Weibull";
  if (normalized.startsWith("exp")) return "Exponencial";
  return value;
};

const getSnapshotString = (
  snapshot: Record<string, unknown>,
  key: string,
): string | null => {
  const value = snapshot[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const getSnapshotNumber = (
  snapshot: Record<string, unknown>,
  key: string,
): number | null => {
  const value = snapshot[key];
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  return value;
};

const getSnapshotBoolean = (
  snapshot: Record<string, unknown>,
  key: string,
): boolean => {
  const value = snapshot[key];
  return value === true;
};

type NodeInfoPanelProps = {
  isOpen: boolean;
  dependency?: boolean;
  loading: boolean;
  error: string | null;
  data: NodeDetailsResponse | null;
  onClose: () => void;
};

export const NodeInfoPanel = ({
  isOpen,
  dependency,
  loading,
  error,
  data,
  onClose,
}: NodeInfoPanelProps) => {
  if (!isOpen) return null;

  const snapshot = data?.snapshot ?? {};
  const conflict = getSnapshotBoolean(snapshot, "conflict");
  const reliability =
    getSnapshotNumber(snapshot, "reliability") ??
    getSnapshotNumber(snapshot, "reliability_total");
  const calculationType =
    getSnapshotString(snapshot, "calculation_type") ??
    getSnapshotString(snapshot, "calculationType") ??
    getSnapshotString(snapshot, "calc_type");
  const title =
    (data?.kind === "component"
      ? getSnapshotString(snapshot, "kks_name")
      : null) ??
    data?.id ??
    "Nodo";
  const subtitle =
    data?.kind === "gate"
      ? "Gate"
      : data?.kind === "component"
        ? "Componente"
        : "Nodo";

  return (
    <DiagramSidePanelLeft
      isOpen={isOpen}
      dependency={dependency}
      onClose={onClose}
      className="diagram-side-panel--node-info"
    >
      <section className="node-info-panel" aria-live="polite">
        <header className="node-info-panel__header">
          <div className="node-info-panel__header-text">
            <div className="node-info-panel__title-row">
              <h2 className="node-info-panel__title">{title}</h2>
              {conflict ? (
                <span className="node-info-panel__badge node-info-panel__badge--conflict">
                  Conflictivo
                </span>
              ) : null}
            </div>
            <p className="node-info-panel__subtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="node-info-panel__close"
            onClick={onClose}
            aria-label="Cerrar panel de información del nodo"
          >
            ×
          </button>
        </header>

        {loading ? (
          <div className="node-info-panel__status">Cargando información...</div>
        ) : null}
        {error ? (
          <div className="node-info-panel__status node-info-panel__status--error">
            {error}
          </div>
        ) : null}
        {!loading && !error && !data ? (
          <div className="node-info-panel__status">Sin datos disponibles.</div>
        ) : null}

        {!loading && !error && data?.kind === "component" ? (
          <>
            <div className="node-info-panel__list">
              <div className="node-info-panel__row">
                <span className="node-info-panel__label">ID</span>
                <span className="node-info-panel__value">{data.id}</span>
              </div>
              <div className="node-info-panel__row">
                <span className="node-info-panel__label">Tipo</span>
                <span className="node-info-panel__value">
                  {getSnapshotString(snapshot, "type") ?? "—"}
                </span>
              </div>
              <div className="node-info-panel__row">
                <span className="node-info-panel__label">SubType</span>
                <span className="node-info-panel__value">
                  {getSnapshotString(snapshot, "SubType") ??
                    getSnapshotString(snapshot, "subtype") ??
                    "—"}
                </span>
              </div>
              <div className="node-info-panel__row">
                <span className="node-info-panel__label">Actualizado</span>
                <span className="node-info-panel__value">
                  {getSnapshotString(snapshot, "updated_at") ??
                    getSnapshotString(snapshot, "updatedAt") ??
                    "—"}
                </span>
              </div>
            </div>
            <div className="node-info-panel__section">
              <h3 className="node-info-panel__section-title">Confiabilidad</h3>
              <span
                className={
                  conflict
                    ? "node-info-panel__value node-info-panel__value--conflict"
                    : "node-info-panel__value"
                }
              >
                {formatReliability(reliability)}
              </span>
            </div>
            <div className="node-info-panel__section">
              <h3 className="node-info-panel__section-title">Tipo de cálculo</h3>
              <span className="node-info-panel__value">
                {formatCalculationType(calculationType)}
              </span>
            </div>
          </>
        ) : null}

        {!loading && !error && data?.kind === "gate" ? (
          <div className="node-info-panel__list">
            <div className="node-info-panel__row">
              <span className="node-info-panel__label">ID</span>
              <span className="node-info-panel__value">{data.id}</span>
            </div>
            <div className="node-info-panel__row">
              <span className="node-info-panel__label">Subtype</span>
              <span className="node-info-panel__value">
                {getSnapshotString(snapshot, "subtype") ??
                  getSnapshotString(snapshot, "SubType") ??
                  "—"}
              </span>
            </div>
            <div className="node-info-panel__row">
              <span className="node-info-panel__label">Label</span>
              <span className="node-info-panel__value">
                {getSnapshotString(snapshot, "label") ?? "—"}
              </span>
            </div>
            <div className="node-info-panel__row">
              <span className="node-info-panel__label">Name</span>
              <span className="node-info-panel__value">
                {getSnapshotString(snapshot, "name") ?? "—"}
              </span>
            </div>
            <div className="node-info-panel__row">
              <span className="node-info-panel__label">Confiabilidad</span>
              <span
                className={
                  conflict
                    ? "node-info-panel__value node-info-panel__value--conflict"
                    : "node-info-panel__value"
                }
              >
                {formatReliability(reliability)}
              </span>
            </div>
          </div>
        ) : null}
      </section>
    </DiagramSidePanelLeft>
  );
};