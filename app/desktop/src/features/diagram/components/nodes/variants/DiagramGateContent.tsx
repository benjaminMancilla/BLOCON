import type { DiagramLayoutNode } from "../../../hooks/useDiagramLayout";
import { getGatePrimaryLabel } from "../utils/gateText";

type DiagramGateContentProps = {
  node: DiagramLayoutNode;
};

export const DiagramGateContent = ({ node }: DiagramGateContentProps) => {
  const isKoon = node.subtype?.toLowerCase() === "koon";
  const koonLabel =
    node.childCount !== undefined
      ? `${node.k ?? 1}/${node.childCount}`
      : `${node.k ?? 1}`;
  const gateLabel = getGatePrimaryLabel(node);

  return (
    <>
      <span className="diagram-gate__label">{gateLabel}</span>
      {isKoon && <span className="diagram-gate__badge">{koonLabel}</span>}
    </>
  );
};