import type { DiagramLayoutNode } from "../../../hooks/useDiagramLayout";

const formatGateLabel = (node: DiagramLayoutNode) => {
  const subtype = node.subtype?.toUpperCase() ?? "GATE";
  return `${node.id} <${subtype}>`;
};

type DiagramGateContentProps = {
  node: DiagramLayoutNode;
};

export const DiagramGateContent = ({ node }: DiagramGateContentProps) => {
  const isKoon = node.subtype?.toLowerCase() === "koon";
  const koonLabel =
    node.childCount !== undefined
      ? `${node.k ?? 1}/${node.childCount}`
      : `${node.k ?? 1}`;

  return (
    <>
      <span className="diagram-gate__label">{formatGateLabel(node)}</span>
      {isKoon && <span className="diagram-gate__badge">{koonLabel}</span>}
    </>
  );
};