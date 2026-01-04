import { useCallback, useState } from "react";
import {
  NodeEditApiError,
  patchComponent,
  patchGate,
} from "../../../services/nodeEditApi";

type NodeEditState = {
  isSaving: boolean;
  error: NodeEditApiError | null;
};

const normalizeError = (error: unknown): NodeEditApiError => {
  if (error instanceof NodeEditApiError) {
    return error;
  }
  if (error instanceof Error) {
    return new NodeEditApiError(error.message);
  }
  return new NodeEditApiError("No se pudo actualizar el nodo.");
};

export const useNodeEdit = () => {
  const [state, setState] = useState<NodeEditState>({
    isSaving: false,
    error: null,
  });

  const editGate = useCallback(
    async (gateId: string, patch: Record<string, unknown>) => {
      setState({ isSaving: true, error: null });
      try {
        await patchGate(gateId, patch);
        setState({ isSaving: false, error: null });
        return null;
      } catch (error: unknown) {
        const normalized = normalizeError(error);
        setState({ isSaving: false, error: normalized });
        return normalized;
      }
    },
    []
  );

  const editComponent = useCallback(
    async (componentId: string, patch: Record<string, unknown>) => {
      setState({ isSaving: true, error: null });
      try {
        await patchComponent(componentId, patch);
        setState({ isSaving: false, error: null });
        return null;
      } catch (error: unknown) {
        const normalized = normalizeError(error);
        setState({ isSaving: false, error: normalized });
        return normalized;
      }
    },
    []
  );

  return {
    ...state,
    editGate,
    editComponent,
  };
};

export type UseNodeEditResult = ReturnType<typeof useNodeEdit>;