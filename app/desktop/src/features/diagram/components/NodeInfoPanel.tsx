import { useEffect, useMemo, useState } from "react";
import { DiagramSidePanelLeft } from "./DiagramSidePanelLeft";
import { NodeFailuresTable } from "./NodeFailuresTable";
import { NodeTypeIcon } from "./NodeTypeIcon";
import type { NodeDetailsResponse } from "../../../services/nodeDetailsApi";
import { CalculationTypeSelect } from "./CalculationTypeSelect";
import { useNodeEdit } from "../hooks/useNodeEdit";
import type { ToastManager } from "../hooks/useToasts";
import type { CalculationType } from "../types/addComponent";
import {
  formatCalculationTypeLabel,
  normalizeCalculationType,
} from "../icons/calculationTypeIcons";

const formatReliability = (reliability: number | null) => {
  if (reliability === null) return "—";
  return `${(reliability * 100).toFixed(1)}%`;
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
  onRefresh: () => void;
  onGraphReload: () => void;
  toasts: ToastManager;
};

export const NodeInfoPanel = ({
  isOpen,
  dependency,
  loading,
  error,
  data,
  onClose,
  onRefresh,
  onGraphReload,
  toasts,
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
  const normalizedCalculationType =
    normalizeCalculationType(calculationType) ?? "exponential";
  const cacheId = cache ? getRecordString(cache, "id") : null;
  const kksName = cache ? getRecordString(cache, "kks_name") : null;
  const title = data?.id ?? cacheId ?? "Nodo";
  const componentType = cache ? getRecordString(cache, "type") : null;
  const gateSubtype =
    getRecordString(snapshot, "subtype") ??
    getRecordString(snapshot, "SubType");
  const currentK = getSnapshotNumber(snapshot, "k") ?? 1;
  const childrenCount = getSnapshotNumber(snapshot, "children_count") ?? null;
  const isKoonGate = data?.kind === "gate" && gateSubtype === "KOON";

  const { isSaving, error: editError, editGate, editComponent } = useNodeEdit();
  const [kInput, setKInput] = useState(String(currentK));
  const [kServerError, setKServerError] = useState<string | null>(null);
  const [calculationInput, setCalculationInput] = useState<CalculationType>(
    normalizedCalculationType,
  );
  const [calculationServerError, setCalculationServerError] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!isKoonGate) return;
    setKInput(String(currentK));
    setKServerError(null);
  }, [currentK, isKoonGate]);

  useEffect(() => {
    setCalculationInput(normalizedCalculationType);
    setCalculationServerError(null);
  }, [normalizedCalculationType]);

  const parsedK = useMemo(() => {
    if (!kInput.trim()) return null;
    const value = Number(kInput);
    if (!Number.isInteger(value)) return null;
    return value;
  }, [kInput]);

  useEffect(() => {
    if (kServerError) {
      setKServerError(null);
    }
  }, [kInput, kServerError]);

  useEffect(() => {
    if (calculationServerError) {
      setCalculationServerError(null);
    }
  }, [calculationInput, calculationServerError]);

  const kRange =
    childrenCount !== null ? { min: 1, max: childrenCount } : null;
  const kValidationError = useMemo(() => {
    if (!kInput.trim()) {
      return "Ingresa un valor para K.";
    }
    if (parsedK === null) {
      return "K debe ser un entero.";
    }
    if (kRange && (parsedK < kRange.min || parsedK > kRange.max)) {
      return `K debe estar entre ${kRange.min} y ${kRange.max}.`;
    }
    return null;
  }, [kInput, parsedK, kRange]);

  const kIsValid = kValidationError === null && kRange !== null;
  const kIsDirty = parsedK !== null && parsedK !== currentK;
  const calculationIsDirty = calculationInput !== normalizedCalculationType;

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
                {formatCalculationTypeLabel(calculationType)}
              </span>
            </div>
            <div className="node-info-panel__section node-info-panel__section--stacked">
              <h3 className="node-info-panel__section-title">Historial de fallas</h3>
              <NodeFailuresTable failures={data?.failures} />
            </div>
            <div className="node-info-panel__section node-info-panel__section--settings">
              <h3 className="node-info-panel__section-title">Ajustes</h3>
              <div className="node-info-panel__field">
                <label
                  className="node-info-panel__field-label"
                  htmlFor="component-calculation-type"
                >
                  Tipo de cálculo
                </label>
                <div className="node-info-panel__field-control">
                  <CalculationTypeSelect
                    id="component-calculation-type"
                    value={calculationInput}
                    onChange={setCalculationInput}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        setCalculationInput(normalizedCalculationType);
                        setCalculationServerError(null);
                      }
                    }}
                    disabled={isSaving}
                  />
                  {calculationIsDirty ? (
                    <button
                      type="button"
                      className="node-info-panel__field-action"
                      onClick={async () => {
                        const error = await editComponent(data.id, {
                          dist: { kind: calculationInput },
                        });
                        if (error) {
                          setCalculationServerError(error.message);
                          toasts.error(error.message, "general");
                          return;
                        }
                        toasts.success("Tipo de cálculo actualizado", "general");
                        onGraphReload();
                        onRefresh();
                      }}
                      disabled={isSaving}
                      aria-label="Aplicar tipo de cálculo"
                    >
                      {isSaving ? (
                        <span className="node-info-panel__spinner" />
                      ) : (
                        "Aplicar"
                      )}
                    </button>
                  ) : null}
                  {calculationIsDirty ? (
                    <button
                      type="button"
                      className="node-info-panel__field-action node-info-panel__field-action--ghost"
                      onClick={() => {
                        setCalculationInput(normalizedCalculationType);
                        setCalculationServerError(null);
                      }}
                      disabled={isSaving}
                      aria-label="Cancelar cambios"
                    >
                      Cancelar
                    </button>
                  ) : null}
                </div>
                {calculationServerError ? (
                  <div className="node-info-panel__field-error">
                    {calculationServerError}
                  </div>
                ) : null}
                {editError &&
                editError.field === "dist.kind" &&
                !calculationServerError ? (
                  <div className="node-info-panel__field-error">
                    {editError.message}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {!loading && !error && data?.kind === "gate" ? (
          <>
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
            <div className="node-info-panel__section node-info-panel__section--settings">
              <h3 className="node-info-panel__section-title">Ajustes</h3>
              {isKoonGate ? (
                <div className="node-info-panel__field">
                  <label className="node-info-panel__field-label" htmlFor="koon-k-input">
                    K (KOON)
                  </label>
                  <div className="node-info-panel__field-control">
                    <input
                      id="koon-k-input"
                      type="number"
                      inputMode="numeric"
                      step={1}
                      min={kRange?.min}
                      max={kRange?.max}
                      value={kInput}
                      onChange={(event) => setKInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setKInput(String(currentK));
                          setKServerError(null);
                        }
                      }}
                      disabled={isSaving || kRange === null}
                      className="node-info-panel__field-input"
                    />
                    {kIsDirty && kIsValid ? (
                      <button
                        type="button"
                        className="node-info-panel__field-action"
                        onClick={async () => {
                          if (parsedK === null) return;
                          const error = await editGate(data.id, { k: parsedK });
                          if (error) {
                            setKServerError(error.message);
                            toasts.error(error.message, "general");
                            return;
                          }
                          toasts.success("K actualizado.", "general");
                          onGraphReload();
                          onRefresh();
                        }}
                        disabled={isSaving}
                        aria-label="Aplicar K"
                      >
                        {isSaving ? (
                          <span className="node-info-panel__spinner" />
                        ) : (
                          "Aplicar"
                        )}
                      </button>
                    ) : null}
                    {kIsDirty ? (
                      <button
                        type="button"
                        className="node-info-panel__field-action node-info-panel__field-action--ghost"
                        onClick={() => {
                          setKInput(String(currentK));
                          setKServerError(null);
                        }}
                        disabled={isSaving}
                        aria-label="Cancelar cambios"
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                  {kValidationError ? (
                    <div className="node-info-panel__field-error">
                      {kValidationError}
                    </div>
                  ) : null}
                  {kServerError ? (
                    <div className="node-info-panel__field-error">
                      {kServerError}
                    </div>
                  ) : null}
                  {editError && editError.field === "k" && !kServerError ? (
                    <div className="node-info-panel__field-error">
                      {editError.message}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="node-info-panel__placeholder">
                  Sin parámetros editables por ahora.
                </p>
              )}
            </div>
          </>
        ) : null}
      </section>
    </DiagramSidePanelLeft>
  );
};