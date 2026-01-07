import { useCallback, useEffect, useState } from "react";
import type { DiagramViewState } from "../../../services/diagramViewService";
import { saveDiagramView } from "../../../services/diagramViewService";
import {
  deleteGlobalView,
  fetchGlobalView,
  reloadGlobalView,
  saveGlobalView,
} from "../../../services/globalViewService";
import { useGlobalViewToasts } from "./useToasts";
import type { ToastManager } from "./useToasts";

type UseGlobalViewOptions = {
  getCurrentView: () => DiagramViewState;
  onViewApplied?: () => Promise<void>;
  toasts: ToastManager;
};

type GlobalViewAction = "load" | "save" | "reload" | "delete";

type GlobalViewState = {
  exists: boolean;
  view: DiagramViewState | null;
};

const emptyState: GlobalViewState = {
  exists: false,
  view: null,
};

export const useGlobalView = ({
  getCurrentView,
  onViewApplied,
  toasts,
}: UseGlobalViewOptions) => {
  const globalViewToasts = useGlobalViewToasts(toasts);
  const [globalView, setGlobalView] = useState<GlobalViewState>(emptyState);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInFlight, setActionInFlight] =
    useState<GlobalViewAction | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const updateState = useCallback((next: GlobalViewState) => {
    setGlobalView({
      exists: Boolean(next.exists),
      view: next.view ?? null,
    });
  }, []);

  const runAction = useCallback(
    async <T,>(
      action: GlobalViewAction | null,
      actionFn: () => Promise<T>,
    ) => {
      if (action) {
        setActionInFlight(action);
      }
      setIsLoading(true);
      setLastError(null);
      try {
        return await actionFn();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error inesperado";
        setLastError(message);
        throw error;
      } finally {
        setIsLoading(false);
        if (action) {
          setActionInFlight(null);
        }
      }
    },
    [],
  );

  const refreshGlobalView = useCallback(async () => {
    const response = await runAction(null, () => fetchGlobalView());
    updateState(response);
    return response;
  }, [runAction, updateState]);

  useEffect(() => {
    void refreshGlobalView();
  }, [refreshGlobalView]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((current) => !current);
  }, []);

  const handleLoad = useCallback(async () => {
    const view = globalView.view
    if (!globalView.exists || !view) {
      globalViewToasts.showLoadNotFound();
      return;
    }
    try {
      await runAction("load", async () => {
        await saveDiagramView(view);
        await onViewApplied?.();
      });
      globalViewToasts.showLoadSuccess();
    } catch (error) {
      globalViewToasts.showLoadError();
    }
  }, [
    globalView.exists,
    globalView.view,
    globalViewToasts,
    onViewApplied,
    runAction,
  ]);

  const handleSave = useCallback(async () => {
    const snapshot = getCurrentView();
    try {
      await runAction("save", async () => {
        await saveGlobalView(snapshot);
        updateState({ exists: true, view: snapshot });
      });
      globalViewToasts.showSaveSuccess();
    } catch (error) {
      globalViewToasts.showSaveError();
    }
  }, [getCurrentView, globalViewToasts, runAction, updateState]);

  const handleReload = useCallback(async () => {
    try {
      const response = await runAction("reload", () => reloadGlobalView());
      updateState(response);
      globalViewToasts.showReloadSuccess();
    } catch (error) {
      globalViewToasts.showReloadError();
      throw error;
    }
  }, [globalViewToasts, runAction, updateState]);

  const handleDelete = useCallback(async () => {
    try {
      await runAction("delete", async () => {
        await deleteGlobalView();
        updateState(emptyState);
      });
      globalViewToasts.showDeleteSuccess();
    } catch (error) {
      globalViewToasts.showDeleteError();
    }
  }, [globalViewToasts, runAction, updateState]);

  return {
    exists: globalView.exists,
    view: globalView.view,
    isCollapsed,
    isLoading,
    actionInFlight,
    lastError,
    refreshGlobalView,
    toggleCollapse,
    loadGlobalView: handleLoad,
    saveGlobalView: handleSave,
    reloadGlobalView: handleReload,
    deleteGlobalView: handleDelete,
  };
};