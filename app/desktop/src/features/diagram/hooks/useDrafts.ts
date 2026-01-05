import { useCallback, useEffect, useState } from "react";
import type { DraftListResult, DraftSummary } from "../../../services/draftService";
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
  const [draftLimit, setDraftLimit] = useState<DraftListResult>({
    items: [],
    maxDrafts: 0,
    draftCount: 0,
    isFull: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [actionInFlight, setActionInFlight] =
    useState<DraftActionState | null>(null);

  const refreshDrafts = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listDrafts();
      setDrafts(result.items);
      setDraftLimit(result);
    } catch (error) {
      setDrafts([]);
      setDraftLimit({
        items: [],
        maxDrafts: 0,
        draftCount: 0,
        isFull: false,
      });
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
      try {
        return await handleAction({ type: "create" }, () => createDraft(name));
      } finally {
        await refreshDrafts();
      }
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
    draftCount: draftLimit.draftCount,
    maxDrafts: draftLimit.maxDrafts,
    isFull: draftLimit.isFull,
    createDraft: handleCreate,
    saveDraft: handleSave,
    renameDraft: handleRename,
    deleteDraft: handleDelete,
    loadDraft: handleLoad,
  };
};