// features/diagram/hooks/useViewHandlers.ts
import { useCallback } from "react";
import { useViews } from "./useViews";
import { useViewToasts } from "./useToasts";
import type { ToastManager } from "./useToasts";

type UseViewHandlersOptions = {
  toasts: ToastManager;
  onViewRefresh?: () => Promise<void>;
};

/**
 * Hook que encapsula toda la lógica de manejo de views
 * incluyendo toasts y efectos secundarios
 */
export function useViewHandlers({ toasts, onViewRefresh }: UseViewHandlersOptions) {
  const views = useViews();
  const viewToasts = useViewToasts(toasts);

  const handleCreate = useCallback(
    async (name?: string) => {
      try {
        await views.createView(name);
        viewToasts.showCreateSuccess();
      } catch (error) {
        console.error("View create failed:", error);
        viewToasts.showCreateError();
      }
    },
    [views, viewToasts]
  );

  const handleSave = useCallback(
    async (viewId: string) => {
      try {
        await views.saveView(viewId);
        viewToasts.showSaveSuccess();
      } catch (error) {
        console.error("View save failed:", error);
        viewToasts.showSaveError();
      }
    },
    [views, viewToasts]
  );

  const handleLoad = useCallback(
    async (viewId: string) => {
      try {
        const result = await views.loadView(viewId);
        if (result.status === "ok") {
          await onViewRefresh?.();
          viewToasts.showLoadSuccess();
        } else {
          viewToasts.showLoadNotFound();
        }
      } catch (error) {
        console.error("View load failed:", error);
        viewToasts.showLoadError();
      }
    },
    [views, viewToasts, onViewRefresh]
  );

  const handleRename = useCallback(
    async (viewId: string, name: string) => {
      try {
        await views.renameView(viewId, name);
        viewToasts.showRenameSuccess();
      } catch (error) {
        console.error("View rename failed:", error);
        viewToasts.showRenameError();
      }
    },
    [views, viewToasts]
  );

  const handleDelete = useCallback(
    async (viewId: string) => {
      try {
        await views.deleteView(viewId);
        viewToasts.showDeleteSuccess();
      } catch (error) {
        console.error("View delete failed:", error);
        viewToasts.showDeleteError();
      }
    },
    [views, viewToasts]
  );

  return {
    // State from useViews
    views: views.views,
    isLoading: views.isLoading,
    actionInFlight: views.actionInFlight,
    
    // Actions with integrated error handling and toasts
    handleCreate,
    handleSave,
    handleLoad,
    handleRename,
    handleDelete,
    
    // Low-level access if needed
    refreshViews: views.refreshViews,
  };
}