import type { EventHistoryItem } from "../../../services/eventHistoryService";
import { formatEventKind } from "../utils/eventKindLabels";
import { DiagramSidePanel } from "./DiagramSidePanel";

const formatTimestamp = (value?: string) => {
  if (typeof value !== "string" || !value.trim()) {
    return { date: "Sin fecha", time: "" };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: value, time: "" };
  }
  return {
    date: parsed.toLocaleDateString("es-ES"),
    time: parsed.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
};

type VersionHistoryPanelProps = {
  events: EventHistoryItem[];
  offset: number;
  isLoading: boolean;
  errorMessage: string | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  page: number;
  totalPages: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onEventMenuOpen?: (
    event: EventHistoryItem,
    options: { version: number; position: { x: number; y: number } },
  ) => void;
};

export const VersionHistoryPanel = ({
  events,
  offset,
  isLoading,
  errorMessage,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  page,
  totalPages,
  canGoNext,
  canGoPrevious,
  onNext,
  onPrevious,
  onClose,
  onEventMenuOpen,
}: VersionHistoryPanelProps) => {
  const handleEventMenuOpen = (
    event: EventHistoryItem,
    version: number,
    position: { x: number; y: number },
  ) => {
    onEventMenuOpen?.(event, { version, position });
  };

  return (
    <DiagramSidePanel className="diagram-side-panel--version-history">
      <section className="version-history-panel">
          <header className="version-history-panel__header">
            <div className="version-history-panel__header-text">
              <h2 className="version-history-panel__title">
                Historial de versiones
              </h2>
              <p className="version-history-panel__subtitle">
                Eventos históricos del grafo listados por versión.
              </p>
            </div>
            <button
              type="button"
              className="version-history-panel__close"
              onClick={onClose}
              aria-label="Cerrar historial de versiones"
            >
              ×
            </button>
          </header>

          <div className="version-history-panel__search">
            <label
              className="version-history-panel__label"
              htmlFor="history-search"
            >
              Buscar
            </label>
            <input
              id="history-search"
              type="search"
              placeholder="Buscar por versión, tipo de evento o fecha"
              className="version-history-panel__input"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                onSearchSubmit();
              }}
            />
            <p className="version-history-panel__helper">
              Usa una versión exacta, un tipo de evento o fecha (YYYY-MM o
              YYYY-MM-DD).
            </p>
          </div>

          <div className="version-history-panel__list">
            <div className="version-history-panel__list-header">
              <span>Versión</span>
              <span>Evento</span>
              <span>Timestamp</span>
            </div>
            {isLoading ? (
              <p className="version-history-panel__status">
                Cargando eventos...
              </p>
            ) : errorMessage ? (
              <p className="version-history-panel__status version-history-panel__status--error">
                {errorMessage}
              </p>
            ) : events.length === 0 ? (
              <p className="version-history-panel__status">
                Aún no hay eventos para mostrar.
              </p>
            ) : (
              <ul className="version-history-panel__items">
                {events.map((event, index) => {
                  const version =
                    typeof event.version === "number"
                      ? event.version
                      : offset + index + 1;
                  const kind = formatEventKind(event.kind);
                  const timestamp = formatTimestamp(event.ts);
                  return (
                    <li key={`${version}-${index}`}>
                      <button
                        type="button"
                        className="version-history-panel__item"
                        onClick={(eventItem) => {
                          handleEventMenuOpen(event, version, {
                            x: eventItem.clientX,
                            y: eventItem.clientY,
                          });
                        }}
                        onContextMenu={(eventItem) => {
                          eventItem.preventDefault();
                          handleEventMenuOpen(event, version, {
                            x: eventItem.clientX,
                            y: eventItem.clientY,
                          });
                        }}
                        aria-haspopup="menu"
                      >
                        <span className="version-history-panel__item-version">
                          v{version}
                        </span>
                        <span className="version-history-panel__item-kind">
                          {kind}
                        </span>
                        <span className="version-history-panel__item-ts">
                          <span>{timestamp.date}</span>
                          {timestamp.time ? (
                            <span className="version-history-panel__item-time">
                              {timestamp.time}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer className="version-history-panel__footer">
            <div className="version-history-panel__pagination">
              <button
                type="button"
                className="version-history-panel__page-button"
                onClick={onPrevious}
                disabled={!canGoPrevious || isLoading}
              >
                Anterior
              </button>
              <span className="version-history-panel__page-info">
                Página {page + 1} de {totalPages}
              </span>
              <button
                type="button"
                className="version-history-panel__page-button"
                onClick={onNext}
                disabled={!canGoNext || isLoading}
              >
                Siguiente
              </button>
            </div>
          </footer>
      </section>
    </DiagramSidePanel>
  );
};