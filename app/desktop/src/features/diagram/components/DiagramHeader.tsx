type DiagramHeaderProps = {
  endpoint: string;
};

export const DiagramHeader = ({ endpoint }: DiagramHeaderProps) => {
  return (
    <header className="app__header">
      <div>
        <h1>BLOCON Desktop</h1>
        <p className="app__subtitle">Vista de diagrama (solo lectura)</p>
      </div>
      <div className="app__endpoint">
        <span>Backend</span>
        <code>{endpoint}</code>
      </div>
    </header>
  );
};