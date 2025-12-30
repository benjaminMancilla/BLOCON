import type { DiagramNodeSelection } from "../types/selection";

type DeleteConfirmDialogProps = {
  selection: DiagramNodeSelection;
  isLoading?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
};

const isGateSelection = (selection: DiagramNodeSelection) =>
  selection.type === "gate" || selection.type === "collapsedGate";

export const DeleteConfirmDialog = ({
  selection,
  isLoading = false,
  onConfirm,
  onCancel,
}: DeleteConfirmDialogProps) => {
  const isGate = isGateSelection(selection);
  const title = isGate
    ? "Confirmar borrado de gate"
    : "Confirmar borrado de componente";
  const description = isGate
    ? `Vas a borrar la gate ${selection.name ?? selection.id}. Esta acción no se puede deshacer.`
    : `Vas a borrar el componente ${selection.name ?? selection.id}. Esta acción no se puede deshacer.`;

  return (
    <div className="diagram-modal" role="dialog" aria-modal="true">
      <div className="diagram-modal__backdrop" />
      <div className="diagram-modal__content">
        <div>
          <p className="diagram-modal__eyebrow">Borrar</p>
          <h2 className="diagram-modal__title">{title}</h2>
          <p className="diagram-modal__description">{description}</p>
        </div>
        <div className="diagram-modal__actions">
          <button
            type="button"
            className="diagram-modal__button diagram-modal__button--ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="diagram-modal__button diagram-modal__button--danger"
            onClick={onConfirm}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? "Borrando..." : "Borrar"}
          </button>
        </div>
      </div>
    </div>
  );
};