// features/diagram/hooks/useRebuildFlow.ts
import { useCallback, useState } from "react";
import { rebuildGraphAtVersion } from "../../../services/versionViewerService";
import { loadCloudGraph } from "../../../services/graphService";
import { isRetryableCloudError } from "../../../services/apiClient";
import type { ToastManager } from "./useToasts";
import type { UseVersionViewerResult } from "./useVersionViewer";
import type { UseVersionHistoryPanelResult } from "./useVersionHistoryPanel";
import type { UseEventDetailsResult } from "./useEventDetails";

type RebuildDialog = {
  version: number;
  step: 1 | 2;
};

type UseRebuildFlowOptions = {
  toasts: ToastManager;
  versionViewer: UseVersionViewerResult;
  versionHistoryPanel: UseVersionHistoryPanelResult;
  eventDetails: UseEventDetailsResult;
  onGraphReload?: () => void;
};

/**
 * Hook que encapsula todo el flujo de rebuild:
 * - Dialog state (2 pasos de confirmación)
 * - Loading state
 * - Ejecución del rebuild
 * - Limpieza de estado al finalizar
 * - Toasts de éxito/error
 */
export function useRebuildFlow({
  toasts,
  versionViewer,
  versionHistoryPanel,
  eventDetails,
  onGraphReload,
}: UseRebuildFlowOptions) {
  const [dialog, setDialog] = useState<RebuildDialog | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Iniciar el flujo de rebuild
  const requestRebuild = useCallback((version: number) => {
    setDialog({ version, step: 1 });
  }, []);

  // Cancelar el rebuild
  const cancel = useCallback(() => {
    if (isLoading) return;
    setDialog(null);
  }, [isLoading]);

  // Confirmar el rebuild (2 pasos)
  const confirm = useCallback(async () => {
    if (!dialog) return;

    // Paso 1: Mostrar confirmación adicional
    if (dialog.step === 1) {
      setDialog((current) => (current ? { ...current, step: 2 } : current));
      return;
    }

    // Paso 2: Ejecutar el rebuild
    setIsLoading(true);
    try {
      await rebuildGraphAtVersion(dialog.version);
      await loadCloudGraph();
      
      // Actualizar el grafo
      onGraphReload?.();
      
      // Limpiar estado de UI
      versionViewer.exitViewer();
      versionHistoryPanel.close();
      eventDetails.close();
      
      // Mostrar éxito
      toasts.success(`Rebuild completado en v${dialog.version}.`, "rebuild");
      
      // Cerrar dialog
      setDialog(null);
    } catch (error) {
      // Si es un error de cloud recovery, no mostrar toast
      // (el sistema de cloud error recovery lo maneja)
      if (isRetryableCloudError(error)) {
        return;
      }
      
      console.error("Rebuild failed:", error);
      toasts.error("No se pudo completar el rebuild.", "rebuild");
    } finally {
      setIsLoading(false);
    }
  }, [
    dialog,
    toasts,
    versionViewer,
    versionHistoryPanel,
    eventDetails,
    onGraphReload,
  ]);

  return {
    // State
    dialog,
    isLoading,
    
    // Actions
    requestRebuild,
    cancel,
    confirm,
  };
}

// Type export for use in App.tsx
export type UseRebuildFlowResult = ReturnType<typeof useRebuildFlow>;