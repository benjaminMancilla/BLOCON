import { SurfaceCard } from "../../../ui/components/SurfaceCard";
import {
  DangerButton,
  PrimaryButton,
  SecondaryButton,
} from "../../../ui/components/buttons";

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

const getButtonComponent = (tone?: CloseGuardAction["tone"]) => {
  if (tone === "ghost") {
    return SecondaryButton;
  }
  if (tone === "danger") {
    return DangerButton;
  }
  return PrimaryButton;
};

export const CloseGuardDialog = ({
  title,
  description,
  actions,
}: CloseGuardDialogProps) => (
  <div className="diagram-modal" role="dialog" aria-modal="true">
    <div className="diagram-modal__backdrop" />
    <SurfaceCard className="diagram-modal__content">
      <div className="diagram-modal__body">
        <p className="diagram-modal__eyebrow">Salida</p>
        <h2 className="diagram-modal__title">{title}</h2>
        <p className="diagram-modal__description">{description}</p>
      </div>
      <div className="diagram-modal__actions">
        {actions.map((action) => {
          const ButtonComponent = getButtonComponent(action.tone);
          return (
            <ButtonComponent
              key={action.label}
              className={`diagram-modal__button${
                action.tone === "ghost" ? " diagram-modal__button--ghost" : ""
              }${action.tone === "danger" ? " diagram-modal__button--danger" : ""}`}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled || action.isLoading}
            >
              {action.isLoading ? (
                <span className="diagram-modal__spinner" aria-hidden="true" />
              ) : null}
              {action.label}
            </ButtonComponent>
          );
        })}
      </div>
    </SurfaceCard>
  </div>
);
