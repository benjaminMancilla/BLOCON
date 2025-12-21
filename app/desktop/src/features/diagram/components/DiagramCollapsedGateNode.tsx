import { CSSProperties } from "react";
import { DiagramLayoutNode } from "../hooks/useDiagramLayout";
import { buildGateColorVars, resolveGateColor } from "../utils/gateColors";

type DiagramCollapsedGateNodeProps = {
  node: DiagramLayoutNode;
  onExpand: (gateId: string) => void;
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
}: DiagramCollapsedGateNodeProps) => {
  const gateColor = resolveGateColor(node.subtype, node.color ?? null);
  const colorVars = buildGateColorVars(gateColor) as CSSProperties;

  return (
    <div
      className="diagram-node diagram-node--component diagram-node--collapsed-gate"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        zIndex: 1000,
        ...colorVars,
      }}
      data-node-id={node.id}
    >
      <button
        type="button"
        className="diagram-node__expand"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onExpand(node.id)}
        aria-label={`Expandir gate ${node.id}`}
      >
        +
      </button>
      <div className="diagram-node__title">{node.id}</div>
      <div className="diagram-node__meta">
        <span className="diagram-node__icon">⟲</span>
        <span className="diagram-node__meta-text">{formatGateMeta(node)}</span>
      </div>
      <div className="diagram-node__collapsed-label">{formatGateMeta(node)}</div>
    </div>
  );
};