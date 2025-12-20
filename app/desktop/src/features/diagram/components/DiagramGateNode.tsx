import { DiagramLayoutNode } from "../hooks/useDiagramLayout";

type DiagramGateNodeProps = {
  node: DiagramLayoutNode;
  isLabelVisible: boolean;
};

const formatGateLabel = (node: DiagramLayoutNode) => {
  const subtype = node.subtype?.toUpperCase() ?? "GATE";
  return `${node.id} <${subtype}>`;
};

export const DiagramGateNode = ({
  node,
  isLabelVisible,
}: DiagramGateNodeProps) => {
  const isKoon = node.subtype?.toLowerCase() === "koon";
  const koonLabel =
    node.childCount !== undefined
      ? `${node.k ?? 1}/${node.childCount}`
      : `${node.k ?? 1}`;

  return (
    <div
      className={`diagram-node diagram-node--gate${isLabelVisible ? 
        " diagram-node--gate-visible" : ""}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
      data-node-id={node.id}
    >
      <span className="diagram-gate__label">{formatGateLabel(node)}</span>
      {isKoon && <span className="diagram-gate__badge">{koonLabel}</span>}
    </div>
  );
};