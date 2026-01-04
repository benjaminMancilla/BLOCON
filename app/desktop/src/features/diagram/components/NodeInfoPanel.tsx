import { DiagramSidePanelLeft } from "./DiagramSidePanelLeft";
import { NodeFailuresTable } from "./NodeFailuresTable";
import { NodeTypeIcon } from "./NodeTypeIcon";
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

const getRecordString = (
  record: Record<string, unknown>,
  key: string,
): string | null => {
  const value = record[key];
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

const formatDisplayValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : "—";
  }
  return String(value);
};

const getDistKind = (snapshot: Record<string, unknown>): string | null => {
  const dist = snapshot.dist;
  if (!dist || typeof dist !== "object") return null;
  const kind = (dist as Record<string, unknown>).kind;
  return typeof kind === "string" && kind.trim() ? kind.trim() : null;
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
  const cache =
    data?.cache && typeof data.cache === "object" ? data.cache : null;
  const conflict = getSnapshotBoolean(snapshot, "conflict");
  const reliability =
    getSnapshotNumber(snapshot, "reliability") ??
    getSnapshotNumber(snapshot, "reliability_total");
  const calculationType = getDistKind(snapshot);
  const cacheId = cache ? getRecordString(cache, "id") : null;
  const kksName = cache ? getRecordString(cache, "kks_name") : null;
  const title = data?.id ?? cacheId ?? "Nodo";
  const componentType = cache ? getRecordString(cache, "type") : null;
  const gateSubtype =
    getRecordString(snapshot, "subtype") ??
    getRecordString(snapshot, "SubType");

  console.log(data?.kind)
  console.log(componentType)
  console.log(gateSubtype)

  return (
    <DiagramSidePanelLeft
      isOpen={isOpen}
      dependency={dependency}
      onClose={onClose}
      className="diagram-side-panel--node-info"
    >
      <section className="node-info-panel" aria-live="polite">
        <header className="node-info-panel__header">
          <div className="node-info-panel__header-main">
            <NodeTypeIcon
              kind={data?.kind === "gate" ? "gate" : "component"}
              type={componentType}
              subtype={gateSubtype}
              size={32}
              className="node-info-panel__type-icon"
            />
            <div className="node-info-panel__header-text">
              <div className="node-info-panel__title-row">
                <h2 className="node-info-panel__title">{title}</h2>
                {conflict ? (
                  <span className="node-info-panel__badge node-info-panel__badge--conflict">
                    Faltan fallas
                  </span>
                ) : null}
              </div>
              {kksName ? (
                <p className="node-info-panel__subtitle">{kksName}</p>
              ) : null}
            </div>
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
                <span className="node-info-panel__label">KKS</span>
                <span className="node-info-panel__value">{title}</span>
              </div>
              <div className="node-info-panel__row">
                <span className="node-info-panel__label">Tipo</span>
                <span className="node-info-panel__value">
                  {formatDisplayValue(componentType)}
                </span>
              </div>
              <div className="node-info-panel__row">
                <span className="node-info-panel__label">Subtipo</span>
                <span className="node-info-panel__value">
                  {formatDisplayValue(cache?.SubType)}
                </span>
              </div>
              <div className="node-info-panel__row">
                <span className="node-info-panel__label">Actualizado</span>
                <span className="node-info-panel__value">
                  {formatDisplayValue(cache?.updated_at)}
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
            <div className="node-info-panel__section node-info-panel__section--stacked">
              <h3 className="node-info-panel__section-title">Historial de fallas</h3>
              <NodeFailuresTable failures={data?.failures} />
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
                <span className="node-info-panel__label">Tipo</span>
                <span className="node-info-panel__value">
                  {gateSubtype ?? "—"}
                </span>
              </div>
            <div className="node-info-panel__row">
              <span className="node-info-panel__label">Etiqueta</span>
              <span className="node-info-panel__value">
                {getRecordString(snapshot, "label") ?? "—"}
              </span>
            </div>
            <div className="node-info-panel__row">
              <span className="node-info-panel__label">Nombre</span>
              <span className="node-info-panel__value">
                {getRecordString(snapshot, "name") ?? "—"}
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