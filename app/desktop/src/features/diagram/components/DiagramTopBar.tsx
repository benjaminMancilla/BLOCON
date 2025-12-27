type DiagramTopBarProps = {
  title?: string;
  subtitle?: string;
  isAddMode?: boolean;
  isBlocked?: boolean;
  isAddDisabled?: boolean;
  cloudSaveState?: {
    isBusy: boolean;
    label: string;
    disabled: boolean;
  };
  cloudLoadState?: {
    isBusy: boolean;
    label: string;
    disabled: boolean;
  };
  onToggleAddMode?: () => void;
  onCloudSave?: () => void;
  onCloudLoad?: () => void;
};

export const DiagramTopBar = ({
  title = "BLOCON",
  subtitle = "Lienzo base de diagrama",
  isAddMode = false,
  isBlocked = false,
  isAddDisabled = false,
  cloudSaveState = {
    isBusy: false,
    label: "Guardar",
    disabled: false,
  },
  cloudLoadState = {
    isBusy: false,
    label: "Cargar",
    disabled: false,
  },
  onToggleAddMode,
  onCloudSave,
  onCloudLoad,
}: DiagramTopBarProps) => {
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
              disabled={cloudSaveState.disabled}
              aria-busy={cloudSaveState.isBusy}
            >
              {cloudSaveState.isBusy ? (
                <span className="diagram-topbar__spinner" aria-hidden="true" />
              ) : null}
              {cloudSaveState.label}
            </button>
            <button
              type="button"
              className="diagram-topbar__button"
              onClick={onCloudLoad}
              disabled={cloudLoadState.disabled}
              aria-busy={cloudLoadState.isBusy}
            >
              {cloudLoadState.isBusy ? (
                <span className="diagram-topbar__spinner" aria-hidden="true" />
              ) : null}
              {cloudLoadState.label}
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