import type { CloudError } from "../../../services/cloudErrors";
import { SurfaceCard } from "../../../ui/components/SurfaceCard";
import { PrimaryButton, SecondaryButton } from "../../../ui/components/buttons";

type CloudErrorModalProps = {
  open: boolean;
  error: CloudError | null;
  loading?: "cancel" | "retry" | null;
  actionError?: string | null;
  onCancel: () => void;
  onRetry: () => void;
};

export const CloudErrorModal = ({
  open,
  error,
  loading = null,
  actionError = null,
  onCancel,
  onRetry,
}: CloudErrorModalProps) => {
  if (!open || !error) return null;

  return (
    <div className="diagram-modal" role="dialog" aria-modal="true">
      <div className="diagram-modal__backdrop" />
      <SurfaceCard className="diagram-modal__content">
        <div>
          <p className="diagram-modal__eyebrow">Cloud</p>
          <h2 className="diagram-modal__title">Problema de conexión</h2>
          <p className="diagram-modal__description">{error.message}</p>
          {actionError ? (
            <p className="diagram-modal__alert">{actionError}</p>
          ) : null}
          {error.details ? (
            <details className="diagram-modal__details">
              <summary>Detalles</summary>
              <pre>{error.details}</pre>
            </details>
          ) : null}
        </div>
        <div className="diagram-modal__actions">
          <SecondaryButton
            type="button"
            className="diagram-modal__button diagram-modal__button--ghost"
            onClick={onCancel}
            disabled={loading !== null}
            aria-busy={loading === "cancel"}
          >
            {loading === "cancel" ? (
              <span className="diagram-modal__spinner" aria-hidden="true" />
            ) : null}
            Cancelar
          </SecondaryButton>
          <PrimaryButton
            type="button"
            className="diagram-modal__button"
            onClick={onRetry}
            disabled={loading !== null}
            aria-busy={loading === "retry"}
          >
            {loading === "retry" ? (
              <span className="diagram-modal__spinner" aria-hidden="true" />
            ) : null}
            Reintentar
          </PrimaryButton>
        </div>
      </SurfaceCard>
    </div>
  );
};
