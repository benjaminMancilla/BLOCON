import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type RemoteComponent,
  searchRemoteComponents,
} from "../../../../../services/remote/componentsService";

type SearchState = "idle" | "loading" | "ready" | "error";

type ComponentSearchOptions = {
  minQueryLength: number;
  debounceMs: number;
  existingIds: Set<string>;
};

type ComponentSearchResult = {
  query: string;
  setQuery: (value: string) => void;
  results: RemoteComponent[];
  filteredResults: RemoteComponent[];
  state: SearchState;
  error: string | null;
  summary: string;
  showExisting: boolean;
  setShowExisting: (value: boolean) => void;
  triggerSearch: () => void;
  resetSearch: () => void;
};

export const useComponentSearch = ({
  minQueryLength,
  debounceMs,
  existingIds,
}: ComponentSearchOptions): ComponentSearchResult => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RemoteComponent[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<SearchState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [showExisting, setShowExisting] = useState(false);
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

  const resetSearch = useCallback(() => {
    clearPending();
    setResults([]);
    setTotal(0);
    setState("idle");
    setError(null);
  }, [clearPending]);

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
        if (controller.signal.aborted) return;

        setState("error");
        setError(
          err instanceof Error ? err.message : "No se pudo buscar componentes.",
        );
      }
    },
    [clearPending],
  );

  const triggerSearch = useCallback(() => {
    const trimmed = query.trim();
    if (trimmed.length < minQueryLength) return;

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      void runSearch(trimmed);
    }, debounceMs);
  }, [debounceMs, minQueryLength, query, runSearch]);

  useEffect(() => {
    return () => {
      clearPending();
    };
  }, [clearPending]);

  const filteredResults = useMemo(() => {
    if (showExisting) return results;
    return results.filter((item) => !existingIds.has(item.id));
  }, [existingIds, results, showExisting]);

  const summary = useMemo(() => {
    if (state === "idle") {
      const trimmed = query.trim();
      if (!trimmed) return "Escribe tu búsqueda y presiona Enter.";
      if (trimmed.length < minQueryLength) {
        return `Escribe al menos ${minQueryLength} caracteres y presiona Enter.`;
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
  }, [
    error,
    filteredResults.length,
    minQueryLength,
    query,
    results.length,
    showExisting,
    state,
    total,
  ]);

  return {
    query,
    setQuery,
    results,
    filteredResults,
    state,
    error,
    summary,
    showExisting,
    setShowExisting,
    triggerSearch,
    resetSearch,
  };
};