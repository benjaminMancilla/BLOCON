type CloseGuardAction = {
  label: string;
  tone?: "primary" | "danger" | "ghost";
  isLoading?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

type CloseGuardDialogProps = {
  title: string;
  description: string;
  actions: CloseGuardAction[];
};

const getButtonClassName = (tone?: CloseGuardAction["tone"]) => {
  if (tone === "ghost") {
    return "diagram-modal__button diagram-modal__button--ghost";
  }
  if (tone === "danger") {
    return "diagram-modal__button diagram-modal__button--danger";
  }
  return "diagram-modal__button";
};

export const CloseGuardDialog = ({
  title,
  description,
  actions,
}: CloseGuardDialogProps) => (
  <div className="diagram-modal" role="dialog" aria-modal="true">
    <div className="diagram-modal__backdrop" />
    <div className="diagram-modal__content">
      <div className="diagram-modal__body">
        <p className="diagram-modal__eyebrow">Salida</p>
        <h2 className="diagram-modal__title">{title}</h2>
        <p className="diagram-modal__description">{description}</p>
      </div>
      <div className="diagram-modal__actions">
        {actions.map((action) => (
          <button
            key={action.label}
            className={getButtonClassName(action.tone)}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled || action.isLoading}
          >
            {action.isLoading ? (
              <span className="diagram-modal__spinner" aria-hidden="true" />
            ) : null}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  </div>
);