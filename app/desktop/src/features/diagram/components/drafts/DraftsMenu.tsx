import { useEffect, useRef, useState } from "react";
import type { DraftSummary } from "../../../../services/draftService";
import { useConfirmDialog } from "../../hooks/useConfirmDialog";
import { DraftItem } from "./DraftItem";

type DraftsMenuProps = {
  drafts: DraftSummary[];
  isLoading: boolean;
  isBusy: boolean;
  maxDrafts: number;
  isFull: boolean;
  disabled?: boolean;
  onCreateDraft: (name?: string) => Promise<void>;
  onSaveDraft: (draftId: string, name?: string) => Promise<void>;
  onLoadDraft: (draftId: string) => Promise<void>;
  onRenameDraft: (draftId: string, name: string) => Promise<void>;
  onDeleteDraft: (draftId: string) => Promise<void>;
};

export const DraftsMenu = ({
  drafts,
  isLoading,
  isBusy,
  maxDrafts,
  isFull,
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
  const { confirm, dialog } = useConfirmDialog();

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
    if (isFull) return;
    const confirmed = await confirm({
      title: "Guardar borrador",
      description: "¿Guardar cambios en este borrador?",
      confirmLabel: "Guardar",
    });
    if (!confirmed) return;
    await onCreateDraft(newDraftName.trim() || undefined);
    setNewDraftName("");
  };

  const handleSave = async (draftId: string, name?: string) => {
    const confirmed = await confirm({
      title: "Guardar borrador",
      description: "¿Guardar cambios en este borrador?",
      confirmLabel: "Guardar",
    });
    if (!confirmed) return;
    await onSaveDraft(draftId, name);
  };

  const handleLoad = async (draftId: string) => {
    const confirmed = await confirm({
      title: "Cargar borrador",
      description:
        "Cargar este borrador reemplazará el grafo y la vista actual. ¿Continuar?",
      confirmLabel: "Cargar",
    });
    if (!confirmed) return;
    await onLoadDraft(draftId);
  };

  const handleDelete = async (draftId: string) => {
    const confirmed = await confirm({
      title: "Eliminar borrador",
      description: "Eliminar este borrador no se puede deshacer. ¿Eliminar?",
      confirmLabel: "Eliminar",
      confirmTone: "danger",
    });
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
            {isFull ? (
              <p className="drafts-menu__full">
                Se alcanzó el máximo de {maxDrafts} borradores.
              </p>
            ) : (
              <input
                className="drafts-menu__input"
                value={newDraftName}
                onChange={(event) => setNewDraftName(event.target.value)}
                placeholder="Nombre del nuevo borrador"
                disabled={isBusy}
              />
            )}
            <button
              type="button"
              className="drafts-menu__action"
              onClick={handleCreate}
              disabled={isBusy || isFull}
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
                  onLoad={handleLoad}
                  onSave={handleSave}
                  onRename={onRenameDraft}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </div>
      ) : null}
      {dialog}
    </div>
  );
};