import type { DiagramLayoutNode } from "../../../hooks/useDiagramLayout";

const formatReliability = (reliability?: number | null) => {
  if (reliability === null || reliability === undefined) {
    return "—";
  }
  return `${(reliability * 100).toFixed(1)}%`;
};

const renderDistIcon = (distKind?: string | null) => {
  const normalized = distKind?.toLowerCase() ?? "exp";
  if (normalized.startsWith("wei")) {
    return <span className="diagram-node__icon">β</span>;
  }
  return <span className="diagram-node__icon">λ</span>;
};

type DiagramComponentContentProps = {
  node: DiagramLayoutNode;
};

export const DiagramComponentContent = ({ node }: DiagramComponentContentProps) => {
  return (
    <>
      <div className="diagram-node__title">{node.id}</div>
      <div className="diagram-node__meta">
        {renderDistIcon(node.distKind)}
        <span className="diagram-node__meta-text">
          {node.distKind ?? "Exponencial"}
        </span>
      </div>
      <div className="diagram-node__reliability">
        <span className="diagram-node__reliability-label">Confiabilidad</span>
        <span className="diagram-node__reliability-value">
          {formatReliability(node.reliability)}
        </span>
      </div>
    </>
  );
};