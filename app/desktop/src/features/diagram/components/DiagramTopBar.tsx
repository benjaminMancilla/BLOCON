type DiagramTopBarProps = {
  title?: string;
  subtitle?: string;
  isAddMode?: boolean;
  isSelectionMode?: boolean;
  isOrganizationMode?: boolean;
  onToggleAddMode?: () => void;
};

export const DiagramTopBar = ({
  title = "BLOCON",
  subtitle = "Lienzo base de diagrama",
  isAddMode = false,
  isSelectionMode = false,
  isOrganizationMode = false,
  onToggleAddMode,
}: DiagramTopBarProps) => {
  const isBlocked = isSelectionMode || isOrganizationMode;
  return (
    <header
      className={`diagram-topbar${
        isBlocked ? " diagram-topbar--blocked" : ""
      }`}
    >
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
          disabled={isBlocked}
        >
          + Agregar
        </button>
      </div>
    </header>
  );
};