import { useCallback, useEffect, useState } from "react";
import type { DraftSummary } from "../../../services/draftService";
import {
  createDraft,
  deleteDraft,
  listDrafts,
  loadDraft,
  renameDraft,
  saveDraft,
} from "../../../services/draftService";

type DraftActionType = "create" | "save" | "load" | "rename" | "delete";

type DraftActionState = {
  type: DraftActionType;
  draftId?: string;
};

export const useDrafts = () => {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionInFlight, setActionInFlight] =
    useState<DraftActionState | null>(null);

  const refreshDrafts = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await listDrafts();
      setDrafts(items);
    } catch (error) {
      setDrafts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDrafts();
  }, [refreshDrafts]);

  const handleAction = useCallback(
    async <T,>(action: DraftActionState, actionFn: () => Promise<T>) => {
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
        createDraft(name),
      );
      await refreshDrafts();
      return result;
    },
    [handleAction, refreshDrafts],
  );

  const handleSave = useCallback(
    async (draftId: string, name?: string) => {
      const result = await handleAction({ type: "save", draftId }, () =>
        saveDraft(draftId, name),
      );
      await refreshDrafts();
      return result;
    },
    [handleAction, refreshDrafts],
  );

  const handleRename = useCallback(
    async (draftId: string, name: string) => {
      const result = await handleAction({ type: "rename", draftId }, () =>
        renameDraft(draftId, name),
      );
      await refreshDrafts();
      return result;
    },
    [handleAction, refreshDrafts],
  );

  const handleDelete = useCallback(
    async (draftId: string) => {
      const result = await handleAction({ type: "delete", draftId }, () =>
        deleteDraft(draftId),
      );
      await refreshDrafts();
      return result;
    },
    [handleAction, refreshDrafts],
  );

  const handleLoad = useCallback(
    async (draftId: string) => {
      const result = await handleAction({ type: "load", draftId }, () =>
        loadDraft(draftId),
      );
      await refreshDrafts();
      return result;
    },
    [handleAction, refreshDrafts],
  );

  return {
    drafts,
    isLoading,
    actionInFlight,
    refreshDrafts,
    createDraft: handleCreate,
    saveDraft: handleSave,
    renameDraft: handleRename,
    deleteDraft: handleDelete,
    loadDraft: handleLoad,
  };
};