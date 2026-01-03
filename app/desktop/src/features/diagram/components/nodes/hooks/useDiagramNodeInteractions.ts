import { useCallback } from "react";
import type { PointerEvent } from "react";
import { useQuickClick } from "./useQuickClick";
import type { QuickClickPayload } from "./useQuickClick";

export type UseDiagramNodeInteractionsProps = {
  nodeId: string;
  hoverId?: string | null;
  isSelectionMode?: boolean;
  isDraggable?: boolean;
  isQuickClickEnabled?: boolean;
  onHoverStart?: (gateId: string | null) => void;
  onHoverEnd?: () => void;
  onSelectHover?: () => void;
  onSelectHoverEnd?: () => void;
  onPreselect?: () => void;
  onConfirm?: () => void;
  onDragStart?: (event: PointerEvent<HTMLDivElement>) => void;
  onQuickClick?: (payload: QuickClickPayload) => void;
};

export const useDiagramNodeInteractions = ({
  nodeId,
  hoverId = null,
  isSelectionMode = false,
  isDraggable = false,
  isQuickClickEnabled = false,
  onHoverStart,
  onHoverEnd,
  onSelectHover,
  onSelectHoverEnd,
  onPreselect,
  onConfirm,
  onDragStart,
  onQuickClick,
}: UseDiagramNodeInteractionsProps) => {
  const quickClickHandlers = useQuickClick({
    targetId: nodeId,
    isEnabled: isQuickClickEnabled,
    onQuickClick,
  });
  const onPointerEnter = useCallback(() => {
    onHoverStart?.(hoverId);
    onSelectHover?.();
  }, [hoverId, onHoverStart, onSelectHover]);

  const onPointerLeave = useCallback(() => {
    onHoverEnd?.();
    onSelectHoverEnd?.();
  }, [onHoverEnd, onSelectHoverEnd]);

  const onClick = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isSelectionMode) return;
      event.stopPropagation();
      onPreselect?.();
    },
    [isSelectionMode, onPreselect],
  );

  const onDoubleClick = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isSelectionMode) return;
      event.stopPropagation();
      onConfirm?.();
    },
    [isSelectionMode, onConfirm],
  );

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      quickClickHandlers.onPointerDown(event);
      if (!isDraggable) return;
      if (event.button !== 0) return;
      onDragStart?.(event);
    },
    [isDraggable, onDragStart, quickClickHandlers],
  );

  return {
    onPointerEnter,
    onPointerLeave,
    onClick,
    onDoubleClick,
    onPointerDown,
    onContextMenu: quickClickHandlers.onContextMenu,
  };
};