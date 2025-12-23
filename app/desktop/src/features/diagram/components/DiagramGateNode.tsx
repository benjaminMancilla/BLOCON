import { CSSProperties } from "react";
import { DiagramLayoutNode } from "../hooks/useDiagramLayout";
import { buildGateColorVars, resolveGateColor } from "../utils/gateColors";

type DiagramGateNodeProps = {
  node: DiagramLayoutNode;
  isLabelVisible: boolean;
  onHoverStart?: (gateId: string) => void;
  onHoverEnd?: () => void;
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
      className={`diagram-node diagram-node--gate${isLabelVisible ? 
        " diagram-node--gate-visible" : ""}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: 1000,
        ...colorVars,
      }}
      data-node-id={node.id}
      onPointerEnter={() => onHoverStart?.(node.id)}
      onPointerLeave={() => onHoverEnd?.()}
    >
      <span className="diagram-gate__label">{formatGateLabel(node)}</span>
      {isKoon && <span className="diagram-gate__badge">{koonLabel}</span>}
    </div>
  );
};