import { useCallback, useState } from "react";

export type NodeContextMenuTarget = {
  nodeId: string;
  nodeType: "component" | "gate";
  gateSubtype?: string | null;
  name?: string | null;
};

type NodeContextMenuState = {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  target: NodeContextMenuTarget | null;
};

export const useNodeContextMenu = () => {
  const [state, setState] = useState<NodeContextMenuState>({
    isOpen: false,
    position: null,
    target: null,
  });

  const openForNode = useCallback(
    (target: NodeContextMenuTarget, position: { x: number; y: number }) => {
      setState({ isOpen: true, position, target });
    },
    []
  );

  const close = useCallback(() => {
    setState({ isOpen: false, position: null, target: null });
  }, []);

  return {
    ...state,
    openForNode,
    close,
  };
};