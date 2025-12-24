import { CSSProperties, PointerEvent } from "react";
import { DiagramLayoutNode } from "../hooks/useDiagramLayout";
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

const formatGateLabel = (node: DiagramLayoutNode) => {
  const subtype = node.subtype?.toUpperCase() ?? "GATE";
  return `${node.id} <${subtype}>`;
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
  const isKoon = node.subtype?.toLowerCase() === "koon";
  const koonLabel =
    node.childCount !== undefined
      ? `${node.k ?? 1}/${node.childCount}`
      : `${node.k ?? 1}`;
  const gateColor = resolveGateColor(node.subtype, node.color ?? null);
  const colorVars = buildGateColorVars(gateColor) as CSSProperties;

  return (
    <div
      className={`diagram-node diagram-node--gate${
        isLabelVisible ? " diagram-node--gate-visible" : ""
      }${isSelectionMode ? " diagram-node--selectable" : ""}${
        isHovered ? " diagram-node--hovered" : ""
      }${isPreselected ? " diagram-node--preselected" : ""}${
        isSelected ? " diagram-node--selected" : ""
      }${isInsertHighlighted ? " diagram-node--insert-highlight" : ""}${
        isDimmed ? " diagram-node--dimmed" : ""}${
        isOrganizationLocked ? " diagram-node--locked" : ""
      }${isDraggable ? " diagram-node--draggable" : ""}${
        isDragging ? " diagram-node--organization-drag-placeholder" : ""
      }${isOrganizationDraggable ? " diagram-node--organization-draggable" : ""}${
        isDragGhost ? " diagram-node--drag-ghost" : ""
      }`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: 1000,
        ...colorVars,
      }}
      data-node-id={node.id}
      onPointerEnter={() => {
        onHoverStart?.(node.id);
        onSelectHover?.();
      }}
      onPointerLeave={() => {
        onHoverEnd?.();
        onSelectHoverEnd?.();
      }}
      onClick={(event) => {
        if (!isSelectionMode) return;
        event.stopPropagation();
        onPreselect?.();
      }}
      onDoubleClick={(event) => {
        if (!isSelectionMode) return;
        event.stopPropagation();
        onConfirm?.();
      }}
      onPointerDown={(event) => {
        if (!isDraggable) return;
        onDragStart?.(event);
      }}
    >
      <span className="diagram-gate__label">{formatGateLabel(node)}</span>
      {isKoon && <span className="diagram-gate__badge">{koonLabel}</span>}
    </div>
  );
};