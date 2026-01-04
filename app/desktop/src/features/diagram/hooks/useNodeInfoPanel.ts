import { useCallback, useRef, useState } from "react";
import type { NodeDetailsResponse } from "../../../services/nodeDetailsApi";
import { getNodeDetails } from "../../../services/nodeDetailsApi";

export type NodeInfoPanelState = {
  nodeId: string;
  data: NodeDetailsResponse | null;
  loading: boolean;
  error: string | null;
};

export const useNodeInfoPanel = () => {
  const [state, setState] = useState<NodeInfoPanelState | null>(null);
  const requestTokenRef = useRef(0);

  const open = useCallback((nodeId: string) => {
    requestTokenRef.current += 1;
    const requestToken = requestTokenRef.current;

    setState({
      nodeId,
      data: null,
      loading: true,
      error: null,
    });

    getNodeDetails(nodeId)
      .then((data) => {
        if (requestTokenRef.current !== requestToken) return;
        setState({
          nodeId,
          data,
          loading: false,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (requestTokenRef.current !== requestToken) return;
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo cargar la información del nodo.";
        setState({
          nodeId,
          data: null,
          loading: false,
          error: message,
        });
      });
  }, []);

  const close = useCallback(() => {
    requestTokenRef.current += 1;
    setState(null);
  }, []);

  return {
    isOpen: state !== null,
    nodeId: state?.nodeId ?? null,
    data: state?.data ?? null,
    loading: state?.loading ?? false,
    error: state?.error ?? null,
    open,
    close,
  };
};

export type UseNodeInfoPanelResult = ReturnType<typeof useNodeInfoPanel>;