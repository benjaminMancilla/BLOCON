import { GraphNode } from "../../../core/graph";

type NodeListProps = {
  nodes: GraphNode[];
};

const formatNodeMeta = (node: GraphNode) => {
  const parts = [node.type];
  if (node.subtype) {
    parts.push(node.subtype);
  }
  if (node.unit_type) {
    parts.push(node.unit_type);
  }
  if (node.conflict) {
    parts.push("Conflicto");
  }
  return parts.join(" • ");
};

export const NodeList = ({ nodes }: NodeListProps) => {
  return (
    <section className="app__panel">
      <h2>Nodos</h2>
      {nodes.length === 0 ? (
        <p>No hay nodos disponibles.</p>
      ) : (
        <ul className="app__list">
          {nodes.map((node) => (
            <li key={node.id}>
              <div className="app__list-title">{node.id}</div>
              <div className="app__list-meta">Tipo: {formatNodeMeta(node)}</div>
              {node.reliability !== undefined && node.reliability !== null && (
                <div className="app__list-meta">Reliability: {node.reliability}</div>
              )}
              {node.dist?.kind && (
                <div className="app__list-meta">Distribución: {node.dist.kind}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};