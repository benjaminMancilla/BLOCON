import { GraphEdge } from "../../../core/graph";

type GateListProps = {
  gates: GraphEdge[];
};

export const GateList = ({ gates }: GateListProps) => {
  return (
    <section className="app__panel">
      <h2>Aristas</h2>
      {gates.length === 0 ? (
        <p>No hay aristas disponibles.</p>
      ) : (
        <ul className="app__list">
          {gates.map((gate, index) => (
            <li key={`${gate.from}-${gate.to}-${index}`}>
              {gate.from} → {gate.to}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};