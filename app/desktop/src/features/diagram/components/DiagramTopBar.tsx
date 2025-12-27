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
  isDeleteMode?: boolean;
  isDeleteDisabled?: boolean;
  skipDeleteConfirmation?: boolean;
  onToggleAddMode?: () => void;
  onToggleDeleteMode?: () => void;
  onSkipDeleteConfirmationChange?: (value: boolean) => void;
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
  isDeleteMode = false,
  isDeleteDisabled = false,
  skipDeleteConfirmation = false,
  onToggleAddMode,
  onToggleDeleteMode,
  onSkipDeleteConfirmationChange,
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
            <button
              type="button"
              className={`diagram-topbar__button diagram-topbar__button--danger${
                isDeleteMode ? " diagram-topbar__button--active" : ""
              }`}
              onClick={onToggleDeleteMode}
              aria-pressed={isDeleteMode}
              disabled={isDeleteDisabled}
            >
              Borrar
            </button>
            <label
              className="diagram-topbar__delete-toggle"
              title="Omitir confirmación al borrar (solo esta sesión)"
            >
              <input
                type="checkbox"
                checked={skipDeleteConfirmation}
                onChange={(event) =>
                  onSkipDeleteConfirmationChange?.(event.target.checked)
                }
                disabled={isDeleteDisabled}
                aria-label="Omitir confirmación al borrar (solo esta sesión)"
              />
              <span
                className="diagram-topbar__delete-toggle-icon"
                aria-hidden="true"
              >
                ⚡
              </span>
              <span className="diagram-topbar__delete-toggle-text">
                Sin confirm.
              </span>
            </label>
          </div>
        </div>
      </div>
    </header>
  );
};