import { useEffect, useMemo, useState } from "react";
import type { ViewSummary } from "../../../../services/viewsService";

type ViewItemProps = {
  view: ViewSummary;
  isBusy: boolean;
  onLoad: (viewId: string) => void;
  onSave: (viewId: string) => void;
  onRename: (viewId: string, name: string) => void;
  onDelete: (viewId: string) => void;
};

const formatSavedAt = (value: string | null) => {
  if (!value) return "Sin guardado";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Sin guardado";
  return parsed.toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export const ViewItem = ({
  view,
  isBusy,
  onLoad,
  onSave,
  onRename,
  onDelete,
}: ViewItemProps) => {
  const [name, setName] = useState(view.name);

  useEffect(() => {
    setName(view.name);
  }, [view.name]);

  const savedAtLabel = useMemo(() => formatSavedAt(view.savedAt), [view.savedAt]);
  const trimmedName = name.trim();
  const canRename = Boolean(trimmedName) && trimmedName !== view.name;

  return (
    <div className="view-item">
      <div className="view-item__meta">
        <input
          className="view-item__name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre de la vista"
          disabled={isBusy}
          aria-label={`Nombre de la vista ${view.name}`}
        />
        <span className="view-item__date">{savedAtLabel}</span>
      </div>
      <div className="view-item__actions">
        <button
          type="button"
          className="view-item__button"
          onClick={() => onLoad(view.id)}
          disabled={isBusy}
        >
          Cargar
        </button>
        <button
          type="button"
          className="view-item__button"
          onClick={() => onSave(view.id)}
          disabled={isBusy}
        >
          Guardar
        </button>
        <button
          type="button"
          className="view-item__button"
          onClick={() => onRename(view.id, trimmedName)}
          disabled={isBusy || !canRename}
        >
          Renombrar
        </button>
        <button
          type="button"
          className="view-item__button view-item__button--danger"
          onClick={() => onDelete(view.id)}
          disabled={isBusy}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
};