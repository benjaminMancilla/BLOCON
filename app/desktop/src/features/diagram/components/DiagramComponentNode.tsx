import type { PointerEvent } from "react";
import { DiagramLayoutNode } from "../hooks/useDiagramLayout";
import { DiagramNode } from "./nodes/DiagramNode";
import { useDiagramNodeInteractions } from "./nodes/hooks/useDiagramNodeInteractions";
import { DiagramComponentContent } from "./nodes/variants/DiagramComponentContent";

type DiagramComponentNodeProps = {
  node: DiagramLayoutNode;
  onHoverStart?: (gateId: string | null) => void;
  onHoverEnd?: () => void;
  isSelectionMode?: boolean;
  isHovered?: boolean;
  isPreselected?: boolean;
  isSelected?: boolean;
  isInsertHighlighted?: boolean;
  isDimmed?: boolean;
  isDraggable?: boolean;
  isDragging?: boolean;
  isOrganizationDraggable?: boolean;
  isDragGhost?: boolean;
  onSelectHover?: () => void;
  onSelectHoverEnd?: () => void;
  onPreselect?: () => void;
  onConfirm?: () => void;
  onDragStart?: (event: PointerEvent<HTMLDivElement>) => void;
};

export const DiagramComponentNode = ({
  node,
  onHoverStart,
  onHoverEnd,
  isSelectionMode = false,
  isHovered = false,
  isPreselected = false,
  isSelected = false,
  isInsertHighlighted = false,
  isDimmed = false,
  isDraggable = false,
  isDragging = false,
  isOrganizationDraggable = false,
  isDragGhost = false,
  onSelectHover,
  onSelectHoverEnd,
  onPreselect,
  onConfirm,
  onDragStart,
}: DiagramComponentNodeProps) => {
  const handlers = useDiagramNodeInteractions({
    hoverId: node.parentGateId ?? null,
    isSelectionMode,
    isDraggable,
    onHoverStart,
    onHoverEnd,
    onSelectHover,
    onSelectHoverEnd,
    onPreselect,
    onConfirm,
    onDragStart,
  });

  return (
    <DiagramNode
      node={node}
      baseClassName="diagram-node diagram-node--component"
      classNameFlags={{
        isSelectionMode,
        isHovered,
        isPreselected,
        isSelected,
        isInsertHighlighted,
        isDimmed,
        isDraggable,
        isDragging,
        isOrganizationDraggable,
        isDragGhost,
      }}
      handlers={handlers}
    >
      <DiagramComponentContent node={node} />
    </DiagramNode>
  );
};