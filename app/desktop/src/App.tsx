import { useCallback, useEffect, useMemo, useState } from "react";
import { DiagramCanvas } from "./features/diagram/components/DiagramCanvas";
import { DiagramSidePanel } from "./features/diagram/components/DiagramSidePanel";
import { DiagramTopBar } from "./features/diagram/components/DiagramTopBar";
import { AddComponentPanel } from "./features/diagram/components/AddComponentPanel";
import { useDiagramGraph } from "./features/diagram/hooks/useDiagramGraph";
import { useComponentSearch } from "./features/diagram/components/addComponent/hooks/useComponentSearch";
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
import {
  insertOrganization,
  loadCloudGraph,
  saveCloudGraph,
} from "./services/graphService";

type AddComponentStep = "selection" | "gateType" | "organization";
type InsertHighlight = {
  token: number;
  componentId: string;
  targetGateId: string | null;
  hostComponentId: string | null;
  gateType: GateType | null;
};
type CloudAction = "save" | "load";
type CloudToast = {
  message: string;
  type: "success" | "error";
  token: number;
};

const ENTER_DEBOUNCE_MS = 650;
const MIN_QUERY_LEN = 2;

const DEFAULT_FORM_STATE: AddComponentFormState = {
  componentId: null,
  calculationType: "exponential",
};

function App() {
  const [isAddMode, setIsAddMode] = useState(false);
  const [addComponentStep, setAddComponentStep] =
    useState<AddComponentStep>("selection");
  const [selectionStatus, setSelectionStatus] =
    useState<SelectionStatus>("idle");
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
  const [formResetToken, setFormResetToken] = useState(0);
  const [insertHighlight, setInsertHighlight] =
    useState<InsertHighlight | null>(null);
  const [insertToastToken, setInsertToastToken] = useState<number | null>(null);
  const [cloudDialogAction, setCloudDialogAction] =
    useState<CloudAction | null>(null);
  const [cloudActionInFlight, setCloudActionInFlight] =
    useState<CloudAction | null>(null);
  const [cloudToast, setCloudToast] = useState<CloudToast | null>(null);
  const [recentlyInsertedComponentId, setRecentlyInsertedComponentId] =
    useState<string | null>(null);
  const { graph, status, errorMessage } = useDiagramGraph(graphReloadToken);
  const existingNodeIds = useMemo(
    () => new Set(graph.nodes.map((node) => node.id)),
    [graph.nodes],
  );
  const pinnedExistingIds = useMemo(() => {
    if (!recentlyInsertedComponentId) return undefined;
    return new Set([recentlyInsertedComponentId]);
  }, [recentlyInsertedComponentId]);
  const componentSearch = useComponentSearch({
    minQueryLength: MIN_QUERY_LEN,
    debounceMs: ENTER_DEBOUNCE_MS,
    existingIds: existingNodeIds,
    alwaysVisibleIds: pinnedExistingIds,
  });
  const insertValidators = useMemo(
    () => [
      {
        id: "unique-component",
        validate: (payload: OrganizationPayload) => {
          const componentId = payload.insert.componentId;
          if (!componentId) return false;
          return !existingNodeIds.has(componentId);
        },
      },
    ],
    [existingNodeIds],
  );
  const runInsertValidations = useCallback(
    (payload: OrganizationPayload) =>
      insertValidators.every((validator) => validator.validate(payload)),
    [insertValidators],
  );
  const isGateSelection = useCallback(
    (selection: DiagramNodeSelection | null) => selection?.type === "gate",
    [],
  );
  const isComponentSelection = useCallback(
    (selection: DiagramNodeSelection | null) =>
      selection?.type === "component" || selection?.type === "collapsedGate",
    [],
  );

  const hasComponentSelected = Boolean(formState.componentId);
  const isSelectionMode =
    isAddMode &&
    addComponentStep === "selection" &&
    selectionStatus === "selecting" &&
    hasComponentSelected;
  const isOrganizationStage =
    isAddMode && addComponentStep === "organization";
  const isOrganizationMode =
    isOrganizationStage && isOrganizationActive && hasComponentSelected;

  useEffect(() => {
    if (!isAddMode) {
      setAddComponentStep("selection");
      setSelectionStatus("idle");
      setDraftSelection(null);
      setConfirmedSelection(null);
      setSelectedGateType(null);
      setIsOrganizationActive(false);
      setHoveredSelectionId(null);
      setFormState({
        ...DEFAULT_FORM_STATE,
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

  const resetSelectionState = useCallback(() => {
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

  const resetAddComponentFlow = useCallback(() => {
    resetSelectionState();
    setFormState({
      ...DEFAULT_FORM_STATE,
    });
  }, [resetSelectionState]);

  const handleSelectionCancel = useCallback(() => {
    resetSelectionState();
  }, [resetSelectionState]);

  const handleSelectionConfirm = useCallback(
    (selection: DiagramNodeSelection) => {
      if (!formState.componentId) return;
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
    [formState.componentId, isGateSelection],
  );

  const handleSelectionReset = useCallback(() => {
    resetAddComponentFlow();
  }, [resetAddComponentFlow]);

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
      if (!formState.componentId) return;
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
    [confirmedSelection?.id, formState.componentId, isGateSelection, selectedGateType],
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
      ...(target?.relationType === "koon" ? { k: 1 } : {}),
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
    if (!runInsertValidations(organizationPayload)) return;
    const insertTarget = organizationPayload.insert.target;
    const insertMeta = {
      componentId: organizationPayload.insert.componentId,
      targetGateId: insertTarget?.hostType === "gate" ? insertTarget.hostId : null,
      hostComponentId:
        insertTarget?.hostType === "component" ? insertTarget.hostId : null,
      gateType: insertTarget?.relationType ?? null,
    };
    await insertOrganization(organizationPayload);
    setGraphReloadToken((current) => current + 1);
    resetAddComponentFlow();
    setFormResetToken((current) => current + 1);
    setRecentlyInsertedComponentId(organizationPayload.insert.componentId);
    setInsertHighlight((current) => ({
      ...insertMeta,
      token: (current?.token ?? 0) + 1,
    }));
    setInsertToastToken((current) => (current ?? 0) + 1);
  }, [organizationPayload, resetAddComponentFlow, runInsertValidations]);

  const handleCloudSave = useCallback(async () => {
    setCloudDialogAction("save");
  }, []);

  const handleCloudLoad = useCallback(async () => {
    setCloudDialogAction("load");
  }, []);

  const handleConfirmCloudAction = useCallback(async () => {
    if (!cloudDialogAction) return;
    const action = cloudDialogAction;
    setCloudDialogAction(null);
    setCloudActionInFlight(action);
    try {
      if (action === "save") {
        await saveCloudGraph();
        setCloudToast({
          message: "Guardado en la nube exitoso.",
          type: "success",
          token: Date.now(),
        });
      } else {
        await loadCloudGraph();
        setGraphReloadToken((current) => current + 1);
        setCloudToast({
          message: "Carga completada desde la nube.",
          type: "success",
          token: Date.now(),
        });
      }
    } catch (error) {
      setCloudToast({
        message:
          action === "save"
            ? "No se pudo guardar en la nube. Intenta nuevamente."
            : "No se pudo cargar desde la nube. Intenta nuevamente.",
        type: "error",
        token: Date.now(),
      });
    } finally {
      setCloudActionInFlight(null);
    }
  }, [cloudDialogAction]);

  useEffect(() => {
    if (insertToastToken === null) return;
    const timeout = window.setTimeout(() => {
      setInsertToastToken(null);
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [insertToastToken]);

  useEffect(() => {
    if (!cloudToast) return;
    const timeout = window.setTimeout(() => {
      setCloudToast(null);
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [cloudToast?.token]);

  const cloudDialogCopy =
    cloudDialogAction === "save"
      ? {
          title: "Confirmar guardado en la nube",
          description:
            "Esta acción sobrescribirá el estado actual almacenado en la nube.",
          confirmLabel: "Guardar ahora",
        }
      : {
          title: "Confirmar carga desde la nube",
          description:
            "Esta acción reemplazará el estado local por la versión en la nube.",
          confirmLabel: "Cargar ahora",
        };

  return (
    <div className="app">
      <DiagramTopBar
        isAddMode={isAddMode}
        isSelectionMode={isSelectionMode}
        isOrganizationMode={isOrganizationMode}
        cloudActionInFlight={cloudActionInFlight}
        onToggleAddMode={() => setIsAddMode((current) => !current)}
        onCloudSave={handleCloudSave}
        onCloudLoad={handleCloudLoad}
      />
      <div className="diagram-workspace">
        <DiagramCanvas
          isSelectionMode={isSelectionMode}
          isOrganizationMode={isOrganizationMode}
          graph={graph}
          status={status}
          errorMessage={errorMessage}
          organizationSelection={confirmedSelection}
          organizationGateType={selectedGateType}
          organizationComponentId={formState.componentId}
          organizationCalculationType={formState.calculationType}
          onOrganizationStateChange={setOrganizationUiState}
          preselectedNodeId={selectionMeta.preselectedId}
          selectedNodeId={selectionMeta.selectedId}
          hoveredNodeId={selectionMeta.hoveredId}
          insertHighlight={insertHighlight}
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
              existingNodeIds={existingNodeIds}
              resetToken={formResetToken}
              searchState={componentSearch}
              onCancelAdd={() => setIsAddMode(false)}
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
      {cloudDialogAction ? (
        <div className="diagram-modal" role="dialog" aria-modal="true">
          <div className="diagram-modal__backdrop" />
          <div className="diagram-modal__content">
            <div>
              <p className="diagram-modal__eyebrow">Cloud</p>
              <h2 className="diagram-modal__title">{cloudDialogCopy.title}</h2>
              <p className="diagram-modal__description">
                {cloudDialogCopy.description}
              </p>
            </div>
            <div className="diagram-modal__actions">
              <button
                type="button"
                className="diagram-modal__button diagram-modal__button--ghost"
                onClick={() => setCloudDialogAction(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="diagram-modal__button"
                onClick={handleConfirmCloudAction}
                disabled={cloudActionInFlight !== null}
              >
                {cloudDialogCopy.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {cloudToast ? (
        <div
          key={cloudToast.token}
          className={`diagram-cloud-toast diagram-cloud-toast--${cloudToast.type}`}
          role="status"
          aria-live="polite"
        >
          {cloudToast.message}
        </div>
      ) : null}
      {insertToastToken !== null ? (
        <div
          key={insertToastToken}
          className="diagram-insert-toast"
          role="status"
          aria-live="polite"
        >
          Componente agregado correctamente
        </div>
      ) : null}
    </div>
  );
}

export default App;