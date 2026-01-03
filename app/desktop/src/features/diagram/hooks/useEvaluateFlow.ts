import { useCallback, useState } from "react";
import { evaluateGraph } from "../../../services/evaluateApi";
import { isRetryableCloudError } from "../../../services/apiClient";
import type { ToastManager } from "./useToasts";

type UseEvaluateFlowOptions = {
  toasts: ToastManager;
  onGraphReload?: () => void;
  onViewRefresh?: () => Promise<void>;
};

/**
 * Hook que encapsula el flujo completo de evaluación de confiabilidad:
 * - Loading state
 * - Ejecución de la evaluación
 * - Actualización del grafo y vista
 * - Toasts de éxito/error
 * - Manejo de errores de cloud
 */
export function useEvaluateFlow({
  toasts,
  onGraphReload,
  onViewRefresh,
}: UseEvaluateFlowOptions) {
  const [isLoading, setIsLoading] = useState(false);

  const evaluate = useCallback(async () => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      // Ejecutar evaluación
      await evaluateGraph();

      // Side effects
      onGraphReload?.();
      await onViewRefresh?.();

      // Mostrar éxito
      toasts.success("Evaluación completada.", "general");
    } catch (error) {
      // Si es un error de cloud recovery, no mostrar toast
      // (el sistema de cloud error recovery lo maneja)
      if (isRetryableCloudError(error)) {
        return;
      }

      console.error("Evaluation failed:", error);
      toasts.error("No se pudo evaluar la confiabilidad.", "general");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, onGraphReload, onViewRefresh, toasts]);

  return {
    // State
    isLoading,

    // Actions
    evaluate,
  };
}

// Type export
export type UseEvaluateFlowResult = ReturnType<typeof useEvaluateFlow>;