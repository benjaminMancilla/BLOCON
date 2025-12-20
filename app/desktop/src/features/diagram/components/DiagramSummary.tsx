type DiagramSummaryProps = {
  summary: {
    root: string | null;
    nodeCount: number;
    edgeCount: number;
    reliabilityTotal: number | null;
  };
};

export const DiagramSummary = ({ summary }: DiagramSummaryProps) => {
  return (
    <section className="app__panel">
      <h2>Resumen</h2>
      <dl className="app__summary">
        <div>
          <dt>Raíz</dt>
          <dd>{summary.root ?? "Sin raíz"}</dd>
        </div>
        <div>
          <dt>Nodos</dt>
          <dd>{summary.nodeCount}</dd>
        </div>
        <div>
          <dt>Aristas</dt>
          <dd>{summary.edgeCount}</dd>
        </div>
        <div>
          <dt>Confiabilidad total</dt>
          <dd>{summary.reliabilityTotal ?? "N/D"}</dd>
        </div>
      </dl>
    </section>
  );
};