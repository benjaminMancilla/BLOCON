import { useEffect, useRef, useState } from "react";
import type { DraftSummary } from "../../../../services/draftService";
import { DraftItem } from "./DraftItem";

type DraftsMenuProps = {
  drafts: DraftSummary[];
  isLoading: boolean;
  isBusy: boolean;
  disabled?: boolean;
  onCreateDraft: (name?: string) => Promise<void>;
  onSaveDraft: (draftId: string) => Promise<void>;
  onLoadDraft: (draftId: string) => Promise<void>;
  onRenameDraft: (draftId: string, name: string) => Promise<void>;
  onDeleteDraft: (draftId: string) => Promise<void>;
};

export const DraftsMenu = ({
  drafts,
  isLoading,
  isBusy,
  disabled,
  onCreateDraft,
  onSaveDraft,
  onLoadDraft,
  onRenameDraft,
  onDeleteDraft,
}: DraftsMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newDraftName, setNewDraftName] = useState("");
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
    await onCreateDraft(newDraftName.trim() || undefined);
    setNewDraftName("");
  };

  const handleDelete = async (draftId: string) => {
    const confirmed = window.confirm(
      "¿Eliminar este borrador? Esta acción no se puede deshacer.",
    );
    if (!confirmed) return;
    await onDeleteDraft(draftId);
  };

  return (
    <div className="drafts-menu" ref={menuRef}>
      <button
        type="button"
        className="diagram-topbar__button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        disabled={disabled}
      >
        Borradores
      </button>
      {isOpen ? (
        <div className="drafts-menu__popover" role="dialog" aria-label="Borradores">
          <div className="drafts-menu__header">
            <div>
              <p className="drafts-menu__eyebrow">Borradores</p>
              <h3 className="drafts-menu__title">Gestión rápida</h3>
            </div>
            <button
              type="button"
              className="drafts-menu__close"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar borradores"
            >
              ✕
            </button>
          </div>
          <div className="drafts-menu__new">
            <input
              className="drafts-menu__input"
              value={newDraftName}
              onChange={(event) => setNewDraftName(event.target.value)}
              placeholder="Nombre del nuevo borrador"
              disabled={isBusy}
            />
            <button
              type="button"
              className="drafts-menu__action"
              onClick={handleCreate}
              disabled={isBusy}
            >
              Guardar nuevo
            </button>
          </div>
          <div className="drafts-menu__content">
            {isLoading ? (
              <p className="drafts-menu__empty">Cargando borradores...</p>
            ) : drafts.length === 0 ? (
              <p className="drafts-menu__empty">
                No hay borradores guardados.
              </p>
            ) : (
              drafts.map((draft) => (
                <DraftItem
                  key={draft.id}
                  draft={draft}
                  isBusy={isBusy}
                  onLoad={onLoadDraft}
                  onSave={onSaveDraft}
                  onRename={onRenameDraft}
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