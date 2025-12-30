import type { EventHistoryItem } from "../../../services/eventHistoryService";
import { DiagramSidePanelLeft } from "./DiagramSidePanelLeft";

type EventDetailsPanelProps = {
  isOpen: boolean;
  dependency?: boolean;
  event: EventHistoryItem | null;
  version: number | null;
  payloadText: string;
  onClose: () => void;
};

export const EventDetailsPanel = ({
  isOpen,
  dependency,
  event,
  version,
  payloadText,
  onClose,
}: EventDetailsPanelProps) => {
  if (!isOpen) return null;

  const kind = event?.kind ? String(event.kind) : "Evento";

  return (
    <DiagramSidePanelLeft
      isOpen={isOpen}
      dependency={dependency}
      onClose={onClose}
      className="diagram-side-panel--event-details"
    >
      <section className="event-details-panel">
        <header className="event-details-panel__header">
          <div className="event-details-panel__header-text">
            <h2 className="event-details-panel__title">Detalle del evento</h2>
            <p className="event-details-panel__subtitle">
              {version !== null ? `v${version}` : "Versión desconocida"} ·{" "}
              {kind}
            </p>
          </div>
          <button
            type="button"
            className="event-details-panel__close"
            onClick={onClose}
            aria-label="Cerrar detalles del evento"
          >
            ×
          </button>
        </header>
        <div className="event-details-panel__payload" aria-live="polite">
          <pre>{payloadText || "Sin payload disponible."}</pre>
        </div>
      </section>
    </DiagramSidePanelLeft>
  );
};