import { useCallback, useEffect, useMemo, useState } from "react";
import { DiagramCanvas } from "./features/diagram/components/DiagramCanvas";
import { DiagramSidePanel } from "./features/diagram/components/DiagramSidePanel";
import { DiagramTopBar } from "./features/diagram/components/DiagramTopBar";
import { AddComponentPanel } from "./features/diagram/components/AddComponentPanel";
import type {
  DiagramNodeSelection,
  SelectionStatus,
} from "./features/diagram/types/selection";
import type { GateType } from "./features/diagram/types/gates";

type AddComponentStep = "selection" | "gateType" | "organization";

function App() {
  const [isAddMode, setIsAddMode] = useState(false);
  const [addComponentStep, setAddComponentStep] =
    useState<AddComponentStep>("selection");
  const [selectionStatus, setSelectionStatus] =
    useState<SelectionStatus>("selecting");
  const [draftSelection, setDraftSelection] =
    useState<DiagramNodeSelection | null>(null);
  const [confirmedSelection, setConfirmedSelection] =
    useState<DiagramNodeSelection | null>(null);
  const [selectedGateType, setSelectedGateType] =
    useState<GateType | null>(null);
  const [isOrganizationActive, setIsOrganizationActive] = useState(false);
  const [hoveredSelectionId, setHoveredSelectionId] = useState<string | null>(
    null,
  );

  const isSelectionMode =
    isAddMode &&
    addComponentStep === "selection" &&
    selectionStatus === "selecting";
  const isOrganizationStage =
    isAddMode && addComponentStep === "organization";
  const isOrganizationMode =
    isOrganizationStage && isOrganizationActive;

  useEffect(() => {
    if (!isAddMode) {
      setAddComponentStep("selection");
      setSelectionStatus("selecting");
      setDraftSelection(null);
      setConfirmedSelection(null);
      setSelectedGateType(null);
      setIsOrganizationActive(false);
      setHoveredSelectionId(null);
    }
  }, [isAddMode]);

  useEffect(() => {
    if (addComponentStep !== "organization") {
      setIsOrganizationActive(false);
    }
  }, [addComponentStep]);

  const handleSelectionStart = useCallback(() => {
    setAddComponentStep("selection");
    setSelectionStatus("selecting");
    setDraftSelection(null);
    setConfirmedSelection(null);
    setHoveredSelectionId(null);
    setSelectedGateType(null);
    setIsOrganizationActive(false);
  }, []);

  const handleSelectionCancel = useCallback(() => {
    setAddComponentStep("selection");
    setSelectionStatus("idle");
    setDraftSelection(null);
    setConfirmedSelection(null);
    setSelectedGateType(null);
    setIsOrganizationActive(false);
    setHoveredSelectionId(null);
  }, []);

  const handleSelectionConfirm = useCallback(
    (selection: DiagramNodeSelection) => {
      setDraftSelection(selection);
      setConfirmedSelection(selection);
      setSelectionStatus("selected");
      setHoveredSelectionId(null);
      setSelectedGateType(null);
      if (selection.type === "gate") {
        setAddComponentStep("organization");
        setIsOrganizationActive(true);
      } else {
        setIsOrganizationActive(false);
        setAddComponentStep("gateType");
      }
    },
    [],
  );

  const handleSelectionReset = useCallback(() => {
    setAddComponentStep("selection");
    setSelectionStatus("idle");
    setDraftSelection(null);
    setConfirmedSelection(null);
    setSelectedGateType(null);
    setIsOrganizationActive(false);
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

  const handleGateTypeChange = useCallback(
    (gateType: GateType | null) => {
      setSelectedGateType(gateType);
      if (gateType && confirmedSelection?.type === "component") {
        setAddComponentStep("organization");
        setIsOrganizationActive(true);
      }
    },
    [confirmedSelection?.type],
  );

  const handleOrganizationStart = useCallback(() => {
    setIsOrganizationActive(true);
  }, []);

  const handleOrganizationCancel = useCallback(() => {
    setIsOrganizationActive(false);
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
        isOrganizationMode={isOrganizationMode}
        onToggleAddMode={() => setIsAddMode((current) => !current)}
      />
      <div className="diagram-workspace">
        <DiagramCanvas
          isSelectionMode={isSelectionMode}
          isOrganizationMode={isOrganizationMode}
          organizationSelection={confirmedSelection}
          organizationGateType={selectedGateType}
          preselectedNodeId={selectionMeta.preselectedId}
          selectedNodeId={selectionMeta.selectedId}
          hoveredNodeId={selectionMeta.hoveredId}
          onEnterSelectionMode={handleSelectionModeEnter}
          onExitSelectionMode={handleSelectionModeExit}
          onNodeHover={handleNodeHover}
          onNodePreselect={handleNodePreselect}
          onNodeConfirm={handleNodeConfirm}
          onSelectionCancel={handleSelectionCancel}
          onOrganizationCancel={handleOrganizationCancel}
        />
        {isAddMode ? (
          <DiagramSidePanel>
            <AddComponentPanel
              step={addComponentStep}
              selectionStatus={selectionStatus}
              draftSelection={draftSelection}
              confirmedSelection={confirmedSelection}
              gateType={selectedGateType}
              isOrganizing={isOrganizationMode}
              onSelectionConfirm={handleSelectionConfirm}
              onSelectionCancel={handleSelectionCancel}
              onSelectionStart={handleSelectionStart}
              onSelectionReset={handleSelectionReset}
              onGateTypeChange={handleGateTypeChange}
              onOrganizationStart={handleOrganizationStart}
              onOrganizationCancel={handleOrganizationCancel}
            />
          </DiagramSidePanel>
        ) : null}
      </div>
    </div>
  );
}

export default App;