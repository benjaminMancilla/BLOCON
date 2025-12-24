import { CSSProperties, PointerEvent } from "react";
import { DiagramLayoutNode } from "../hooks/useDiagramLayout";
import { DiagramNode } from "./nodes/DiagramNode";
import { useDiagramNodeInteractions } from "./nodes/hooks/useDiagramNodeInteractions";
import { DiagramGateContent } from "./nodes/variants/DiagramGateContent";
import { buildGateColorVars, resolveGateColor } from "../utils/gateColors";

type DiagramGateNodeProps = {
  node: DiagramLayoutNode;
  isLabelVisible: boolean;
  onHoverStart?: (gateId: string) => void;
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
  onSelectHover?: () => void;
  onSelectHoverEnd?: () => void;
  onPreselect?: () => void;
  onConfirm?: () => void;
  onDragStart?: (event: PointerEvent<HTMLDivElement>) => void;
};

export const DiagramGateNode = ({
  node,
  isLabelVisible,
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
  onSelectHover,
  onSelectHoverEnd,
  onPreselect,
  onConfirm,
  onDragStart,
}: DiagramGateNodeProps) => {
  const gateColor = resolveGateColor(node.subtype, node.color ?? null);
  const colorVars = buildGateColorVars(gateColor) as CSSProperties;
  const handleHoverStart = onHoverStart
    ? (gateId: string | null) => {
        if (gateId) {
          onHoverStart(gateId);
        }
      }
    : undefined;

  const handlers = useDiagramNodeInteractions({
    hoverId: node.id,
    isSelectionMode,
    isDraggable,
    onHoverStart: handleHoverStart,
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
      baseClassName="diagram-node diagram-node--gate"
      classNameFlags={{
        isLabelVisible,
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
      <DiagramGateContent node={node} />
    </DiagramNode>
  );
};