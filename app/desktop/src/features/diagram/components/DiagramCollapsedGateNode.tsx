import { CSSProperties, PointerEvent } from "react";
import { DiagramLayoutNode } from "../hooks/useDiagramLayout";
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
  isDimmed?: boolean;
  isOrganizationLocked?: boolean;
  isDraggable?: boolean;
  isDragging?: boolean;
  allowExpand?: boolean;
  onSelectHover?: () => void;
  onSelectHoverEnd?: () => void;
  onPreselect?: () => void;
  onConfirm?: () => void;
  onDragStart?: (event: PointerEvent<HTMLDivElement>) => void
};

const formatGateMeta = (node: DiagramLayoutNode) => {
  const subtype = node.subtype?.toLowerCase();
  if (subtype === "koon") {
    const total = node.childCount ?? node.k ?? 1;
    const required = node.k ?? 1;
    return `Gate ${required}/${total}`;
  }
  if (subtype === "or") {
    return "Gate OR";
  }
  if (subtype === "and") {
    return "Gate AND";
  }
  return "Gate";
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
  isDimmed = false,
  isOrganizationLocked = false,
  isDraggable = false,
  isDragging = false,
  allowExpand = true,
  onSelectHover,
  onSelectHoverEnd,
  onPreselect,
  onConfirm,
  onDragStart,
}: DiagramCollapsedGateNodeProps) => {
  const gateColor = resolveGateColor(node.subtype, node.color ?? null);
  const colorVars = buildGateColorVars(gateColor) as CSSProperties;

  return (
    <div
      className={`diagram-node diagram-node--component diagram-node--collapsed-gate${
        isSelectionMode ? " diagram-node--selectable" : ""
      }${isHovered ? " diagram-node--hovered" : ""}${
        isPreselected ? " diagram-node--preselected" : ""
      }${isSelected ? " diagram-node--selected" : ""}${
        isDimmed ? " diagram-node--dimmed" : ""
      }${isOrganizationLocked ? " diagram-node--locked" : ""}${
        isDraggable ? " diagram-node--draggable" : ""
      }${isDragging ? " diagram-node--dragging" : ""}`}
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
        onHoverStart?.(node.parentGateId ?? null);
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
      {allowExpand ? (
        <button
          type="button"
          className="diagram-node__expand"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onExpand(node.id);
          }}
          aria-label={`Expandir gate ${node.id}`}
        >
          +
        </button>
      ) : null}
      <div className="diagram-node__title">{node.id}</div>
      <div className="diagram-node__meta">
        <span className="diagram-node__icon">⟲</span>
        <span className="diagram-node__meta-text">{formatGateMeta(node)}</span>
      </div>
      <div className="diagram-node__collapsed-label">{formatGateMeta(node)}</div>
    </div>
  );
};