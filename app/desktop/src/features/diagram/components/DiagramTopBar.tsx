type DiagramTopBarProps = {
  title?: string;
  subtitle?: string;
  isAddMode?: boolean;
  isSelectionMode?: boolean;
  isOrganizationMode?: boolean;
  onToggleAddMode?: () => void;
  onCloudSave?: () => void;
  onCloudLoad?: () => void;
};

export const DiagramTopBar = ({
  title = "BLOCON",
  subtitle = "Lienzo base de diagrama",
  isAddMode = false,
  isSelectionMode = false,
  isOrganizationMode = false,
  onToggleAddMode,
  onCloudSave,
  onCloudLoad,
}: DiagramTopBarProps) => {
  const isBlocked = isAddMode;
  const isAddDisabled = isSelectionMode || isOrganizationMode;
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
        <div className="diagram-topbar__section">
          <p className="diagram-topbar__section-title">Cloud</p>
          <div className="diagram-topbar__section-buttons">
            <button
              type="button"
              className="diagram-topbar__button"
              onClick={onCloudSave}
              disabled={isBlocked}
            >
              Guardar
            </button>
            <button
              type="button"
              className="diagram-topbar__button"
              onClick={onCloudLoad}
              disabled={isBlocked}
            >
              Cargar
            </button>
          </div>
        </div>
        <div className="diagram-topbar__section diagram-topbar__section--inline">
          <div className="diagram-topbar__section-buttons">
            <button
              type="button"
              className={`diagram-topbar__button${
                isAddMode ? " diagram-topbar__button--active" : ""
              }`}
              onClick={onToggleAddMode}
              aria-pressed={isAddMode}
              disabled={isAddDisabled}
            >
              + Agregar
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};