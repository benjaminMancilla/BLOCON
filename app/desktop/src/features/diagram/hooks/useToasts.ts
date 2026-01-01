// features/diagram/hooks/useToasts.ts
import { useCallback, useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export type ToastCategory = "cloud" | "draft" | "delete" | "insert" | "rebuild" | "general";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
  category: ToastCategory;
  duration: number;
  timestamp: number;
};

type ToastOptions = {
  type?: ToastType;
  category?: ToastCategory;
  duration?: number; // ms, 0 = no auto-dismiss
};

const DEFAULT_DURATION = 2600;

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Show a toast
  const show = useCallback((
    message: string,
    options: ToastOptions = {}
  ) => {
    const toast: Toast = {
      id: `toast-${Date.now()}-${Math.random()}`,
      message,
      type: options.type || "info",
      category: options.category || "general",
      duration: options.duration ?? DEFAULT_DURATION,
      timestamp: Date.now(),
    };

    setToasts((prev) => [...prev, toast]);
    return toast.id;
  }, []);

  // Convenience methods
  const success = useCallback((message: string, category?: ToastCategory) => {
    return show(message, { type: "success", category });
  }, [show]);

  const error = useCallback((message: string, category?: ToastCategory) => {
    return show(message, { type: "error", category });
  }, [show]);

  const info = useCallback((message: string, category?: ToastCategory) => {
    return show(message, { type: "info", category });
  }, [show]);

  const warning = useCallback((message: string, category?: ToastCategory) => {
    return show(message, { type: "warning", category });
  }, [show]);

  // Dismiss a toast
  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Dismiss all toasts of a category
  const dismissCategory = useCallback((category: ToastCategory) => {
    setToasts((prev) => prev.filter((t) => t.category !== category));
  }, []);

  // Auto-dismiss toasts
  useEffect(() => {
    if (toasts.length === 0) return;

    const timeouts: number[] = [];

    toasts.forEach((toast) => {
      if (toast.duration > 0) {
        const timeout = window.setTimeout(() => {
          dismiss(toast.id);
        }, toast.duration);
        timeouts.push(timeout);
      }
    });

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [toasts, dismiss]);

  // Get toasts by category
  const getByCategory = useCallback((category: ToastCategory) => {
    return toasts.filter((t) => t.category === category);
  }, [toasts]);

  return {
    toasts,
    show,
    success,
    error,
    info,
    warning,
    dismiss,
    dismissCategory,
    getByCategory,
  };
}

// Specialized hooks for common use cases
export function useCloudToasts() {
  const toasts = useToasts();
  
  return {
    showSaveSuccess: () => toasts.success("Guardado en la nube exitoso.", "cloud"),
    showSaveError: () => toasts.error("No se pudo guardar en la nube. Intenta nuevamente.", "cloud"),
    showLoadSuccess: () => toasts.success("Carga completada desde la nube.", "cloud"),
    showLoadError: () => toasts.error("No se pudo cargar desde la nube. Intenta nuevamente.", "cloud"),
  };
}

export function useDraftToasts() {
  const toasts = useToasts();
  
  return {
    showCreateSuccess: () => toasts.success("Borrador guardado correctamente.", "draft"),
    showCreateError: () => toasts.error("No se pudo guardar el borrador.", "draft"),
    showSaveSuccess: () => toasts.success("Borrador actualizado.", "draft"),
    showSaveError: () => toasts.error("No se pudo actualizar el borrador.", "draft"),
    showLoadSuccess: () => toasts.success("Borrador cargado en el lienzo.", "draft"),
    showLoadError: () => toasts.error("No se pudo cargar el borrador.", "draft"),
    showLoadConflict: () => toasts.error("El borrador estaba desactualizado y se eliminó automáticamente.", "draft"),
    showLoadNotFound: () => toasts.error("No se encontró el borrador solicitado.", "draft"),
    showRenameSuccess: () => toasts.success("Nombre del borrador actualizado.", "draft"),
    showRenameError: () => toasts.error("No se pudo renombrar el borrador.", "draft"),
    showDeleteSuccess: () => toasts.success("Borrador eliminado.", "draft"),
    showDeleteError: () => toasts.error("No se pudo eliminar el borrador.", "draft"),
  };
}

export function useDeleteToasts() {
  const toasts = useToasts();
  
  return {
    showNodeDeleteSuccess: () => toasts.success("Nodo eliminado", "delete"),
    showNodeDeleteError: () => toasts.error("No se pudo eliminar el nodo", "delete"),
    showGateDeleteSuccess: () => toasts.success("Gate eliminada", "delete"),
    showGateDeleteError: () => toasts.error("No se pudo eliminar la gate", "delete"),
  };
}

export function useInsertToast() {
  const toasts = useToasts();
  
  return {
    showInsertSuccess: () => toasts.success("Componente agregado correctamente", "insert"),
  };
}