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
import type { AddComponentFormState } from "./features/diagram/types/addComponent";
import type {
  OrganizationPayload,
  OrganizationUiState,
} from "./features/diagram/types/organization";
import { insertOrganization } from "./services/graphService";

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
  const [formState, setFormState] = useState<AddComponentFormState>({
    componentId: null,
    calculationType: "exponential",
  });
  const [organizationUiState, setOrganizationUiState] =
    useState<OrganizationUiState | null>(null);
  const [organizationPayload, setOrganizationPayload] =
    useState<OrganizationPayload | null>(null);
  const [graphReloadToken, setGraphReloadToken] = useState(0);
  const isGateSelection = useCallback(
    (selection: DiagramNodeSelection | null) => selection?.type === "gate",
    [],
  );
  const isComponentSelection = useCallback(
    (selection: DiagramNodeSelection | null) =>
      selection?.type === "component" || selection?.type === "collapsedGate",
    [],
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
      setFormState({
        componentId: null,
        calculationType: "exponential",
      });
      setOrganizationUiState(null);
      setOrganizationPayload(null);
    }
  }, [isAddMode]);

  useEffect(() => {
    if (addComponentStep !== "organization") {
      setIsOrganizationActive(false);
      setOrganizationUiState(null);
      setOrganizationPayload(null);
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
    setOrganizationUiState(null);
    setOrganizationPayload(null);
  }, []);

  const handleSelectionCancel = useCallback(() => {
    setAddComponentStep("selection");
    setSelectionStatus("idle");
    setDraftSelection(null);
    setConfirmedSelection(null);
    setSelectedGateType(null);
    setIsOrganizationActive(false);
    setHoveredSelectionId(null);
    setOrganizationUiState(null);
    setOrganizationPayload(null);
  }, []);

  const handleSelectionConfirm = useCallback(
    (selection: DiagramNodeSelection) => {
      setDraftSelection(selection);
      setConfirmedSelection(selection);
      setSelectionStatus("selected");
      setHoveredSelectionId(null);
      setSelectedGateType(null);
      setOrganizationUiState(null);
      setOrganizationPayload(null);
      if (isGateSelection(selection)) {
        setAddComponentStep("organization");
        setIsOrganizationActive(true);
      } else {
        setIsOrganizationActive(false);
        setAddComponentStep("gateType");
      }
    },
    [isGateSelection],
  );

  const handleSelectionReset = useCallback(() => {
    setAddComponentStep("selection");
    setSelectionStatus("idle");
    setDraftSelection(null);
    setConfirmedSelection(null);
    setSelectedGateType(null);
    setIsOrganizationActive(false);
    setHoveredSelectionId(null);
    setOrganizationUiState(null);
    setOrganizationPayload(null);
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
      if (gateType && isComponentSelection(confirmedSelection)) {
        setAddComponentStep("organization");
        setIsOrganizationActive(true);
      }
    },
    [confirmedSelection, isComponentSelection],
  );

  const handleSelectionUpdate = useCallback(
    (selection: DiagramNodeSelection) => {
      setDraftSelection((prev) =>
        prev?.id === selection.id ? selection : prev,
      );
      setConfirmedSelection((prev) =>
        prev?.id === selection.id ? selection : prev,
      );
      if (confirmedSelection?.id !== selection.id) return;

      const nextStep = isGateSelection(selection)
        ? "organization"
        : selectedGateType
          ? "organization"
          : "gateType";
      setAddComponentStep(nextStep);
      setIsOrganizationActive(nextStep === "organization");
      setOrganizationUiState(null);
      setOrganizationPayload(null);
    },
    [confirmedSelection?.id, isGateSelection, selectedGateType],
  );

  const handleOrganizationStart = useCallback(() => {
    setIsOrganizationActive(true);
  }, []);

  const handleOrganizationCancel = useCallback(() => {
    setIsOrganizationActive(false);
    setOrganizationUiState(null);
    setOrganizationPayload(null);
  }, []);

  const selectionMeta = useMemo(
    () => ({
      preselectedId: draftSelection?.id ?? null,
      selectedId: confirmedSelection?.id ?? null,
      hoveredId: hoveredSelectionId,
    }),
    [confirmedSelection?.id, draftSelection?.id, hoveredSelectionId],
  );

  useEffect(() => {
    if (!isOrganizationMode || !organizationUiState) {
      setOrganizationPayload(null);
      return;
    }

    const placeholderIndex = organizationUiState.order.indexOf(
      organizationUiState.placeholderId,
    );
    const positionIndex =
      placeholderIndex >= 0 ? placeholderIndex + 1 : null;
    const target =
      confirmedSelection?.id
        ? {
            hostId: confirmedSelection.id,
            hostType: isGateSelection(confirmedSelection) ? "gate" as const : "component" as const,
            relationType: isGateSelection(confirmedSelection)
              ? organizationUiState.gateSubtype
              : selectedGateType,
          }
        : null;

    const insert = {
      ...formState,
      target,
      position: {
        index: positionIndex,
        referenceId: null,
      },
    };

    const orderChanged =
      organizationUiState.order.length !==
        organizationUiState.initialOrder.length ||
      organizationUiState.order.some(
        (value, index) => value !== organizationUiState.initialOrder[index],
      );
    const reorder = orderChanged
      ? organizationUiState.order
          .map((id, index) => ({
            position: index + 1,
            id:
              id === organizationUiState.placeholderId
                ? formState.componentId
                : id,
          }))
          .filter((entry): entry is { position: number; id: string } => entry.id !== null)
      : null;

    setOrganizationPayload({
      insert,
      reorder,
    });
  }, [
    confirmedSelection,
    formState,
    isOrganizationMode,
    isGateSelection,
    organizationUiState,
    selectedGateType,
  ]);

  useEffect(() => {
    if (!organizationPayload) return;
  }, [organizationPayload]);

  const handleInsert = useCallback(async () => {
    if (!organizationPayload?.insert.componentId) return;
    await insertOrganization(organizationPayload);
    setGraphReloadToken((current) => current + 1);
  }, [organizationPayload]);

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
          graphReloadToken={graphReloadToken}
          organizationSelection={confirmedSelection}
          organizationGateType={selectedGateType}
          organizationComponentId={formState.componentId}
          organizationCalculationType={formState.calculationType}
          onOrganizationStateChange={setOrganizationUiState}
          preselectedNodeId={selectionMeta.preselectedId}
          selectedNodeId={selectionMeta.selectedId}
          hoveredNodeId={selectionMeta.hoveredId}
          onEnterSelectionMode={handleSelectionModeEnter}
          onExitSelectionMode={handleSelectionModeExit}
          onNodeHover={handleNodeHover}
          onNodePreselect={handleNodePreselect}
          onNodeConfirm={handleNodeConfirm}
          onSelectionUpdate={handleSelectionUpdate}
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
              formState={formState}
              onSelectionConfirm={handleSelectionConfirm}
              onSelectionCancel={handleSelectionCancel}
              onSelectionStart={handleSelectionStart}
              onSelectionReset={handleSelectionReset}
              onGateTypeChange={handleGateTypeChange}
              onFormStateChange={setFormState}
              onOrganizationStart={handleOrganizationStart}
              onOrganizationCancel={handleOrganizationCancel}
              onInsert={handleInsert}
            />
          </DiagramSidePanel>
        ) : null}
      </div>
    </div>
  );
}

export default App;