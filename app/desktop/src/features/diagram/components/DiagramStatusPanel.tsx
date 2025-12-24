import { DiagramStatus } from "../hooks/useDiagramGraph";

type DiagramStatusPanelProps = {
  status: DiagramStatus;
  errorMessage: string | null;
};

export const DiagramStatusPanel = ({ status, errorMessage }: DiagramStatusPanelProps) => {
  return (
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
  );
};