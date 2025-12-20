import { DiagramLayoutNode } from "../hooks/useDiagramLayout";

type DiagramComponentNodeProps = {
  node: DiagramLayoutNode;
};

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

export const DiagramComponentNode = ({ node }: DiagramComponentNodeProps) => {
  return (
    <div
      className="diagram-node diagram-node--component"
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
      }}
      data-node-id={node.id}
    >
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
    </div>
  );
};