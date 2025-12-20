import { useEffect, useMemo, useState } from "react";
import { BACKEND_ENDPOINT, fetchGraph, GraphResponse } from "./api/backend";

const emptyGraph: GraphResponse = {
  nodes: [],
  edges: []
};

function App() {
  const [graph, setGraph] = useState<GraphResponse>(emptyGraph);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    fetchGraph()
      .then((data) => {
        if (!active) {
          return;
        }
        setGraph(data);
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (!active) {
          return;
        }
        setErrorMessage(error.message);
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const rootLabel = useMemo(() => graph.root ?? "Sin raíz", [graph.root]);

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>BLOCON Desktop</h1>
          <p className="app__subtitle">Vista de diagrama (solo lectura)</p>
        </div>
        <div className="app__endpoint">
          <span>Backend</span>
          <code>{BACKEND_ENDPOINT}</code>
        </div>
      </header>

      <section className="app__panel">
        <h2>Estado</h2>
        {status === "loading" && <p>Consultando API...</p>}
        {status === "error" && (
          <p className="app__error">No se pudo obtener el diagrama: {errorMessage}</p>
        )}
        {status === "ready" && (
          <p className="app__success">API conectada correctamente.</p>
        )}
      </section>

      <section className="app__panel">
        <h2>Resumen</h2>
        <dl className="app__summary">
          <div>
            <dt>Raíz</dt>
            <dd>{rootLabel}</dd>
          </div>
          <div>
            <dt>Nodos</dt>
            <dd>{graph.nodes.length}</dd>
          </div>
          <div>
            <dt>Aristas</dt>
            <dd>{graph.edges.length}</dd>
          </div>
          <div>
            <dt>Confiabilidad total</dt>
            <dd>{graph.reliability_total ?? "N/D"}</dd>
          </div>
        </dl>
      </section>

      <section className="app__panel">
        <h2>Nodos</h2>
        {graph.nodes.length === 0 ? (
          <p>No hay nodos disponibles.</p>
        ) : (
          <ul className="app__list">
            {graph.nodes.map((node) => (
              <li key={node.id}>
                <div className="app__list-title">{node.id}</div>
                <div className="app__list-meta">
                  Tipo: {node.type}
                  {node.subtype ? ` • ${node.subtype}` : ""}
                  {node.unit_type ? ` • ${node.unit_type}` : ""}
                  {node.conflict ? " • Conflicto" : ""}
                </div>
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

      <section className="app__panel">
        <h2>Aristas</h2>
        {graph.edges.length === 0 ? (
          <p>No hay aristas disponibles.</p>
        ) : (
          <ul className="app__list">
            {graph.edges.map((edge, index) => (
              <li key={`${edge.from}-${edge.to}-${index}`}>
                {edge.from} → {edge.to}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default App;