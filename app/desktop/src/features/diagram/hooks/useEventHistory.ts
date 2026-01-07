import { useCallback, useEffect, useState, useRef } from "react";
import {
  fetchEventHistoryPage,
  type EventHistoryItem,
} from "../../../services/eventHistoryService";

type UseEventHistoryOptions = {
  isOpen: boolean;
  pageSize?: number;
};

export type EventHistoryState = {
  events: EventHistoryItem[];
  total: number;
  offset: number;
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  totalPages: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  goNext: () => void;
  goPrevious: () => void;
  reset: () => void;
  refresh: () => void;
};

const DEFAULT_PAGE_SIZE = 50;

export const useEventHistory = ({
  isOpen,
  pageSize = DEFAULT_PAGE_SIZE,
}: UseEventHistoryOptions): EventHistoryState => {
  const [events, setEvents] = useState<EventHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const hasLoadedData = useRef(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const reset = useCallback(() => {
    setEvents([]);
    setTotal(0);
    setOffset(0);
    setPage(0);
    setErrorMessage(null);
    hasLoadedData.current = false;
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
    hasLoadedData.current = false;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (hasLoadedData.current && events.length > 0 && refreshKey === 0) {
      return;
    }

    let isActive = true;
    const nextOffset = page * pageSize;
    setIsLoading(true);
    setErrorMessage(null);
    
    fetchEventHistoryPage({ offset: nextOffset, limit: pageSize })
      .then((response) => {
        if (!isActive) return;
        setEvents(response.events ?? []);
        setTotal(response.total ?? 0);
        setOffset(response.offset ?? nextOffset);
        hasLoadedData.current = true;
      })
      .catch(() => {
        if (!isActive) return;
        setErrorMessage("No se pudo cargar el historial de eventos.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });
    
    return () => {
      isActive = false;
    };
  }, [isOpen, page, pageSize, refreshKey, events.length]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canGoPrevious = page > 0;
  const canGoNext = offset + events.length < total;

  const goPrevious = useCallback(() => {
    setPage((current) => Math.max(0, current - 1));
    hasLoadedData.current = false;
  }, []);

  const goNext = useCallback(() => {
    setPage((current) => current + 1);
    hasLoadedData.current = false;
  }, []);

  return {
    events,
    total,
    offset,
    isLoading,
    errorMessage,
    page,
    totalPages,
    canGoNext,
    canGoPrevious,
    goNext,
    goPrevious,
    reset,
    refresh,
  };
};