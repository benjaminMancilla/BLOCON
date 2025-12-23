import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type RemoteComponent,
  searchRemoteComponents,
} from "../../../services/remote/componentsService";

type SearchState = "idle" | "loading" | "ready" | "error";

type CalculationType = "exponential" | "weibull";

type AddComponentFormState = {
  componentId: string | null;
  calculationType: CalculationType;
};

const ENTER_DEBOUNCE_MS = 650;
const MIN_QUERY_LEN = 2;

export const AddComponentPanel = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RemoteComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<SearchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedComponent, setSelectedComponent] =
    useState<RemoteComponent | null>(null);
  const [formState, setFormState] = useState<AddComponentFormState>({
    componentId: null,
    calculationType: "exponential",
  });

  // Search is manual (Enter), but we still debounce Enter to avoid spamming.
  const debounceTimerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
  useEffect(() => clearPending, [clearPending]);

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
    return `Resultados: ${results.length} de ${total}`;
  }, [error, query, results.length, state, total]);

  const handleSelectComponent = useCallback((item: RemoteComponent) => {
    setSelectedComponent(item);
    setFormState({
      componentId: item.id,
      calculationType: "exponential",
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedComponent(null);
    setFormState((prev) => ({
      ...prev,
      componentId: null,
    }));
  }, []);

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

  return (
    <section className="add-component-panel">
      <header className="add-component-panel__header">
        <h2 className="add-component-panel__title">Agregar componente</h2>
        <p className="add-component-panel__subtitle">
          Busca componentes remotos para añadirlos al diagrama.
        </p>
      </header>

      {selectedComponent ? (
        <>
          <div className="add-component-panel__selected">
            <p className="add-component-panel__selected-label">
              Componente seleccionado:
              <span className="add-component-panel__section-toggle">▾</span>
            </p>
            <div className="add-component-panel__selected-card">
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
          </div>

          <fieldset className="add-component-panel__calc">
            <legend className="add-component-panel__calc-label">
              Tipo de cálculo
              <span className="add-component-panel__section-toggle">▾</span>
            </legend>
            <div className="add-component-panel__calc-options">
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
                      setFormState((prev) => ({
                        ...prev,
                        calculationType: option.value,
                      }))
                    }
                  />
                  <span className="diagram-node__icon">{option.icon}</span>
                  <span className="add-component-panel__calc-text">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
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

            <p className="add-component-panel__summary">{summary}</p>
          </div>

          <div className="add-component-panel__results" role="list">
            {results.map((item) => {
              const title = item.title ?? item.kks_name ?? item.id;
              const meta = [item.type, item.SubType].filter(Boolean).join(" • ");
              return (
                <button
                  className="add-component-panel__result"
                  role="listitem"
                  key={item.id}
                  type="button"
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