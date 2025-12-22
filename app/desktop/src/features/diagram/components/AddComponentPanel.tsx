import { useEffect, useMemo, useState } from "react";
import {
  type RemoteComponent,
  searchRemoteComponents,
} from "../../../services/remote/componentsService";

type SearchState = "idle" | "loading" | "ready" | "error";

export const AddComponentPanel = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RemoteComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<SearchState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setTotal(0);
      setState("idle");
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState("loading");
      setError(null);
      try {
        const response = await searchRemoteComponents(trimmed, 1, 20, {
          signal: controller.signal,
        });
        setResults(response.items);
        setTotal(response.total);
        setState("ready");
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        setState("error");
        setError(
          err instanceof Error ? err.message : "No se pudo buscar componentes.",
        );
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  const summary = useMemo(() => {
    if (state === "idle") {
      return "Escribe para buscar componentes remotos.";
    }
    if (state === "loading") {
      return "Buscando componentes...";
    }
    if (state === "error") {
      return error ?? "Ocurrió un error durante la búsqueda.";
    }
    if (!results.length) {
      return "No se encontraron resultados.";
    }
    return `Resultados: ${results.length} de ${total}`;
  }, [error, results.length, state, total]);

  return (
    <section className="add-component-panel">
      <header className="add-component-panel__header">
        <h2 className="add-component-panel__title">Agregar componente</h2>
        <p className="add-component-panel__subtitle">
          Busca componentes remotos para añadirlos al diagrama.
        </p>
      </header>
      <div className="add-component-panel__search">
        <label className="add-component-panel__label" htmlFor="component-search">
          Buscar
        </label>
        <input
          id="component-search"
          className="add-component-panel__input"
          type="search"
          placeholder="Ingresa un ID o nombre"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <p className="add-component-panel__summary">{summary}</p>
      </div>
      <div className="add-component-panel__results" role="list">
        {results.map((item) => {
          const title = item.title ?? item.kks_name ?? item.id;
          const meta = [item.type, item.SubType].filter(Boolean).join(" • ");
          return (
            <div className="add-component-panel__result" role="listitem" key={item.id}>
              <div className="add-component-panel__result-title">{title}</div>
              <div className="add-component-panel__result-meta">
                <span>{item.id}</span>
                {meta ? <span>{meta}</span> : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};