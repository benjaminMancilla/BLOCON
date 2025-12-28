import type { EventHistoryItem } from "../../../services/eventHistoryService";
import { DiagramSidePanel } from "./DiagramSidePanel";

const EVENT_KIND_LABELS: Record<string, string> = {
  add_component: "Agregar componente",
  add_component_relative: "Agregar componente",
  add_root_component: "Agregar raíz",
  add_gate: "Agregar gate",
  add_edge: "Agregar enlace",
  delete_node: "Eliminar nodo",
  remove_node: "Eliminar nodo",
  move_node: "Mover nodo",
  rename_node: "Renombrar nodo",
  update_node: "Actualizar nodo",
  set_head: "Establecer versión",
  edit_component: "Editar componente",
  edit_gate: "Editar gate",
  set_ignore_range: "Ignorar rango",
  snapshot: "Snapshot",
};

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .map((word) =>
      word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : word,
    )
    .join(" ");

const formatKind = (kind?: string) => {
  const raw = typeof kind === "string" ? kind.trim() : "";
  if (!raw) return "Evento";
  return EVENT_KIND_LABELS[raw] ?? toTitleCase(raw.replace(/_/g, " "));
};

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
  page: number;
  totalPages: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
};

export const VersionHistoryPanel = ({
  events,
  offset,
  isLoading,
  errorMessage,
  page,
  totalPages,
  canGoNext,
  canGoPrevious,
  onNext,
  onPrevious,
  onClose,
}: VersionHistoryPanelProps) => {
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
              Buscar (próximamente)
            </label>
            <input
              id="history-search"
              type="search"
              placeholder="Buscar por versión, tipo de evento o detalle"
              className="version-history-panel__input"
              disabled
            />
            <p className="version-history-panel__helper">
              Este campo quedará habilitado en la próxima iteración para filtrar el
              historial.
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
                  const kind = formatKind(event.kind);
                  const timestamp = formatTimestamp(event.ts);
                  return (
                    <li key={`${version}-${index}`} className="version-history-panel__item">
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