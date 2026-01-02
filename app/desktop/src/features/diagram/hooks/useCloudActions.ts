import { useCallback, useEffect, useState } from "react";
import { isRetryableCloudError } from "../../../services/apiClient";
import { loadCloudGraph, saveCloudGraph } from "../../../services/graphService";
import type { CloudAction, CloudToast } from "../types/cloud";

type UseCloudActionsOptions = {
  onLoadSuccess?: () => void;
  toasts?: {
    showSaveSuccess: () => void;
    showSaveError: () => void;
    showLoadSuccess: () => void;
    showLoadError: () => void;
  };
};

export const useCloudActions = ({
  onLoadSuccess,
  toasts,
}: UseCloudActionsOptions) => {
  const [cloudDialogAction, setCloudDialogAction] =
    useState<CloudAction | null>(null);
  const [cloudActionInFlight, setCloudActionInFlight] =
    useState<CloudAction | null>(null);
  const [cloudToast, setCloudToast] = useState<CloudToast | null>(null);

  const requestSave = useCallback(() => {
    setCloudDialogAction("save");
  }, []);

  const requestLoad = useCallback(() => {
    setCloudDialogAction("load");
  }, []);

  const cancelAction = useCallback(() => {
    setCloudDialogAction(null);
  }, []);

  const confirmAction = useCallback(async () => {
    if (!cloudDialogAction) return;
    const action = cloudDialogAction;
    setCloudDialogAction(null);
    setCloudActionInFlight(action);
    try {
      if (action === "save") {
        await saveCloudGraph();
        if (toasts) {
          toasts.showSaveSuccess();
        } else {
          setCloudToast({
            message: "Guardado en la nube exitoso.",
            type: "success",
            token: Date.now(),
          });
        }
      } else {
        await loadCloudGraph();
        onLoadSuccess?.();
        if (toasts) {
          toasts.showLoadSuccess();
        } else {
          setCloudToast({
            message: "Carga completada desde la nube.",
            type: "success",
            token: Date.now(),
          });
        }
      }
    } catch (error) {
      if (isRetryableCloudError(error)) {
        return;
      }
      if (toasts) {
        if (action === "save") {
          toasts.showSaveError();
        } else {
          toasts.showLoadError();
        }
      } else {
        setCloudToast({
          message:
            action === "save"
              ? "No se pudo guardar en la nube. Intenta nuevamente."
              : "No se pudo cargar desde la nube. Intenta nuevamente.",
          type: "error",
          token: Date.now(),
        });
      }
    } finally {
      setCloudActionInFlight(null);
    }
  }, [cloudDialogAction, onLoadSuccess, toasts]);

  useEffect(() => {
    if (!cloudToast) return;
    const timeout = window.setTimeout(() => {
      setCloudToast(null);
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [cloudToast?.token]);

  return {
    cloudDialogAction,
    cloudActionInFlight,
    cloudToast,
    requestSave,
    requestLoad,
    confirmAction,
    cancelAction,
  };
};