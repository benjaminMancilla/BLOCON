import { useCallback } from "react";
import type { PointerEvent } from "react";

export type UseDiagramNodeInteractionsProps = {
  hoverId?: string | null;
  isSelectionMode?: boolean;
  isDraggable?: boolean;
  onHoverStart?: (gateId: string | null) => void;
  onHoverEnd?: () => void;
  onSelectHover?: () => void;
  onSelectHoverEnd?: () => void;
  onPreselect?: () => void;
  onConfirm?: () => void;
  onDragStart?: (event: PointerEvent<HTMLDivElement>) => void;
};

export const useDiagramNodeInteractions = ({
  hoverId = null,
  isSelectionMode = false,
  isDraggable = false,
  onHoverStart,
  onHoverEnd,
  onSelectHover,
  onSelectHoverEnd,
  onPreselect,
  onConfirm,
  onDragStart,
}: UseDiagramNodeInteractionsProps) => {
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
      if (!isDraggable) return;
      onDragStart?.(event);
    },
    [isDraggable, onDragStart],
  );

  return {
    onPointerEnter,
    onPointerLeave,
    onClick,
    onDoubleClick,
    onPointerDown,
  };
};