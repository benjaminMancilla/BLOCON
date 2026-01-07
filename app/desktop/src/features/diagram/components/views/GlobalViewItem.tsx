import cloudIconUrl from "../../../../../../assets/icons/cloud.png";

type GlobalViewItemProps = {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  exists: boolean;
  isLoading: boolean;
  isDisabled?: boolean;
  onLoad: () => void;
  onSave: () => void;
  onReload: () => void;
  onDelete: () => void;
};

export const GlobalViewItem = ({
  isCollapsed,
  onToggleCollapse,
  exists,
  isLoading,
  isDisabled = false,
  onLoad,
  onSave,
  onReload,
  onDelete,
}: GlobalViewItemProps) => {
  const isBusy = isLoading || isDisabled;
  const canLoad = exists && !isBusy;
  const canDelete = exists && !isBusy;

  return (
    <div className="global_view_item">
      <div className="global-view-item__header">
        <div className="global-view-item__title">
          <img
            src={cloudIconUrl}
            alt="SharePoint"
            className="global-view-item__icon"
          />
          <span>Vista Global</span>
          {isLoading ? (
            <span className="global-view-item__spinner" aria-hidden="true" />
          ) : null}
        </div>
        <button
          type="button"
          className="global-view-item__toggle"
          onClick={onToggleCollapse}
          aria-expanded={!isCollapsed}
          aria-label={
            isCollapsed
              ? "Expandir vista global"
              : "Colapsar vista global"
          }
          disabled={isDisabled}
        >
          {isCollapsed ? "▸" : "▾"}
        </button>
      </div>
      {!isCollapsed ? (
        <div className="global-view-item__body">
          {!exists ? (
            <p className="global-view-item__status">Vacía</p>
          ) : null}
          <div className="global-view-item__actions">
            <button
              type="button"
              className="global-view-item__button"
              onClick={onLoad}
              disabled={!canLoad}
            >
              Cargar
            </button>
            <button
              type="button"
              className="global-view-item__button"
              onClick={onSave}
              disabled={isBusy}
            >
              Guardar
            </button>
            <button
              type="button"
              className="global-view-item__button"
              onClick={onReload}
              disabled={isBusy}
            >
              Recargar
            </button>
            <button
              type="button"
              className="global-view-item__button global-view-item__button--danger"
              onClick={onDelete}
              disabled={!canDelete}
            >
              Eliminar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};