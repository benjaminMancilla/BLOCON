type DiagramTopBarProps = {
  title?: string;
  subtitle?: string;
  isAddMode?: boolean;
  isSelectionMode?: boolean;
  isOrganizationMode?: boolean;
  cloudActionInFlight?: "save" | "load" | null;
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
  cloudActionInFlight = null,
  onToggleAddMode,
  onCloudSave,
  onCloudLoad,
}: DiagramTopBarProps) => {
  const isBlocked = isAddMode;
  const isAddDisabled = isSelectionMode || isOrganizationMode;
  const isCloudBusy = cloudActionInFlight !== null;
  const isCloudSaveBusy = cloudActionInFlight === "save";
  const isCloudLoadBusy = cloudActionInFlight === "load";
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
              disabled={isBlocked || isCloudBusy}
              aria-busy={isCloudSaveBusy}
            >
              {isCloudSaveBusy ? (
                <span className="diagram-topbar__spinner" aria-hidden="true" />
              ) : null}
              {isCloudSaveBusy ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              className="diagram-topbar__button"
              onClick={onCloudLoad}
              disabled={isBlocked || isCloudBusy}
              aria-busy={isCloudLoadBusy}
            >
              {isCloudLoadBusy ? (
                <span className="diagram-topbar__spinner" aria-hidden="true" />
              ) : null}
              {isCloudLoadBusy ? "Cargando..." : "Cargar"}
            </button>
          </div>
        </div>
        <div className="diagram-topbar__section">
          <p className="diagram-topbar__section-title">Edición</p>
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