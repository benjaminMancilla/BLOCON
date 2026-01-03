import { useCallback, useEffect, useState } from "react";
import type { ViewSummary } from "../../../services/viewsService";
import {
  createView,
  deleteView,
  listViews,
  loadView,
  renameView,
  saveView,
} from "../../../services/viewsService";

type ViewActionType = "create" | "save" | "load" | "rename" | "delete";

type ViewActionState = {
  type: ViewActionType;
  viewId?: string;
};

export const useViews = () => {
  const [views, setViews] = useState<ViewSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInFlight, setActionInFlight] = useState<ViewActionState | null>(
    null,
  );

  const refreshViews = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await listViews();
      setViews(items);
    } catch (error) {
      setViews([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshViews();
  }, [refreshViews]);

  const handleAction = useCallback(
    async <T,>(action: ViewActionState, actionFn: () => Promise<T>) => {
      setActionInFlight(action);
      try {
        return await actionFn();
      } finally {
        setActionInFlight(null);
      }
    },
    [],
  );

  const handleCreate = useCallback(
    async (name?: string) => {
      const result = await handleAction({ type: "create" }, () =>
        createView(name),
      );
      await refreshViews();
      return result;
    },
    [handleAction, refreshViews],
  );

  const handleSave = useCallback(
    async (viewId: string, name?: string) => {
      const result = await handleAction({ type: "save", viewId }, () =>
        saveView(viewId, name),
      );
      await refreshViews();
      return result;
    },
    [handleAction, refreshViews],
  );

  const handleRename = useCallback(
    async (viewId: string, name: string) => {
      const result = await handleAction({ type: "rename", viewId }, () =>
        renameView(viewId, name),
      );
      await refreshViews();
      return result;
    },
    [handleAction, refreshViews],
  );

  const handleDelete = useCallback(
    async (viewId: string) => {
      const result = await handleAction({ type: "delete", viewId }, () =>
        deleteView(viewId),
      );
      await refreshViews();
      return result;
    },
    [handleAction, refreshViews],
  );

  const handleLoad = useCallback(
    async (viewId: string) => {
      const result = await handleAction({ type: "load", viewId }, () =>
        loadView(viewId),
      );
      await refreshViews();
      return result;
    },
    [handleAction, refreshViews],
  );

  return {
    views,
    isLoading,
    actionInFlight,
    refreshViews,
    createView: handleCreate,
    saveView: handleSave,
    renameView: handleRename,
    deleteView: handleDelete,
    loadView: handleLoad,
  };
};