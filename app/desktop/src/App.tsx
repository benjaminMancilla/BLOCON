import { useCallback, useEffect, useMemo, useState } from "react";
import { DiagramCanvas } from "./features/diagram/components/DiagramCanvas";
import { DiagramSidePanel } from "./features/diagram/components/DiagramSidePanel";
import { DiagramTopBar } from "./features/diagram/components/DiagramTopBar";
import { AddComponentPanel } from "./features/diagram/components/AddComponentPanel";
import type {
  DiagramNodeSelection,
  SelectionStatus,
} from "./features/diagram/types/selection";

function App() {
  const [isAddMode, setIsAddMode] = useState(false);
  const [selectionStatus, setSelectionStatus] =
    useState<SelectionStatus>("selecting");
  const [draftSelection, setDraftSelection] =
    useState<DiagramNodeSelection | null>(null);
  const [confirmedSelection, setConfirmedSelection] =
    useState<DiagramNodeSelection | null>(null);
  const [hoveredSelectionId, setHoveredSelectionId] = useState<string | null>(
    null,
  );

  const isSelectionMode = isAddMode && selectionStatus === "selecting";

  useEffect(() => {
    if (!isAddMode) {
      setSelectionStatus("selecting");
      setDraftSelection(null);
      setConfirmedSelection(null);
      setHoveredSelectionId(null);
    }
  }, [isAddMode]);

  const handleSelectionStart = useCallback(() => {
    setSelectionStatus("selecting");
    setDraftSelection(null);
    setConfirmedSelection(null);
    setHoveredSelectionId(null);
  }, []);

  const handleSelectionCancel = useCallback(() => {
    setSelectionStatus("idle");
    setDraftSelection(null);
    setConfirmedSelection(null);
    setHoveredSelectionId(null);
  }, []);

  const handleSelectionConfirm = useCallback(
    (selection: DiagramNodeSelection) => {
      setDraftSelection(selection);
      setConfirmedSelection(selection);
      setSelectionStatus("selected");
      setHoveredSelectionId(null);
    },
    [],
  );

  const handleSelectionReset = useCallback(() => {
    setSelectionStatus("idle");
    setDraftSelection(null);
    setConfirmedSelection(null);
    setHoveredSelectionId(null);
  }, []);

  const handleNodePreselect = useCallback(
    (selection: DiagramNodeSelection) => {
      if (!isSelectionMode) return;
      setDraftSelection(selection);
    },
    [isSelectionMode],
  );

  const handleNodeConfirm = useCallback(
    (selection: DiagramNodeSelection) => {
      if (!isSelectionMode) return;
      setDraftSelection(selection);
      handleSelectionConfirm(selection);
    },
    [handleSelectionConfirm, isSelectionMode],
  );

  const handleNodeHover = useCallback(
    (nodeId: string | null) => {
      if (!isSelectionMode) return;
      setHoveredSelectionId(nodeId);
    },
    [isSelectionMode],
  );

  const handleSelectionModeEnter = useCallback(() => {
    setHoveredSelectionId(null);
  }, []);

  const handleSelectionModeExit = useCallback(() => {
    setHoveredSelectionId(null);
  }, []);

  const selectionMeta = useMemo(
    () => ({
      preselectedId: draftSelection?.id ?? null,
      selectedId: confirmedSelection?.id ?? null,
      hoveredId: hoveredSelectionId,
    }),
    [confirmedSelection?.id, draftSelection?.id, hoveredSelectionId],
  );

  return (
    <div className="app">
      <DiagramTopBar
        isAddMode={isAddMode}
        isSelectionMode={isSelectionMode}
        onToggleAddMode={() => setIsAddMode((current) => !current)}
      />
      <div className="diagram-workspace">
        <DiagramCanvas
          isSelectionMode={isSelectionMode}
          preselectedNodeId={selectionMeta.preselectedId}
          selectedNodeId={selectionMeta.selectedId}
          hoveredNodeId={selectionMeta.hoveredId}
          onEnterSelectionMode={handleSelectionModeEnter}
          onExitSelectionMode={handleSelectionModeExit}
          onNodeHover={handleNodeHover}
          onNodePreselect={handleNodePreselect}
          onNodeConfirm={handleNodeConfirm}
          onSelectionCancel={handleSelectionCancel}
        />
        {isAddMode ? (
          <DiagramSidePanel>
            <AddComponentPanel
              selectionStatus={selectionStatus}
              draftSelection={draftSelection}
              confirmedSelection={confirmedSelection}
              onSelectionConfirm={handleSelectionConfirm}
              onSelectionCancel={handleSelectionCancel}
              onSelectionStart={handleSelectionStart}
              onSelectionReset={handleSelectionReset}
            />
          </DiagramSidePanel>
        ) : null}
      </div>
    </div>
  );
}

export default App;