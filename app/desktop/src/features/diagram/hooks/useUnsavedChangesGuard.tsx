import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appWindow } from "@tauri-apps/api/window";
import { fetchLocalDirty } from "../../../services/localDirtyService";
import { CloseGuardDialog } from "../components/CloseGuardDialog";

type UseUnsavedChangesGuardOptions = {
  isCloudBusy: boolean;
};

type DirtyStatus = {
  dirty: boolean;
  local_events_count: number;
};

export const useUnsavedChangesGuard = ({
  isCloudBusy,
}: UseUnsavedChangesGuardOptions) => {
  const [dialogState, setDialogState] = useState<"unsaved" | "busy" | null>(
    null,
  );
  const [closingRequested, setClosingRequested] = useState(false);
  const handlingCloseRef = useRef(false);
  const allowCloseRef = useRef(false);

  const checkDirty = useCallback(async (): Promise<DirtyStatus> => {
    try {
      return await fetchLocalDirty();
    } catch (error) {
      console.error("No se pudo verificar cambios locales:", error);
      return { dirty: true, local_events_count: 0 };
    }
  }, []);

  const closeWindow = useCallback(async () => {
    allowCloseRef.current = true;
    try {
      await appWindow.close();
    } finally {
      allowCloseRef.current = false;
    }
  }, []);

  const handleCloseRequest = useCallback(async () => {
    if (handlingCloseRef.current || allowCloseRef.current) return;
    handlingCloseRef.current = true;
    setClosingRequested(true);
    try {
      if (isCloudBusy) {
        setDialogState("busy");
        return;
      }
      const status = await checkDirty();
      if (!status.dirty) {
        setClosingRequested(false);
        await closeWindow();
        return;
      }
      setDialogState("unsaved");
    } finally {
      handlingCloseRef.current = false;
    }
  }, [checkDirty, closeWindow, isCloudBusy]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(window as { __TAURI__?: unknown }).__TAURI__) return;
    let unlisten: (() => void) | null = null;
    appWindow.onCloseRequested((event) => {
      if (allowCloseRef.current) {
        return;
      }
      event.preventDefault();
      void handleCloseRequest();
    }).then((nextUnlisten) => {
      unlisten = nextUnlisten;
    });
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleCloseRequest]);

  const handleCancel = useCallback(() => {
    setDialogState(null);
    setClosingRequested(false);
  }, []);

  const handleCloseWithoutSaving = useCallback(async () => {
    setDialogState(null);
    setClosingRequested(false);
    await closeWindow();
  }, [closeWindow]);

  const dialog = useMemo(() => {
    if (!dialogState) return null;
    if (dialogState === "busy") {
      return (
        <CloseGuardDialog
          title="Operación en curso"
          description="Hay una operación cloud en progreso. Espera a que termine para cerrar."
          actions={[
            {
              label: "Entendido",
              onClick: handleCancel,
            },
          ]}
        />
      );
    }

    return (
      <CloseGuardDialog
        title="Cambios sin guardar"
        description="Tienes cambios sin guardar. Si cierras, los perderás."
        actions={[
          {
            label: "Cancelar",
            tone: "ghost",
            onClick: handleCancel,
          },
          {
            label: "Cerrar sin guardar",
            tone: "danger",
            onClick: handleCloseWithoutSaving,
          },
        ]}
      />
    );
  }, [dialogState, handleCancel, handleCloseWithoutSaving]);

  return {
    checkDirty,
    closingRequested,
    dialog,
  };
};