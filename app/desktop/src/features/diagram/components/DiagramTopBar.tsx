type DiagramTopBarProps = {
  title?: string;
  subtitle?: string;
  isAddMode?: boolean;
  onToggleAddMode?: () => void;
};

export const DiagramTopBar = ({
  title = "BLOCON",
  subtitle = "Lienzo base de diagrama",
  isAddMode = false,
  onToggleAddMode,
}: DiagramTopBarProps) => {
  return (
    <header className="diagram-topbar">
      <div>
        <p className="diagram-topbar__eyebrow">Diagrama</p>
        <h1 className="diagram-topbar__title">{title}</h1>
        <p className="diagram-topbar__subtitle">{subtitle}</p>
      </div>
      <div className="diagram-topbar__actions">
        <button
          type="button"
          className={`diagram-topbar__button${
            isAddMode ? " diagram-topbar__button--active" : ""
          }`}
          onClick={onToggleAddMode}
          aria-pressed={isAddMode}
        >
          + Agregar
        </button>
      </div>
    </header>
  );
};