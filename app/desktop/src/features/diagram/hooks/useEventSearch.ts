import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import type { EventHistoryItem } from "../../../services/eventHistoryService";
import {
  searchEventHistoryPage,
  type EventSearchCriteria,
} from "../../../services/eventSearchService";
import { parseEventSearchInput } from "../utils/eventSearchParser";

const DEFAULT_PAGE_SIZE = 50;

type UseEventSearchOptions = {
  isOpen: boolean;
  pageSize?: number;
};

type EventSearchState = {
  query: string;
  isActive: boolean;
  criteria: EventSearchCriteria | null;
  events: EventHistoryItem[];
  total: number;
  offset: number;
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  totalPages: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  updateQuery: (value: string) => void;
  submitSearch: () => void;
  goNext: () => void;
  goPrevious: () => void;
};

export const useEventSearch = ({
  isOpen,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseEventSearchOptions): EventSearchState => {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [events, setEvents] = useState<EventHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lastLoadedPage = useRef<number>(-1);
  const lastLoadedCriteria = useRef<string>("");

  const criteria = useMemo(
    () => parseEventSearchInput(submittedQuery),
    [submittedQuery],
  );
  const isActive = Boolean(criteria);

  const resetResults = useCallback(() => {
    setEvents([]);
    setTotal(0);
    setOffset(0);
    setPage(0);
    setErrorMessage(null);
    setIsLoading(false);
    lastLoadedPage.current = -1;
    lastLoadedCriteria.current = "";
  }, []);

  const updateQuery = useCallback(
    (value: string) => {
      setQuery(value);
      if (!value.trim()) {
        setSubmittedQuery("");
        resetResults();
      }
    },
    [resetResults],
  );

  const submitSearch = useCallback(() => {
    const trimmed = query.trim();
    setSubmittedQuery(trimmed);
    setPage(0);
    setOffset(0);
    setEvents([]);
    setTotal(0);
    setErrorMessage(null);
    lastLoadedPage.current = -1;
    lastLoadedCriteria.current = "";
    if (!trimmed) {
      resetResults();
    }
  }, [query, resetResults]);

  useEffect(() => {
    if (!isOpen || !criteria) return;
    const criteriaKey = JSON.stringify(criteria);
    if (lastLoadedPage.current === page && lastLoadedCriteria.current === criteriaKey) {
      return;
    }

    let isCurrent = true;
    const nextOffset = page * pageSize;

    setIsLoading(true);
    setErrorMessage(null);

    searchEventHistoryPage({ criteria, offset: nextOffset, limit: pageSize })
      .then((response) => {
        if (!isCurrent) return;
        setEvents(response.events ?? []);
        setTotal(response.total ?? 0);
        setOffset(response.offset ?? nextOffset);
        lastLoadedPage.current = page;
        lastLoadedCriteria.current = criteriaKey;
      })
      .catch(() => {
        if (!isCurrent) return;
        setErrorMessage("No se pudo cargar la búsqueda de eventos.");
      })
      .finally(() => {
        if (!isCurrent) return;
        setIsLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [criteria, isOpen, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canGoPrevious = page > 0;
  const canGoNext = offset + events.length < total;

  const goPrevious = useCallback(() => {
    setPage((current) => Math.max(0, current - 1));
  }, []);

  const goNext = useCallback(() => {
    setPage((current) => current + 1);
  }, []);

  return {
    query,
    isActive,
    criteria,
    events,
    total,
    offset,
    isLoading,
    errorMessage,
    page,
    totalPages,
    canGoNext,
    canGoPrevious,
    updateQuery,
    submitSearch,
    goNext,
    goPrevious,
  };
};