import { useEffect, useMemo, useState } from "react";
import type { DraftSummary } from "../../../../services/draftService";

type DraftItemProps = {
  draft: DraftSummary;
  isBusy: boolean;
  onLoad: (draftId: string) => void;
  onSave: (draftId: string, name?: string) => void;
  onRename: (draftId: string, name: string) => void;
  onDelete: (draftId: string) => void;
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

export const DraftItem = ({
  draft,
  isBusy,
  onLoad,
  onSave,
  onRename,
  onDelete,
}: DraftItemProps) => {
  const [name, setName] = useState(draft.name);

  useEffect(() => {
    setName(draft.name);
  }, [draft.name]);

  const savedAtLabel = useMemo(() => formatSavedAt(draft.savedAt), [draft.savedAt]);
  const trimmedName = name.trim();
  const canRename = Boolean(trimmedName) && trimmedName !== draft.name;
  const saveName = trimmedName || undefined;

  return (
    <div className="draft-item">
      <div className="draft-item__meta">
        <input
          className="draft-item__name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nombre del borrador"
          disabled={isBusy}
          aria-label={`Nombre del borrador ${draft.name}`}
        />
        <span className="draft-item__date">{savedAtLabel}</span>
      </div>
      <div className="draft-item__actions">
        <button
          type="button"
          className="draft-item__button"
          onClick={() => onLoad(draft.id)}
          disabled={isBusy}
        >
          Cargar
        </button>
        <button
          type="button"
          className="draft-item__button"
          onClick={() => onSave(draft.id, saveName)}
          disabled={isBusy}
        >
          Guardar
        </button>
        <button
          type="button"
          className="draft-item__button"
          onClick={() => onRename(draft.id, trimmedName)}
          disabled={isBusy || !canRename}
        >
          Renombrar
        </button>
        <button
          type="button"
          className="draft-item__button draft-item__button--danger"
          onClick={() => onDelete(draft.id)}
          disabled={isBusy}
        >
          Eliminar
        </button>
      </div>
    </div>
  );
};