import { useCallback, useEffect, useMemo, useState } from "react";
import type { PointerEvent } from "react";
import type { DiagramLayoutNode } from "../../../hooks/useDiagramLayout";

type DragAndDropArgs = {
  isEnabled: boolean;
  gateId: string | null;
  organizationChildIds: Set<string>;
  organizationArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  axis: "horizontal" | "vertical";
  order: string[] | null;
  defaultOrder: string[];
  layoutNodeById: Map<string, DiagramLayoutNode>;
  getDiagramPoint: (
    event: PointerEvent<HTMLDivElement> | globalThis.PointerEvent
  ) => { x: number; y: number } | null;
  setOrder: (order: string[]) => void;
};

type DragAndDropResult = {
  draggingNodeId: string | null;
  ghostNode: DiagramLayoutNode | null;
  handlers: {
    onDragStart: (event: PointerEvent<HTMLDivElement>, nodeId: string) => void;
  };
};

export const useDragAndDrop = ({
  isEnabled,
  gateId,
  organizationChildIds,
  organizationArea,
  axis,
  order,
  defaultOrder,
  layoutNodeById,
  getDiagramPoint,
  setOrder,
}: DragAndDropArgs): DragAndDropResult => {
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragPointerId, setDragPointerId] = useState<number | null>(null);
  const [dragGhostOffset, setDragGhostOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [dragGhostPosition, setDragGhostPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const handleDragStart = useCallback(
    (event: PointerEvent<HTMLDivElement>, nodeId: string) => {
      if (!isEnabled || !gateId) return;
      if (!organizationChildIds.has(nodeId)) return;
      event.stopPropagation();
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = getDiagramPoint(event);
      const node = layoutNodeById.get(nodeId);
      if (point && node) {
        setDragGhostOffset({
          x: point.x - node.x,
          y: point.y - node.y,
        });
        setDragGhostPosition({ x: node.x, y: node.y });
      } else {
        setDragGhostOffset(null);
        setDragGhostPosition(null);
      }
      setDraggingNodeId(nodeId);
      setDragPointerId(event.pointerId);
    },
    [
      gateId,
      getDiagramPoint,
      isEnabled,
      layoutNodeById,
      organizationChildIds,
    ]
  );

  useEffect(() => {
    if (!isEnabled) {
      setDraggingNodeId(null);
      setDragPointerId(null);
      setDragGhostOffset(null);
      setDragGhostPosition(null);
    }
  }, [isEnabled]);

  useEffect(() => {
    if (!draggingNodeId || dragPointerId === null) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== dragPointerId) return;
      const point = getDiagramPoint(event);
      if (!point) return;
      if (dragGhostOffset) {
        setDragGhostPosition({
          x: point.x - dragGhostOffset.x,
          y: point.y - dragGhostOffset.y,
        });
      }
      if (!organizationArea) return;
      const isInside =
        point.x >= organizationArea.x &&
        point.x <= organizationArea.x + organizationArea.width &&
        point.y >= organizationArea.y &&
        point.y <= organizationArea.y + organizationArea.height;
      if (!isInside) return;

      const currentOrder = order ?? defaultOrder;
      if (!currentOrder.includes(draggingNodeId)) return;
      const remaining = currentOrder.filter((id) => id !== draggingNodeId);
      const axisValue = axis === "vertical" ? point.y : point.x;
      let insertIndex = remaining.length;
      for (let index = 0; index < remaining.length; index += 1) {
        const node = layoutNodeById.get(remaining[index]);
        if (!node) continue;
        const center =
          axis === "vertical"
            ? node.y + node.height / 2
            : node.x + node.width / 2;
        if (axisValue < center) {
          insertIndex = index;
          break;
        }
      }
      const nextOrder = [
        ...remaining.slice(0, insertIndex),
        draggingNodeId,
        ...remaining.slice(insertIndex),
      ];
      const hasChanged =
        nextOrder.length !== currentOrder.length ||
        nextOrder.some((value, index) => value !== currentOrder[index]);
      if (hasChanged) {
        setOrder(nextOrder);
      }
    };

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== dragPointerId) return;
      setDraggingNodeId(null);
      setDragPointerId(null);
      setDragGhostOffset(null);
      setDragGhostPosition(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    axis,
    defaultOrder,
    dragGhostOffset,
    dragPointerId,
    draggingNodeId,
    getDiagramPoint,
    layoutNodeById,
    order,
    organizationArea,
    setOrder,
  ]);

  const ghostNode = useMemo(() => {
    if (!draggingNodeId || !dragGhostPosition) return null;
    const node = layoutNodeById.get(draggingNodeId);
    if (!node) return null;
    return {
      ...node,
      x: dragGhostPosition.x,
      y: dragGhostPosition.y,
    };
  }, [dragGhostPosition, draggingNodeId, layoutNodeById]);

  return {
    draggingNodeId,
    ghostNode,
    handlers: {
      onDragStart: handleDragStart,
    },
  };
};