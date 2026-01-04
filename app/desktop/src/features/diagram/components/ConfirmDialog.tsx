type ConfirmDialogProps = {
  eyebrow?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: "primary" | "danger";
  isLoading?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
};

export const ConfirmDialog = ({
  eyebrow = "Confirmación",
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmTone = "primary",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const confirmClassName =
    confirmTone === "danger"
      ? "diagram-modal__button diagram-modal__button--danger"
      : "diagram-modal__button";

  return (
    <div className="diagram-modal" role="dialog" aria-modal="true">
      <div className="diagram-modal__backdrop" />
      <div className="diagram-modal__content">
        <div>
          <p className="diagram-modal__eyebrow">{eyebrow}</p>
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
            {cancelLabel}
          </button>
          <button
            type="button"
            className={confirmClassName}
            onClick={onConfirm}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};