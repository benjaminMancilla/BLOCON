import type { DiagramLayoutNode } from "../../../hooks/useDiagramLayout";
import { getGatePrimaryLabel } from "../utils/gateText";

type DiagramGateContentProps = {
  node: DiagramLayoutNode;
};

export const DiagramGateContent = ({ node }: DiagramGateContentProps) => {
  const gateLabel = getGatePrimaryLabel(node);

  return (
    <>
      <span className="diagram-gate__label">{gateLabel}</span>
    </>
  );
};