import { CSSProperties, PointerEvent } from "react";
import { DiagramLayoutNode } from "../hooks/useDiagramLayout";
import { DiagramNode } from "./nodes/DiagramNode";
import { useDiagramNodeInteractions } from "./nodes/hooks/useDiagramNodeInteractions";
import { DiagramCollapsedGateContent } from "./nodes/variants/DiagramCollapsedGateContent";
import { buildGateColorVars, resolveGateColor } from "../utils/gateColors";

type DiagramCollapsedGateNodeProps = {
  node: DiagramLayoutNode;
  onExpand: (gateId: string) => void;
  onHoverStart?: (gateId: string | null) => void;
  onHoverEnd?: () => void;
  isSelectionMode?: boolean;
  isHovered?: boolean;
  isPreselected?: boolean;
  isSelected?: boolean;
  isInsertHighlighted?: boolean;
  isDimmed?: boolean;
  isOrganizationLocked?: boolean;
  isDraggable?: boolean;
  isDragging?: boolean;
  isOrganizationDraggable?: boolean;
  isDragGhost?: boolean;
  allowExpand?: boolean;
  onSelectHover?: () => void;
  onSelectHoverEnd?: () => void;
  onPreselect?: () => void;
  onConfirm?: () => void;
  onDragStart?: (event: PointerEvent<HTMLDivElement>) => void;
};

export const DiagramCollapsedGateNode = ({
  node,
  onExpand,
  onHoverStart,
  onHoverEnd,
  isSelectionMode = false,
  isHovered = false,
  isPreselected = false,
  isSelected = false,
  isInsertHighlighted = false,
  isDimmed = false,
  isOrganizationLocked = false,
  isDraggable = false,
  isDragging = false,
  isOrganizationDraggable = false,
  isDragGhost = false,
  allowExpand = true,
  onSelectHover,
  onSelectHoverEnd,
  onPreselect,
  onConfirm,
  onDragStart,
}: DiagramCollapsedGateNodeProps) => {
  const gateColor = resolveGateColor(node.subtype, node.color ?? null);
  const colorVars = buildGateColorVars(gateColor) as CSSProperties;

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
      baseClassName="diagram-node diagram-node--component diagram-node--collapsed-gate"
      classNameFlags={{
        isSelectionMode,
        isHovered,
        isPreselected,
        isSelected,
        isInsertHighlighted,
        isDimmed,
        isOrganizationLocked,
        isDraggable,
        isDragging,
        isOrganizationDraggable,
        isDragGhost,
      }}
      style={{
        zIndex: 1000,
        ...colorVars,
      }}
      handlers={handlers}
    >
      <DiagramCollapsedGateContent
        node={node}
        allowExpand={allowExpand}
        onExpand={onExpand}
      />
    </DiagramNode>
  );
};