import { useCallback } from "react";
import { useDrafts } from "./useDrafts";
import { useDraftToasts } from "./useToasts";
import type { ToastManager } from "./useToasts";

type UseDraftHandlersOptions = {
  toasts: ToastManager;
  onGraphReload?: () => void;
};

/**
 * Hook que encapsula toda la lógica de manejo de drafts
 * incluyendo toasts y efectos secundarios
 */
export function useDraftHandlers({ toasts, onGraphReload }: UseDraftHandlersOptions) {
  const drafts = useDrafts();
  const draftToasts = useDraftToasts(toasts);

  const handleCreate = useCallback(
    async (name?: string) => {
      try {
        await drafts.createDraft(name);
        draftToasts.showCreateSuccess();
      } catch (error) {
        console.error("Draft create failed:", error);
        draftToasts.showCreateError();
      }
    },
    [drafts, draftToasts]
  );

  const handleSave = useCallback(
    async (draftId: string, name?: string) => {
      try {
        await drafts.saveDraft(draftId, name);
        draftToasts.showSaveSuccess();
      } catch (error) {
        console.error("Draft save failed:", error);
        draftToasts.showSaveError();
      }
    },
    [drafts, draftToasts]
  );

  const handleLoad = useCallback(
    async (draftId: string) => {
      try {
        const result = await drafts.loadDraft(draftId);
        if (result.status === "ok") {
          onGraphReload?.();
          draftToasts.showLoadSuccess();
        } else if (result.status === "conflict") {
          draftToasts.showLoadConflict();
        } else {
          draftToasts.showLoadNotFound();
        }
      } catch (error) {
        console.error("Draft load failed:", error);
        draftToasts.showLoadError();
      }
    },
    [drafts, draftToasts, onGraphReload]
  );

  const handleRename = useCallback(
    async (draftId: string, name: string) => {
      try {
        await drafts.renameDraft(draftId, name);
        draftToasts.showRenameSuccess();
      } catch (error) {
        console.error("Draft rename failed:", error);
        draftToasts.showRenameError();
      }
    },
    [drafts, draftToasts]
  );

  const handleDelete = useCallback(
    async (draftId: string) => {
      try {
        await drafts.deleteDraft(draftId);
        draftToasts.showDeleteSuccess();
      } catch (error) {
        console.error("Draft delete failed:", error);
        draftToasts.showDeleteError();
      }
    },
    [drafts, draftToasts]
  );

  return {
    // State from useDrafts
    drafts: drafts.drafts,
    isLoading: drafts.isLoading,
    actionInFlight: drafts.actionInFlight,
    draftCount: drafts.draftCount,
    maxDrafts: drafts.maxDrafts,
    isFull: drafts.isFull,
    
    // Actions with integrated error handling and toasts
    handleCreate,
    handleSave,
    handleLoad,
    handleRename,
    handleDelete,
    
    // Low-level access if needed
    refreshDrafts: drafts.refreshDrafts,
  };
}