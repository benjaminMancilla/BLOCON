import { useCallback, useState } from "react";
import { reloadFailures } from "../../../services/failuresApi";
import { isRetryableCloudError } from "../../../services/apiClient";
import type { ToastManager } from "./useToasts";

type UseFailuresReloadFlowOptions = {
  toasts: ToastManager;
  onGraphReload?: () => void;
  onViewRefresh?: () => Promise<void>;
};

/**
 * Hook que encapsula el flujo de recarga de fallas:
 * - Loading state
 * - Ejecución de la recarga
 * - Actualización del grafo y vista
 * - Toasts de éxito/error
 * - Manejo de errores de cloud
 */
export function useFailuresReloadFlow({
  toasts,
  onGraphReload,
  onViewRefresh,
}: UseFailuresReloadFlowOptions) {
  const [isLoading, setIsLoading] = useState(false);

  const reload = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      await reloadFailures();

      onGraphReload?.();
      await onViewRefresh?.();

      toasts.success("Fallas recargadas.", "general");
    } catch (error) {
      if (isRetryableCloudError(error)) {
        return;
      }

      console.error("Failures reload failed:", error);
      toasts.error("No se pudieron recargar las fallas.", "general");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, onGraphReload, onViewRefresh, toasts]);

  return {
    isLoading,
    reload,
  };
}

export type UseFailuresReloadFlowResult = ReturnType<typeof useFailuresReloadFlow>;