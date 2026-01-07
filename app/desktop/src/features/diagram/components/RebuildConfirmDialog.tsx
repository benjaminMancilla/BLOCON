import { SurfaceCard } from "../../../ui/components/SurfaceCard";
import { DangerButton, SecondaryButton } from "../../../ui/components/buttons";

type RebuildConfirmDialogProps = {
  version: number;
  step: 1 | 2;
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const COPY = {
  1: {
    title: "Confirmar rebuild",
    description:
      "Vas a reconstruir el diagrama oficial a una versión pasada. Usa la vista previa si necesitas validar antes de continuar.",
    confirmLabel: "Continuar",
  },
  2: {
    title: "Confirmación final",
    description:
      "Este rollback afectará el diagrama oficial en la nube. La acción no es reversible y se perderán las versiones posteriores.",
    confirmLabel: "Rebuild definitivo",
  },
};

export const RebuildConfirmDialog = ({
  version,
  step,
  isLoading = false,
  onCancel,
  onConfirm,
}: RebuildConfirmDialogProps) => {
  const copy = COPY[step];
  return (
    <div className="diagram-modal" role="dialog" aria-modal="true">
      <div className="diagram-modal__backdrop" />
      <SurfaceCard className="diagram-modal__content">
        <div>
          <p className="diagram-modal__eyebrow">Rebuild</p>
          <h2 className="diagram-modal__title">{copy.title}</h2>
          <p className="diagram-modal__description">
            {copy.description} Versión seleccionada: v{version}.
          </p>
        </div>
        <div className="diagram-modal__actions">
          <SecondaryButton
            type="button"
            className="diagram-modal__button diagram-modal__button--ghost"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar
          </SecondaryButton>
          <DangerButton
            type="button"
            className="diagram-modal__button diagram-modal__button--danger"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {copy.confirmLabel}
          </DangerButton>
        </div>
      </SurfaceCard>
    </div>
  );
};