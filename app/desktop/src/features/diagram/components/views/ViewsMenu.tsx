import { useEffect, useRef, useState } from "react";
import type { ViewSummary } from "../../../../services/viewsService";
import { GlobalViewItem } from "./GlobalViewItem";
import { ViewItem } from "./ViewItem";

type ViewsMenuProps = {
  views: ViewSummary[];
  isLoading: boolean;
  isBusy: boolean;
  disabled?: boolean;
  globalView: {
    exists: boolean;
    isCollapsed: boolean;
    isLoading: boolean;
    onToggleCollapse: () => void;
    onLoad: () => Promise<void> | void;
    onSave: () => Promise<void> | void;
    onReload: () => Promise<void> | void;
    onDelete: () => Promise<void> | void;
  };
  onCreateView: (name?: string) => Promise<void>;
  onSaveView: (viewId: string) => Promise<void>;
  onLoadView: (viewId: string) => Promise<void>;
  onRenameView: (viewId: string, name: string) => Promise<void>;
  onDeleteView: (viewId: string) => Promise<void>;
};

export const ViewsMenu = ({
  views,
  isLoading,
  isBusy,
  disabled,
  globalView,
  onCreateView,
  onSaveView,
  onLoadView,
  onRenameView,
  onDeleteView,
}: ViewsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleCreate = async () => {
    await onCreateView(newViewName.trim() || undefined);
    setNewViewName("");
  };

  const handleDelete = async (viewId: string) => {
    const confirmed = window.confirm(
      "¿Eliminar esta vista? Esta acción no se puede deshacer.",
    );
    if (!confirmed) return;
    await onDeleteView(viewId);
  };

    const handleGlobalDelete = async () => {
    const confirmed = window.confirm(
      "¿Eliminar la vista global? Esta acción no se puede deshacer.",
    );
    if (!confirmed) return;
    await globalView.onDelete();
  };

  return (
    <div className="views-menu" ref={menuRef}>
      <button
        type="button"
        className="diagram-topbar__button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        disabled={disabled}
      >
        Vistas
      </button>
      {isOpen ? (
        <div className="views-menu__popover" role="dialog" aria-label="Vistas">
          <div className="views-menu__header">
            <div>
              <p className="views-menu__eyebrow">Vistas</p>
              <h3 className="views-menu__title">Gestión rápida</h3>
            </div>
            <button
              type="button"
              className="views-menu__close"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar vistas"
            >
              ✕
            </button>
          </div>
          <div className="views-menu__new">
            <input
              className="views-menu__input"
              value={newViewName}
              onChange={(event) => setNewViewName(event.target.value)}
              placeholder="Nombre de la nueva vista"
              disabled={isBusy}
            />
            <button
              type="button"
              className="views-menu__action"
              onClick={handleCreate}
              disabled={isBusy}
            >
              Guardar nueva
            </button>
          </div>
          <div className="views-menu__content">
            <GlobalViewItem
              isCollapsed={globalView.isCollapsed}
              onToggleCollapse={globalView.onToggleCollapse}
              exists={globalView.exists}
              isLoading={globalView.isLoading}
              isDisabled={isBusy}
              onLoad={globalView.onLoad}
              onSave={globalView.onSave}
              onReload={globalView.onReload}
              onDelete={handleGlobalDelete}
            />
            {isLoading ? (
              <p className="views-menu__empty">Cargando vistas...</p>
            ) : views.length === 0 ? (
              <p className="views-menu__empty">No hay vistas guardadas.</p>
            ) : (
              views.map((view) => (
                <ViewItem
                  key={view.id}
                  view={view}
                  isBusy={isBusy}
                  onLoad={onLoadView}
                  onSave={onSaveView}
                  onRename={onRenameView}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};