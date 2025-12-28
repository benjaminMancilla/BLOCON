import { useCallback, useEffect, useMemo, useState } from "react";
import { DiagramCanvas } from "./features/diagram/components/DiagramCanvas";
import { DiagramSidePanel } from "./features/diagram/components/DiagramSidePanel";
import { DiagramTopBar } from "./features/diagram/components/DiagramTopBar";
import { CloudConfirmDialog } from "./features/diagram/components/CloudConfirmDialog";
import { CloudToast } from "./features/diagram/components/CloudToast";
import { AddComponentPanel } from "./features/diagram/components/AddComponentPanel";
import { DeleteActionButton } from "./features/diagram/components/DeleteActionButton";
import { DeleteConfirmDialog } from "./features/diagram/components/DeleteConfirmDialog";
import { EventDetailsPanel } from "./features/diagram/components/EventDetailsPanel";
import { DraftsMenu } from "./features/diagram/components/drafts/DraftsMenu";
import { RebuildConfirmDialog } from "./features/diagram/components/RebuildConfirmDialog";
import { VersionHistoryPanelContainer } from "./features/diagram/components/VersionHistoryPanelContainer";
import { useDiagramGraph } from "./features/diagram/hooks/useDiagramGraph";
import { useDiagramView } from "./features/diagram/hooks/useDiagramView";
import { useCloudActions } from "./features/diagram/hooks/useCloudActions";
import { useDeleteMode } from "./features/diagram/hooks/useDeleteMode";
import { useDrafts } from "./features/diagram/hooks/useDrafts";
import { useEventDetails } from "./features/diagram/hooks/useEventDetails";
import { useUndoRedo } from "./features/diagram/hooks/useUndoRedo";
import { useVersionViewer } from "./features/diagram/hooks/useVersionViewer";
import { useVersionHistoryPanel } from "./features/diagram/hooks/useVersionHistoryPanel";
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
import { insertOrganization } from "./services/graphService";
import { rebuildGraphAtVersion } from "./services/versionViewerService";

type AddComponentStep = "selection" | "gateType" | "organization";
type InsertHighlight = {
  token: number;
  componentId: string;
  targetGateId: string | null;
  hostComponentId: string | null;
  gateType: GateType | null;
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
  const [deleteToast, setDeleteToast] = useState<{
    token: number;
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [draftToast, setDraftToast] = useState<{
    token: number;
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [rebuildToast, setRebuildToast] = useState<{
    token: number;
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [rebuildDialog, setRebuildDialog] = useState<{
    version: number;
    step: 1 | 2;
  } | null>(null);
  const [isRebuildLoading, setIsRebuildLoading] = useState(false);
  const [recentlyInsertedComponentId, setRecentlyInsertedComponentId] =
    useState<string | null>(null);
  const versionHistoryPanel = useVersionHistoryPanel();
  const eventDetails = useEventDetails();
  const versionViewer = useVersionViewer();
  const isViewerMode = versionViewer.isActive;
  const { graph, status, errorMessage } = useDiagramGraph(graphReloadToken);
  const diagramView = useDiagramView(graph);
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

  const {
    cloudDialogAction,
    cloudActionInFlight,
    cloudToast,
    requestSave,
    requestLoad,
    confirmAction,
    cancelAction,
  } = useCloudActions({
    onLoadSuccess: () => setGraphReloadToken((current) => current + 1),
  });
  const {
    drafts,
    isLoading: draftsLoading,
    actionInFlight: draftActionInFlight,
    createDraft,
    saveDraft,
    loadDraft,
    renameDraft,
    deleteDraft,
  } = useDrafts();

  const deleteMode = useDeleteMode({
    isBlocked:
      isAddMode ||
      isOrganizationMode ||
      cloudActionInFlight !== null ||
      isViewerMode,
    onDeleteSuccess: (selection) => {
      const isGate =
        selection.type === "gate" || selection.type === "collapsedGate";
      setGraphReloadToken((current) => current + 1);
      setDeleteToast((current) => ({
        token: (current?.token ?? 0) + 1,
        message: isGate ? "Gate eliminada" : "Nodo eliminado",
        type: "success",
      }));
    },
    onDeleteError: (selection) => {
      const isGate =
        selection.type === "gate" || selection.type === "collapsedGate";
      setDeleteToast((current) => ({
        token: (current?.token ?? 0) + 1,
        message: isGate
          ? "No se pudo eliminar la gate"
          : "No se pudo eliminar el nodo",
        type: "error",
      }));
    },
  });

  useEffect(() => {
    if (!deleteMode.isDeleteMode) return;
    if (isAddMode) {
      setIsAddMode(false);
    }
  }, [deleteMode.isDeleteMode, isAddMode]);

  useEffect(() => {
    if (!isViewerMode) return;
    if (isAddMode) {
      setIsAddMode(false);
    }
    if (deleteMode.isDeleteMode) {
      deleteMode.onSelectionCancel();
    }
  }, [
    deleteMode.isDeleteMode,
    deleteMode.onSelectionCancel,
    isAddMode,
    isViewerMode,
  ]);

  useEffect(() => {
    if (insertToastToken === null) return;
    const timeout = window.setTimeout(() => {
      setInsertToastToken(null);
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [insertToastToken]);

  useEffect(() => {
    if (!deleteToast) return;
    const timeout = window.setTimeout(() => {
      setDeleteToast(null);
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [deleteToast]);

  useEffect(() => {
    if (!draftToast) return;
    const timeout = window.setTimeout(() => {
      setDraftToast(null);
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [draftToast?.token]);

  useEffect(() => {
    if (!rebuildToast) return;
    const timeout = window.setTimeout(() => {
      setRebuildToast(null);
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [rebuildToast?.token]);

  const isCloudBusy = cloudActionInFlight !== null;
  const isDraftBusy = draftActionInFlight !== null || isCloudBusy;
  const isVersionHistoryDisabled =
    isCloudBusy ||
    isAddMode ||
    deleteMode.isDeleteMode ||
    isSelectionMode ||
    isOrganizationMode;
  const cloudSaveState = {
    isBusy: cloudActionInFlight === "save",
    label: cloudActionInFlight === "save" ? "Guardando..." : "Guardar",
    disabled: isAddMode || isCloudBusy,
  };
  const cloudLoadState = {
    isBusy: cloudActionInFlight === "load",
    label: cloudActionInFlight === "load" ? "Cargando..." : "Cargar",
    disabled: isAddMode || isCloudBusy || isViewerMode,
  };
  const isDeleteDisabled =
    isAddMode || isOrganizationMode || isCloudBusy || isViewerMode;

  useUndoRedo({
    isBlocked:
      isCloudBusy ||
      deleteMode.isDeleteMode ||
      isSelectionMode ||
      isOrganizationMode ||
      isAddMode ||
      isViewerMode,
    onCompleted: () => setGraphReloadToken((current) => current + 1),
  });

  const handleDraftCreate = useCallback(
    async (name?: string) => {
      try {
        await createDraft(name);
        setDraftToast({
          token: Date.now(),
          message: "Borrador guardado correctamente.",
          type: "success",
        });
      } catch (error) {
        setDraftToast({
          token: Date.now(),
          message: "No se pudo guardar el borrador.",
          type: "error",
        });
      }
    },
    [createDraft],
  );

  const handleDraftSave = useCallback(
    async (draftId: string) => {
      try {
        await saveDraft(draftId);
        setDraftToast({
          token: Date.now(),
          message: "Borrador actualizado.",
          type: "success",
        });
      } catch (error) {
        setDraftToast({
          token: Date.now(),
          message: "No se pudo actualizar el borrador.",
          type: "error",
        });
      }
    },
    [saveDraft],
  );

  const handleDraftRename = useCallback(
    async (draftId: string, name: string) => {
      try {
        await renameDraft(draftId, name);
        setDraftToast({
          token: Date.now(),
          message: "Nombre del borrador actualizado.",
          type: "success",
        });
      } catch (error) {
        setDraftToast({
          token: Date.now(),
          message: "No se pudo renombrar el borrador.",
          type: "error",
        });
      }
    },
    [renameDraft],
  );

  const handleDraftDelete = useCallback(
    async (draftId: string) => {
      try {
        await deleteDraft(draftId);
        setDraftToast({
          token: Date.now(),
          message: "Borrador eliminado.",
          type: "success",
        });
      } catch (error) {
        setDraftToast({
          token: Date.now(),
          message: "No se pudo eliminar el borrador.",
          type: "error",
        });
      }
    },
    [deleteDraft],
  );

  const handleDraftLoad = useCallback(
    async (draftId: string) => {
      try {
        const result = await loadDraft(draftId);
        if (result.status === "ok") {
          setGraphReloadToken((current) => current + 1);
          setDraftToast({
            token: Date.now(),
            message: "Borrador cargado en el lienzo.",
            type: "success",
          });
        } else if (result.status === "conflict") {
          setDraftToast({
            token: Date.now(),
            message:
              "El borrador estaba desactualizado y se eliminó automáticamente.",
            type: "error",
          });
        } else {
          setDraftToast({
            token: Date.now(),
            message: "No se encontró el borrador solicitado.",
            type: "error",
          });
        }
      } catch (error) {
        setDraftToast({
          token: Date.now(),
          message: "No se pudo cargar el borrador.",
          type: "error",
        });
      }
    },
    [loadDraft],
  );

  const handleRebuildRequest = useCallback((version: number) => {
    setRebuildDialog({ version, step: 1 });
  }, []);

  const handleRebuildCancel = useCallback(() => {
    if (isRebuildLoading) return;
    setRebuildDialog(null);
  }, [isRebuildLoading]);

  const handleRebuildConfirm = useCallback(async () => {
    if (!rebuildDialog) return;
    if (rebuildDialog.step === 1) {
      setRebuildDialog((current) =>
        current ? { ...current, step: 2 } : current,
      );
      return;
    }
    setIsRebuildLoading(true);
    try {
      await rebuildGraphAtVersion(rebuildDialog.version);
      setGraphReloadToken((current) => current + 1);
      versionViewer.exitViewer();
      versionHistoryPanel.close();
      eventDetails.close();
      setRebuildToast({
        token: Date.now(),
        message: `Rebuild completado en v${rebuildDialog.version}.`,
        type: "success",
      });
    } catch (error) {
      setRebuildToast({
        token: Date.now(),
        message: "No se pudo completar el rebuild.",
        type: "error",
      });
    } finally {
      setIsRebuildLoading(false);
      setRebuildDialog(null);
    }
  }, [
    eventDetails,
    rebuildDialog,
    versionHistoryPanel,
    versionViewer,
  ]);

  const activeGraph = isViewerMode ? versionViewer.graph : graph;
  const activeStatus = isViewerMode ? versionViewer.status : status;
  const activeErrorMessage = isViewerMode
    ? versionViewer.errorMessage
    : errorMessage;
  const activeViewState = isViewerMode ? versionViewer.viewState : diagramView;
  const isSelectionModeActive = !isViewerMode && isSelectionMode;
  const isOrganizationModeActive = !isViewerMode && isOrganizationMode;
  const isDeleteModeActive = !isViewerMode && deleteMode.isDeleteMode;

  return (
    <div className="app">
      <DiagramTopBar
        isAddMode={isAddMode}
        isBlocked={
          isAddMode ||
          deleteMode.isDeleteMode ||
          versionHistoryPanel.isOpen ||
          isViewerMode
        }
        isAddDisabled={
          isSelectionMode ||
          isOrganizationMode ||
          isCloudBusy ||
          deleteMode.isDeleteMode ||
          versionHistoryPanel.isOpen ||
          isViewerMode
        }
        isDeleteMode={isDeleteModeActive}
        isDeleteDisabled={isDeleteDisabled || versionHistoryPanel.isOpen}
        isVersionHistoryOpen={versionHistoryPanel.isOpen}
        isVersionHistoryDisabled={
          isVersionHistoryDisabled && !versionHistoryPanel.isOpen
        }
        isViewerMode={isViewerMode}
        viewerVersion={versionViewer.version}
        skipDeleteConfirmation={deleteMode.skipConfirmForComponents}
        cloudSaveState={{
          ...cloudSaveState,
          disabled: cloudSaveState.disabled || versionHistoryPanel.isOpen,
        }}
        cloudLoadState={{
          ...cloudLoadState,
          disabled: cloudLoadState.disabled || versionHistoryPanel.isOpen,
        }}
        onToggleAddMode={() => setIsAddMode((current) => !current)}
        onToggleDeleteMode={deleteMode.toggleDeleteMode}
        onToggleVersionHistory={versionHistoryPanel.toggle}
        onSkipDeleteConfirmationChange={deleteMode.setSkipConfirmForComponents}
        onCloudSave={requestSave}
        onCloudLoad={requestLoad}
        onExitViewer={versionViewer.exitViewer}
        draftsMenu={
          isViewerMode ? null : (
          <DraftsMenu
            drafts={drafts}
            isLoading={draftsLoading}
            isBusy={isDraftBusy}
            disabled={
              isAddMode ||
              deleteMode.isDeleteMode ||
              isOrganizationMode ||
              isCloudBusy ||
              isSelectionMode ||
              versionHistoryPanel.isOpen
            }
            onCreateDraft={handleDraftCreate}
            onSaveDraft={handleDraftSave}
            onLoadDraft={handleDraftLoad}
            onRenameDraft={handleDraftRename}
            onDeleteDraft={handleDraftDelete}
          />
          )
        }
      />
      <div className="diagram-workspace">
        <EventDetailsPanel
          isOpen={eventDetails.isOpen}
          dependency={versionHistoryPanel.isOpen}
          event={eventDetails.event}
          version={eventDetails.version}
          payloadText={eventDetails.payloadText}
          onClose={eventDetails.close}
        />
        <DiagramCanvas
          isSelectionMode={isSelectionModeActive}
          isOrganizationMode={isOrganizationModeActive}
          isDeleteMode={isDeleteModeActive}
          viewState={activeViewState}
          graph={activeGraph}
          status={activeStatus}
          errorMessage={activeErrorMessage}
          organizationSelection={confirmedSelection}
          organizationGateType={selectedGateType}
          organizationComponentId={formState.componentId}
          organizationCalculationType={formState.calculationType}
          onOrganizationStateChange={setOrganizationUiState}
          preselectedNodeId={selectionMeta.preselectedId}
          selectedNodeId={selectionMeta.selectedId}
          hoveredNodeId={selectionMeta.hoveredId}
          deletePreselectedNodeId={deleteMode.draftSelection?.id ?? null}
          deleteSelectedNodeId={deleteMode.selectedSelection?.id ?? null}
          deleteHoveredNodeId={deleteMode.hoveredNodeId}
          insertHighlight={insertHighlight}
          onEnterSelectionMode={handleSelectionModeEnter}
          onExitSelectionMode={handleSelectionModeExit}
          onNodeHover={handleNodeHover}
          onNodePreselect={handleNodePreselect}
          onNodeConfirm={handleNodeConfirm}
          onSelectionUpdate={handleSelectionUpdate}
          onSelectionCancel={handleSelectionCancel}
          onDeleteNodeHover={deleteMode.onNodeHover}
          onDeleteNodePreselect={deleteMode.onNodePreselect}
          onDeleteNodeConfirm={deleteMode.onNodeConfirm}
          onDeleteSelectionCancel={deleteMode.onSelectionCancel}
          onOrganizationCancel={handleOrganizationCancel}
        />
        <DeleteActionButton
          isVisible={isDeleteModeActive}
          isDisabled={!deleteMode.selectedSelection || deleteMode.isDeleting}
          onClick={deleteMode.requestDelete}
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
        <VersionHistoryPanelContainer
          isOpen={versionHistoryPanel.isOpen}
          onClose={versionHistoryPanel.close}
          onViewDetails={eventDetails.open}
          onShowVersion={versionViewer.enterVersion}
          onRebuild={handleRebuildRequest}
        />
      </div>
      {cloudDialogAction ? (
        <CloudConfirmDialog
          action={cloudDialogAction}
          isLoading={cloudActionInFlight !== null}
          onConfirm={confirmAction}
          onCancel={cancelAction}
        />
      ) : null}
      {deleteMode.confirmSelection ? (
        <DeleteConfirmDialog
          selection={deleteMode.confirmSelection}
          isLoading={deleteMode.isDeleting}
          onConfirm={deleteMode.confirmDelete}
          onCancel={deleteMode.cancelDelete}
        />
      ) : null}
      {cloudToast ? (
        <CloudToast
          key={cloudToast.token}
          message={cloudToast.message}
          type={cloudToast.type}
        />
      ) : null}
      {draftToast ? (
        <CloudToast
          key={draftToast.token}
          message={draftToast.message}
          type={draftToast.type}
          className="diagram-draft-toast"
        />
      ) : null}
      {rebuildToast ? (
        <CloudToast
          key={rebuildToast.token}
          message={rebuildToast.message}
          type={rebuildToast.type}
          className="diagram-rebuild-toast"
        />
      ) : null}
      {deleteToast ? (
        <CloudToast
          key={deleteToast.token}
          message={deleteToast.message}
          type={deleteToast.type}
          className="diagram-delete-toast"
        />
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
      {rebuildDialog ? (
        <RebuildConfirmDialog
          version={rebuildDialog.version}
          step={rebuildDialog.step}
          isLoading={isRebuildLoading}
          onCancel={handleRebuildCancel}
          onConfirm={handleRebuildConfirm}
        />
      ) : null}
    </div>
  );
}

export default App;