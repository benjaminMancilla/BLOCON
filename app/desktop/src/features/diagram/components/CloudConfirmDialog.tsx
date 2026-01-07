import type { CloudAction } from "../types/cloud";
import { SurfaceCard } from "../../../ui/components/SurfaceCard";
import { PrimaryButton, SecondaryButton } from "../../../ui/components/buttons";

type CloudConfirmDialogProps = {
  action: CloudAction;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const CLOUD_COPY: Record<
  CloudAction,
  { title: string; description: string; confirmLabel: string }
> = {
  save: {
    title: "Confirmar guardado en la nube",
    description:
      "Esta acción sobrescribirá el estado actual almacenado en la nube.",
    confirmLabel: "Guardar ahora",
  },
  load: {
    title: "Confirmar carga desde la nube",
    description:
      "Esta acción reemplazará el estado local por la versión en la nube.",
    confirmLabel: "Cargar ahora",
  },
};

export const CloudConfirmDialog = ({
  action,
  isLoading = false,
  onConfirm,
  onCancel,
}: CloudConfirmDialogProps) => {
  const copy = CLOUD_COPY[action];
  return (
    <div className="diagram-modal" role="dialog" aria-modal="true">
      <div className="diagram-modal__backdrop" />
      <SurfaceCard className="diagram-modal__content">
        <div>
          <p className="diagram-modal__eyebrow">Cloud</p>
          <h2 className="diagram-modal__title">{copy.title}</h2>
          <p className="diagram-modal__description">{copy.description}</p>
        </div>
        <div className="diagram-modal__actions">
          <SecondaryButton
            type="button"
            className="diagram-modal__button diagram-modal__button--ghost"
            onClick={onCancel}
          >
            Cancelar
          </SecondaryButton>
          <PrimaryButton
            type="button"
            className="diagram-modal__button"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {copy.confirmLabel}
          </PrimaryButton>
        </div>
      </SurfaceCard>
    </div>
  );
};