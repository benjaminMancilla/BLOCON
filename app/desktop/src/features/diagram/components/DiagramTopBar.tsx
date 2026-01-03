import type { ReactNode } from "react";

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
  evaluateState?: {
    isBusy: boolean;
    label: string;
    disabled: boolean;
  };
  failuresReloadState?: {
    isBusy: boolean;
    label: string;
    disabled: boolean;
  };
  isDeleteMode?: boolean;
  isDeleteDisabled?: boolean;
  isVersionHistoryOpen?: boolean;
  isVersionHistoryDisabled?: boolean;
  skipDeleteConfirmation?: boolean;
  isViewerMode?: boolean;
  viewerVersion?: number | null;
  onToggleAddMode?: () => void;
  onToggleDeleteMode?: () => void;
  onToggleVersionHistory?: () => void;
  onSkipDeleteConfirmationChange?: (value: boolean) => void;
  onCloudSave?: () => void;
  onCloudLoad?: () => void;
  onEvaluate?: () => void;
  onReloadFailures?: () => void;
  onExitViewer?: () => void;
  viewsMenu?: ReactNode;
  draftsMenu?: ReactNode;
  isDraftsDisabled?: boolean;
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
  evaluateState,
  failuresReloadState,
  isDeleteMode = false,
  isDeleteDisabled = false,
  isVersionHistoryOpen = false,
  isVersionHistoryDisabled = false,
  skipDeleteConfirmation = false,
  isViewerMode = false,
  viewerVersion = null,
  onToggleAddMode,
  onToggleDeleteMode,
  onToggleVersionHistory,
  onSkipDeleteConfirmationChange,
  onCloudSave,
  onCloudLoad,
  onEvaluate,
  onReloadFailures,
  onExitViewer,
  viewsMenu,
  draftsMenu,
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
        {isViewerMode ? (
          <p className="diagram-topbar__viewer-label">
            VISUALIZANDO VERSIÓN {viewerVersion ?? "?"}
          </p>
        ) : null}
      </div>
      <div className="diagram-topbar__actions">
        {isViewerMode ? (
          <div className="diagram-topbar__section diagram-topbar__section--viewer">
            <p className="diagram-topbar__section-title">Visualizador</p>
            <div className="diagram-topbar__section-buttons">
              <button
                type="button"
                className="diagram-topbar__button diagram-topbar__button--ghost"
                onClick={onExitViewer}
              >
                Salir / Volver
              </button>
            </div>
          </div>
        ) : null}
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
        {evaluateState || failuresReloadState ? (
          <div className="diagram-topbar__section">
            <p className="diagram-topbar__section-title">Análisis</p>
            <div className="diagram-topbar__section-buttons">
              {evaluateState ? (
                <button
                  type="button"
                  className="diagram-topbar__button"
                  onClick={onEvaluate}
                  disabled={evaluateState.disabled}
                  aria-busy={evaluateState.isBusy}
                >
                  {evaluateState.isBusy ? (
                    <span className="diagram-topbar__spinner" aria-hidden="true" />
                  ) : null}
                  {evaluateState.label}
                </button>
              ) : null}
              {failuresReloadState ? (
                <button
                  type="button"
                  className="diagram-topbar__button"
                  onClick={onReloadFailures}
                  disabled={failuresReloadState.disabled}
                  aria-busy={failuresReloadState.isBusy}
                >
                  {failuresReloadState.isBusy ? (
                    <span className="diagram-topbar__spinner" aria-hidden="true" />
                  ) : null}
                  {failuresReloadState.label}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {viewsMenu ? (
          <div className="diagram-topbar__section diagram-topbar__section--inline">
            <p className="diagram-topbar__section-title">Vistas</p>
            <div className="diagram-topbar__section-buttons">{viewsMenu}</div>
          </div>
        ) : null}
        {draftsMenu ? (
          <div className="diagram-topbar__section diagram-topbar__section--inline">
            <p className="diagram-topbar__section-title">Borradores</p>
            <div className="diagram-topbar__section-buttons">{draftsMenu}</div>
          </div>
        ) : null}
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
        <div className="diagram-topbar__section">
          <p className="diagram-topbar__section-title">Versiones</p>
          <div className="diagram-topbar__section-buttons">
            <button
              type="button"
              className={`diagram-topbar__button${
                isVersionHistoryOpen ? " diagram-topbar__button--active" : ""
              }`}
              onClick={onToggleVersionHistory}
              aria-pressed={isVersionHistoryOpen}
              disabled={isVersionHistoryDisabled}
            >
              Historial
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};