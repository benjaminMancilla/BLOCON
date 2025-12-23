import { useEffect, useMemo, useState, type KeyboardEvent } from "react";

export type DiagramNodeType = "gate" | "component";

export type DiagramNodeSelection = {
  id: string;
  type: DiagramNodeType;
  name?: string | null;
};

type SelectionStatus = "selecting" | "idle" | "selected";

type DiagramElementSelectorProps = {
  externalSelection?: DiagramNodeSelection | null;
  onSelectionConfirmed?: (selection: DiagramNodeSelection) => void;
  onSelectionCleared?: () => void;
  onSelectionModeChange?: (isSelecting: boolean) => void;
};

const LABELS: Record<DiagramNodeType, string> = {
  gate: "Gate",
  component: "Componente",
};

export const DiagramElementSelector = ({
  externalSelection,
  onSelectionConfirmed,
  onSelectionCleared,
  onSelectionModeChange,
}: DiagramElementSelectorProps) => {
  const [status, setStatus] = useState<SelectionStatus>("selecting");
  const [draftSelection, setDraftSelection] =
    useState<DiagramNodeSelection | null>(null);
  const [confirmedSelection, setConfirmedSelection] =
    useState<DiagramNodeSelection | null>(null);

  const simulatedSelection = useMemo<DiagramNodeSelection>(
    () => ({
      id: "G-204",
      type: "gate",
      name: "Gate 204",
    }),
    [],
  );

  useEffect(() => {
    onSelectionModeChange?.(status === "selecting");
  }, [onSelectionModeChange, status]);

  useEffect(() => {
    if (externalSelection === undefined) return;
    setDraftSelection(externalSelection);
  }, [externalSelection]);

  const selectionToDisplay =
    status === "selected" ? confirmedSelection : draftSelection;

  const handleCancel = () => {
    setDraftSelection(null);
    setStatus("idle");
    onSelectionCleared?.();
  };

  const handleConfirm = () => {
    if (!draftSelection) return;
    setConfirmedSelection(draftSelection);
    setStatus("selected");
    onSelectionConfirmed?.(draftSelection);
  };

  const handleStartSelecting = () => {
    setStatus("selecting");
    setDraftSelection(null);
    setConfirmedSelection(null);
    onSelectionCleared?.();
  };

  const handleSimulateSelection = () => {
    if (status !== "selecting") return;
    setDraftSelection(simulatedSelection);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape" && status === "selecting") {
      handleCancel();
    }
  };

  return (
    <section
      className="add-component-panel__diagram-selector"
      onDoubleClick={handleSimulateSelection}
      onKeyDown={handleKeyDown}
      tabIndex={status === "selecting" ? 0 : -1}
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
              onClick={handleCancel}
            >
              Cancelar
            </button>
            <button
              className="add-component-panel__diagram-button"
              type="button"
              onClick={handleConfirm}
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
            onClick={handleStartSelecting}
          >
            Escoger elemento
          </button>
        ) : null}
      </div>
    </section>
  );
};