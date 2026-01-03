import { useCallback, useEffect, useRef, useState } from "react";

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
  const menuRef = useRef<HTMLDivElement | null>(null);
  const trackingRef = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const openForNode = useCallback(
    (target: NodeContextMenuTarget, position: { x: number; y: number }) => {
      setState({ isOpen: true, position, target });
    },
    []
  );

  const close = useCallback(() => {
    setState({ isOpen: false, position: null, target: null });
  }, []);

  useEffect(() => {
    if (!state.isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-node-id]")) return;
      if (menuRef.current.contains(target)) return;
      trackingRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
      close();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const tracking = trackingRef.current;
      if (!tracking) return;
      if (tracking.pointerId !== event.pointerId) return;
      const dx = event.clientX - tracking.startX;
      const dy = event.clientY - tracking.startY;
      if (!tracking.moved && Math.hypot(dx, dy) >= 6) {
        tracking.moved = true;
        close();
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const tracking = trackingRef.current;
      if (!tracking) return;
      if (tracking.pointerId !== event.pointerId) return;
      trackingRef.current = null;
    };

    const handleWheel = (event: WheelEvent) => {
      if (!menuRef.current) return;
      const target = event.target as HTMLElement | null;
      if (menuRef.current.contains(target)) return;
      close();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("wheel", handleWheel, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("wheel", handleWheel, true);
      trackingRef.current = null;
    };
  }, [close, state.isOpen]);

  return {
    ...state,
    openForNode,
    close,
    menuRef,
  };
};