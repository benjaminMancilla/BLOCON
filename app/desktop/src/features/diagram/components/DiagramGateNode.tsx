import { CSSProperties } from "react";
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
  onSelectHover?: () => void;
  onSelectHoverEnd?: () => void;
  onPreselect?: () => void;
  onConfirm?: () => void;
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
  onSelectHover,
  onSelectHoverEnd,
  onPreselect,
  onConfirm,
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
    >
      <span className="diagram-gate__label">{formatGateLabel(node)}</span>
      {isKoon && <span className="diagram-gate__badge">{koonLabel}</span>}
    </div>
  );
};