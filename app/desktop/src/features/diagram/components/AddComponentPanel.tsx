import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type RemoteComponent,
  searchRemoteComponents,
} from "../../../services/remote/componentsService";
import {
  DiagramElementSelector,
} from "./DiagramElementSelector";
import { buildGateColorVars, resolveGateColor } from "../utils/gateColors";
import type {
  DiagramNodeSelection,
  SelectionStatus,
} from "../types/selection";
import type { GateType } from "../types/gates";
import type { AddComponentFormState } from "../types/addComponent";

type SearchState = "idle" | "loading" | "ready" | "error";

type AddComponentStep = "selection" | "gateType" | "organization";

type AddComponentPanelProps = {
  step: AddComponentStep;
  selectionStatus: SelectionStatus;
  draftSelection: DiagramNodeSelection | null;
  gateType: GateType | null;
  isOrganizing: boolean;
  confirmedSelection: DiagramNodeSelection | null;
  formState: AddComponentFormState;
  existingNodeIds?: Set<string>;
  resetToken?: number;
  onSelectionConfirm: (selection: DiagramNodeSelection) => void;
  onSelectionCancel: () => void;
  onSelectionStart: () => void;
  onGateTypeChange: (gateType: GateType | null) => void;
  onSelectionReset: () => void;
  onFormStateChange: (nextState: AddComponentFormState) => void;
  onOrganizationStart: () => void;
  onOrganizationCancel: () => void;
  onInsert: () => void;
};

const ENTER_DEBOUNCE_MS = 650;
const MIN_QUERY_LEN = 2;

export const AddComponentPanel = ({
  step,
  selectionStatus,
  draftSelection,
  gateType,
  isOrganizing,
  confirmedSelection,
  formState,
  existingNodeIds = new Set<string>(),
  resetToken = 0,
  onSelectionConfirm,
  onSelectionCancel,
  onSelectionStart,
  onGateTypeChange,
  onSelectionReset,
  onFormStateChange,
  onOrganizationStart,
  onOrganizationCancel,
  onInsert,
}: AddComponentPanelProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RemoteComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<SearchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] =
    useState<RemoteComponent | null>(null);
  const [isSelectedSectionOpen, setIsSelectedSectionOpen] = useState(true);
  const [isCalcSectionOpen, setIsCalcSectionOpen] = useState(true);
  const [isGateSectionOpen, setIsGateSectionOpen] = useState(true);
  const [showExisting, setShowExisting] = useState(false);
  const [shakingItems, setShakingItems] = useState<Record<string, boolean>>({});
  // Search is manual (Enter), but we still debounce Enter to avoid spamming.
  const debounceTimerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const shakeTimersRef = useRef<Record<string, number>>({});
  const selectionResetRef = useRef<string | null>(null);
  const stepResetRef = useRef<AddComponentStep | null>(null);

  const clearPending = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const runSearch = useCallback(
    async (term: string) => {
      clearPending();

      const controller = new AbortController();
      abortRef.current = controller;

      setState("loading");
      setError(null);

      try {
        const response = await searchRemoteComponents(term, 1, 20, {
          signal: controller.signal,
        });
        setResults(response.items);
        setTotal(response.total);
        setState("ready");
      } catch (err) {
        // Fetch aborts are expected when the user triggers a newer search.
        if (controller.signal.aborted) return;

        setState("error");
        setError(
          err instanceof Error ? err.message : "No se pudo buscar componentes.",
        );
      }
    },
    [clearPending],
  );

  const scheduleSearch = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LEN) return;

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void runSearch(trimmed);
    }, ENTER_DEBOUNCE_MS);
  }, [query, runSearch]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      clearPending();
      Object.values(shakeTimersRef.current).forEach((timer) =>
        window.clearTimeout(timer),
      );
    };
  }, [clearPending]);

  const triggerShake = useCallback((componentId: string) => {
    setShakingItems((prev) => ({ ...prev, [componentId]: true }));
    const existingTimer = shakeTimersRef.current[componentId];
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }
    shakeTimersRef.current[componentId] = window.setTimeout(() => {
      setShakingItems((prev) => {
        const next = { ...prev };
        delete next[componentId];
        return next;
      });
      delete shakeTimersRef.current[componentId];
    }, 420);
  }, []);

  useEffect(() => {
    if (selectionResetRef.current === confirmedSelection?.id) return;
    selectionResetRef.current = confirmedSelection?.id ?? null;
    setIsGateSectionOpen(true);
    onGateTypeChange(null);
  }, [confirmedSelection?.id, onGateTypeChange]);

  useEffect(() => {
    if (stepResetRef.current === step) return;
    stepResetRef.current = step;
    if (step === "gateType") {
      onGateTypeChange(null);
      setIsGateSectionOpen(true);
    }
  }, [onGateTypeChange, step]);

  useEffect(() => {
    setSelectedComponent(null);
    setIsSelectedSectionOpen(true);
    setIsCalcSectionOpen(true);
    setIsGateSectionOpen(true);
  }, [resetToken]);

  const filteredResults = useMemo(() => {
    if (showExisting) return results;
    return results.filter((item) => !existingNodeIds.has(item.id));
  }, [existingNodeIds, showExisting, results]);

  const summary = useMemo(() => {
    if (state === "idle") {
      const trimmed = query.trim();
      if (!trimmed) return "Escribe tu búsqueda y presiona Enter.";
      if (trimmed.length < MIN_QUERY_LEN) {
        return `Escribe al menos ${MIN_QUERY_LEN} caracteres y presiona Enter.`;
      }
      return "Presiona Enter para buscar.";
    }
    if (state === "loading") return "Buscando componentes...";
    if (state === "error") return error ?? "Ocurrió un error durante la búsqueda.";
    if (!results.length) return "No se encontraron resultados.";
    if (showExisting && !filteredResults.length) {
      return "Todos los componentes ya existen en el diagrama.";
    }
    return `Resultados: ${filteredResults.length} de ${total}`;
  }, [error, filteredResults.length, showExisting, query, results.length, state, total]);

  const handleSelectComponent = useCallback(
    (item: RemoteComponent) => {
      if (existingNodeIds.has(item.id)) {
        triggerShake(item.id);
        return;
      }
      setSelectedComponent(item);
      onFormStateChange({
        componentId: item.id,
        calculationType: "exponential",
      });
      setIsSelectedSectionOpen(true);
      setIsCalcSectionOpen(true);
      setIsGateSectionOpen(true);
      onGateTypeChange(null);
      onSelectionStart();
    },
    [existingNodeIds, onFormStateChange, onGateTypeChange, onSelectionStart, triggerShake],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedComponent(null);
    onFormStateChange({
      componentId: null,
      calculationType: "exponential",
    });
    setIsSelectedSectionOpen(true);
    setIsCalcSectionOpen(true);
    setIsGateSectionOpen(true);
    onGateTypeChange(null);
    onSelectionReset();
  }, [onFormStateChange, onGateTypeChange, onSelectionReset]);

  const calculationOptions = [
    {
      value: "exponential" as const,
      label: "Exponencial",
      icon: "λ",
    },
    {
      value: "weibull" as const,
      label: "Weibull",
      icon: "β",
    },
  ];

  const gateOptions = [
    {
      value: "and" as const,
      label: "AND",
    },
    {
      value: "or" as const,
      label: "OR",
    },
    {
      value: "koon" as const,
      label: "KOON",
    },
  ];

  const subtitle = selectedComponent
    ? step === "selection"
      ? "Selecciona el elemento del diagrama para insertar el componente."
      : confirmedSelection?.type === "component" ||
          confirmedSelection?.type === "collapsedGate"
        ? "Escoge tipo de gate y reordena los elementos en el orden que quieras."
        : "Continúa con la organización del diagrama."
    : "Busca componentes remotos para añadirlos al diagrama.";

  const shouldShowGateSection =
    (confirmedSelection?.type === "component" ||
      confirmedSelection?.type === "collapsedGate") &&
    (step === "gateType" || step === "organization");
  const shouldShowOrganizationSection = step === "organization";
  const organizationLabel = confirmedSelection?.type === "gate"
    ? `la gate ${confirmedSelection.id}`
    : gateType
      ? `el nuevo ${gateType.toUpperCase()}`
      : "el nuevo gate";

  return (
    <section className="add-component-panel">
      <header className="add-component-panel__header">
        <h2 className="add-component-panel__title">Agregar componente</h2>
        <p className="add-component-panel__subtitle">{subtitle}</p>
      </header>

      {selectedComponent ? (
        <>
          <div className="add-component-panel__selected">
            <p className="add-component-panel__selected-label">
              Componente seleccionado
              <button
                className="add-component-panel__section-toggle"
                type="button"
                onClick={() =>
                  setIsSelectedSectionOpen((prev) => !prev)
                }
                aria-expanded={isSelectedSectionOpen}
                aria-controls="add-component-selected"
              >
                {isSelectedSectionOpen ? "▾" : "▴"}
              </button>
            </p>
            {isSelectedSectionOpen ? (
              <div
                className="add-component-panel__selected-card"
                id="add-component-selected"
              >
                <div className="add-component-panel__selected-header">
                  <div>
                    <div className="add-component-panel__selected-title">
                      {selectedComponent.title ??
                        selectedComponent.kks_name ??
                        selectedComponent.id}
                    </div>
                    <div className="add-component-panel__selected-meta">
                      <span>{selectedComponent.id}</span>
                      {[
                        selectedComponent.type,
                        selectedComponent.SubType,
                      ].filter(Boolean).length ? (
                        <span>
                          {[selectedComponent.type, selectedComponent.SubType]
                            .filter(Boolean)
                            .join(" • ")}
                        </span>
                      ) : null}
                    </div>
                  </div>
                   <button
                    className="add-component-panel__selected-clear"
                    type="button"
                    onClick={handleClearSelection}
                    aria-label="Deseleccionar componente"
                  >
                    ×
                  </button>                 
                </div>
              </div>
            ) : null}
          </div>

          <fieldset
            className={`add-component-panel__calc${
              isCalcSectionOpen ? "" : " add-component-panel__calc--collapsed"
            }`}
          >
            <legend className="add-component-panel__calc-label">
              Tipo de cálculo
              <button
                className="add-component-panel__section-toggle"
                type="button"
                onClick={() => setIsCalcSectionOpen((prev) => !prev)}
                aria-expanded={isCalcSectionOpen}
                aria-controls="add-component-calculation"
              >
                {isCalcSectionOpen ? "▾" : "▴"}
              </button>
            </legend>
            {isCalcSectionOpen ? (
              <div
                className="add-component-panel__calc-options"
                id="add-component-calculation"
              >
                {calculationOptions.map((option) => (
                  <label
                    key={option.value}
                    className="add-component-panel__calc-option"
                  >
                    <input
                      type="radio"
                      name="calculation-type"
                      value={option.value}
                      checked={formState.calculationType === option.value}
                      onChange={() =>
                        onFormStateChange({
                          ...formState,
                          calculationType: option.value,
                        })
                      }
                    />
                    <span className="diagram-node__icon">{option.icon}</span>
                    <span className="add-component-panel__calc-text">
                      {option.label}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>

          <DiagramElementSelector
            status={selectionStatus}
            draftSelection={draftSelection}
            confirmedSelection={confirmedSelection}
            onSelectionConfirmed={onSelectionConfirm}
            onSelectionCleared={onSelectionCancel}
            onSelectionStart={onSelectionStart}
          />

          {shouldShowGateSection ? (
            <fieldset
              className={`add-component-panel__gate${
                isGateSectionOpen ? "" : " add-component-panel__gate--collapsed"
              }`}
            >
              <legend className="add-component-panel__gate-label">
                Tipo de gate
                <button
                  className="add-component-panel__section-toggle"
                  type="button"
                  onClick={() => setIsGateSectionOpen((prev) => !prev)}
                  aria-expanded={isGateSectionOpen}
                  aria-controls="add-component-gate-type"
                >
                  {isGateSectionOpen ? "▾" : "▴"}
                </button>
              </legend>
              {isGateSectionOpen ? (
                <div
                  className="add-component-panel__gate-options"
                  id="add-component-gate-type"
                >
                  {gateOptions.map((option) => {
                    const gateColor = resolveGateColor(option.value, null);
                    const colorVars = buildGateColorVars(gateColor) as CSSProperties;
                    return (
                      <label
                        key={option.value}
                        className="add-component-panel__gate-option"
                      >
                        <input
                          type="radio"
                      value={option.value}
                      checked={gateType === option.value}
                      onChange={() =>
                        onGateTypeChange(option.value)
                      }
                    />                          
                        <span
                          className="add-component-panel__gate-icon"
                          style={colorVars}
                        >
                          {option.label}
                        </span>
                        <span className="add-component-panel__gate-text">
                          {option.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : null}
            </fieldset>
          ) : null}

          {shouldShowOrganizationSection ? (
            <section className="add-component-panel__organization">
              <div className="add-component-panel__organization-header">
                <span>Organización</span>
                <span className="add-component-panel__organization-pill">
                  {isOrganizing ? "Organizando" : "Inactivo"}
                </span>
              </div>
              {isOrganizing ? (
                <>
                  <p className="add-component-panel__organization-text">
                    Organiza los elementos dentro de {organizationLabel}.
                  </p>
                  <div className="add-component-panel__organization-actions">
                    <button
                      className="add-component-panel__diagram-button add-component-panel__diagram-button--ghost"
                      type="button"
                      onClick={onOrganizationCancel}
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="add-component-panel__organization-text">
                    Organiza los elementos dentro de {organizationLabel}.
                  </p>
                  <div className="add-component-panel__organization-actions">
                    <button
                      className="add-component-panel__diagram-button"
                      type="button"
                      onClick={onOrganizationStart}
                    >
                      Organizar
                    </button>
                  </div>
                </>
              )}
            </section>
          ) : null}

          {shouldShowOrganizationSection ? (
            <div className="add-component-panel__footer">
              <button
                className="add-component-panel__diagram-button add-component-panel__diagram-button--primary"
                type="button"
                onClick={onInsert}
              >
                Insertar
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="add-component-panel__search">
            <label
              className="add-component-panel__label"
              htmlFor="component-search"
            >
              Buscar
            </label>

            <input
              id="component-search"
              className="add-component-panel__input"
              type="search"
              placeholder="Ingresa un ID o nombre"
              value={query}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);

                if (!value.trim()) {
                  // Keep UX tidy when clearing the box.
                  clearPending();
                  setResults([]);
                  setTotal(0);
                  setState("idle");
                  setError(null);
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                scheduleSearch();
              }}
            />

            <div className="add-component-panel__filters">
              <label className="add-component-panel__filter">
                <input
                  type="checkbox"
                  checked={showExisting}
                  onChange={(event) => setShowExisting(event.target.checked)}
                />
                Mostrar ya agregados
              </label>
            </div>

            <p className="add-component-panel__summary">{summary}</p>
          </div>

          <div className="add-component-panel__results" role="list">
            {filteredResults.map((item) => {
              const title = item.title ?? item.kks_name ?? item.id;
              const meta = [item.type, item.SubType].filter(Boolean).join(" • ");
              const isExisting = existingNodeIds.has(item.id);
              const isShaking = Boolean(shakingItems[item.id]);
              return (
                <button
                  className={`add-component-panel__result${
                    isExisting ? " add-component-panel__result--disabled" : ""
                  }${isShaking ? " add-component-panel__result--shake" : ""}`}
                  role="listitem"
                  key={item.id}
                  type="button"
                  aria-disabled={isExisting}
                  onClick={() => handleSelectComponent(item)}
                >
                  <div className="add-component-panel__result-title">
                    {title}
                  </div>
                  <div className="add-component-panel__result-meta">
                    <span>{item.id}</span>
                    {meta ? <span>{meta}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};