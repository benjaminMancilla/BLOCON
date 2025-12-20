type DiagramTopBarProps = {
  title?: string;
  subtitle?: string;
};

export const DiagramTopBar = ({
  title = "BLOCON",
  subtitle = "Lienzo base de diagrama",
}: DiagramTopBarProps) => {
  return (
    <header className="diagram-topbar">
      <div>
        <p className="diagram-topbar__eyebrow">Diagrama</p>
        <h1 className="diagram-topbar__title">{title}</h1>
        <p className="diagram-topbar__subtitle">{subtitle}</p>
      </div>
      <div className="diagram-topbar__actions">
        <span className="diagram-topbar__badge">Placeholder</span>
      </div>
    </header>
  );
};