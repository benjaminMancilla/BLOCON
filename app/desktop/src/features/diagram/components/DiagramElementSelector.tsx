import { useEffect } from "react";
import type {
  DiagramNodeSelection,
  DiagramNodeType,
  SelectionStatus,
} from "../types/selection";

type DiagramElementSelectorProps = {
  status: SelectionStatus;
  draftSelection: DiagramNodeSelection | null;
  confirmedSelection: DiagramNodeSelection | null;
  onSelectionConfirmed?: (selection: DiagramNodeSelection) => void;
  onSelectionCleared?: () => void;
  onSelectionStart?: () => void;
};

const LABELS: Record<DiagramNodeType, string> = {
  gate: "Gate",
  component: "Componente",
};

export const DiagramElementSelector = ({
  status,
  draftSelection,
  confirmedSelection,
  onSelectionConfirmed,
  onSelectionCleared,
  onSelectionStart,
}: DiagramElementSelectorProps) => {
  const selectionToDisplay =
    status === "selected" ? confirmedSelection : draftSelection;

  useEffect(() => {
    if (status !== "selecting") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onSelectionCleared?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onSelectionCleared, status]);

  return (
    <section
      className={`add-component-panel__diagram-selector${
        status === "selecting"
          ? " add-component-panel__diagram-selector--active"
          : ""
      }`}
    >
      <div className="add-component-panel__diagram-header">
        <span>Seleccionar elemento</span>
        {status === "selecting" ? (
          <span className="add-component-panel__diagram-status">
            Seleccionando
          </span>
        ) : null}
      </div>

      {selectionToDisplay ? (
        <div className="add-component-panel__diagram-card">
          <div className="add-component-panel__diagram-title">
            {selectionToDisplay.name ?? selectionToDisplay.id}
          </div>
          <div className="add-component-panel__diagram-meta">
            <span>{selectionToDisplay.id}</span>
            <span>{LABELS[selectionToDisplay.type]}</span>
          </div>
        </div>
      ) : null}

      <div className="add-component-panel__diagram-actions">
        {status === "selecting" ? (
          <>
            <button
              className="add-component-panel__diagram-button add-component-panel__diagram-button--ghost"
              type="button"
              onClick={onSelectionCleared}
            >
              Cancelar
            </button>
            <button
              className="add-component-panel__diagram-button"
              type="button"
              onClick={() => {
                if (!draftSelection) return;
                onSelectionConfirmed?.(draftSelection);
              }}
              disabled={!draftSelection}
            >
              Seleccionar
            </button>
          </>
        ) : null}

        {status === "idle" ? (
          <button
            className="add-component-panel__diagram-button"
            type="button"
            onClick={onSelectionStart}
          >
            Escoger elemento
          </button>
        ) : null}
      </div>
    </section>
  );
};