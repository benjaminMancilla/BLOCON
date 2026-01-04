// Components
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DiagramCanvas } from "./features/diagram/components/DiagramCanvas";
import { DiagramSidePanel } from "./features/diagram/components/DiagramSidePanel";
import { DiagramTopBar } from "./features/diagram/components/DiagramTopBar";
import { CloudConfirmDialog } from "./features/diagram/components/CloudConfirmDialog";
import { CloudErrorModal } from "./features/diagram/components/CloudErrorModal";
import { AddComponentPanel } from "./features/diagram/components/AddComponentPanel";
import { DeleteActionButton } from "./features/diagram/components/DeleteActionButton";
import { DeleteConfirmDialog } from "./features/diagram/components/DeleteConfirmDialog";
import { EventDetailsPanel } from "./features/diagram/components/EventDetailsPanel";
import { NodeInfoPanel } from "./features/diagram/components/NodeInfoPanel";
import { DraftsMenu } from "./features/diagram/components/drafts/DraftsMenu";
import { ViewsMenu } from "./features/diagram/components/views/ViewsMenu";
import { RebuildConfirmDialog } from "./features/diagram/components/RebuildConfirmDialog";
import { VersionHistoryPanelContainer } from "./features/diagram/components/VersionHistoryPanelContainer";
import { ToastContainer } from "./features/diagram/components/ToastContainer";

// Hooks
import { useDiagramGraph } from "./features/diagram/hooks/useDiagramGraph";
import { useDiagramView } from "./features/diagram/hooks/useDiagramView";
import { useCloudActions } from "./features/diagram/hooks/useCloudActions";
import { useDeleteMode } from "./features/diagram/hooks/useDeleteMode";
import { useCloudErrorRecovery } from "./features/diagram/hooks/useCloudErrorRecovery";
import { useEventDetails } from "./features/diagram/hooks/useEventDetails";
import { useNodeInfoPanel } from "./features/diagram/hooks/useNodeInfoPanel";
import { useUndoRedo } from "./features/diagram/hooks/useUndoRedo";
import { useVersionViewer } from "./features/diagram/hooks/useVersionViewer";
import { useVersionHistoryPanel } from "./features/diagram/hooks/useVersionHistoryPanel";
import { useComponentSearch } from "./features/diagram/components/addComponent/hooks/useComponentSearch";
import { useAddComponent } from "./features/diagram/hooks/useAddComponent";
import { useRestrictions } from "./features/diagram/hooks/useRestrictions";
import { useOrganizationPayload } from "./features/diagram/hooks/useOrganizationPayload";
import {
  useToasts,
  useCloudToasts,
  useDeleteToasts,
  useInsertToast,
} from "./features/diagram/hooks/useToasts";

// Services
import { insertOrganization } from "./services/graphService";

// Types
import type { OrganizationUiState } from "./features/diagram/types/organization";
import type { GateType } from "./features/diagram/types/gates";

// Handlers
import { useDraftHandlers } from "./features/diagram/hooks/useDraftHandlers";
import { useViewHandlers } from "./features/diagram/hooks/useViewHandlers";
import { useRebuildFlow } from "./features/diagram/hooks/useRebuildFlow";
import { useEvaluateFlow } from "./features/diagram/hooks/useEvaluateFlow";
import { useFailuresReloadFlow } from "./features/diagram/hooks/useFailuresReloadFlow";

const ENTER_DEBOUNCE_MS = 650;
const MIN_QUERY_LEN = 2;

type InsertHighlight = {
  token: number;
  componentId: string;
  targetGateId: string | null;
  hostComponentId: string | null;
  gateType: GateType | null;
};

function App() {
  // CORE STATE
  const [graphReloadToken, setGraphReloadToken] = useState(0);
  const [organizationUiState, setOrganizationUiState] =
    useState<OrganizationUiState | null>(null);
  const [insertHighlight, setInsertHighlight] =
    useState<InsertHighlight | null>(null);
  const insertHighlightTokenRef = useRef(0);
  const [recentlyInsertedComponentId, setRecentlyInsertedComponentId] =
    useState<string | null>(null);

  const reloadGraph = useCallback(() => {
    setGraphReloadToken((c) => c + 1);
  }, []);

  // FEATURE HOOKS
  const { graph, status, errorMessage } = useDiagramGraph(graphReloadToken);
  const diagramView = useDiagramView(graph);
  const versionHistoryPanel = useVersionHistoryPanel();
  const eventDetails = useEventDetails();
  const nodeInfoPanel = useNodeInfoPanel();
  const versionViewer = useVersionViewer();

  const existingNodeIds = useMemo(
    () => new Set(graph.nodes.map((node) => node.id)),
    [graph.nodes]
  );

  const pinnedExistingIds = useMemo(() => {
    if (!recentlyInsertedComponentId) return undefined;
    return new Set([recentlyInsertedComponentId]);
  }, [recentlyInsertedComponentId]);

  // Toast system
  const toasts = useToasts();
  const cloudToasts = useCloudToasts(toasts);
  const deleteToasts = useDeleteToasts(toasts);
  const insertToast = useInsertToast(toasts);

  // Rebuild flow
  const rebuildFlow = useRebuildFlow({
    toasts,
    versionViewer,
    versionHistoryPanel,
    eventDetails,
    onGraphReload: reloadGraph,
  });

  // Add Component with state machine
  const addComponent = useAddComponent({
    onInsertSuccess: (componentId) => {
      setGraphReloadToken((c) => c + 1);
      setRecentlyInsertedComponentId(componentId);
      insertToast.showInsertSuccess();
    },
  });

  const componentSearch = useComponentSearch({
    minQueryLength: MIN_QUERY_LEN,
    debounceMs: ENTER_DEBOUNCE_MS,
    existingIds: existingNodeIds,
    alwaysVisibleIds: pinnedExistingIds,
  });

  // Organization payload builder
  const organizationPayload = useOrganizationPayload({
    isActive: addComponent.flags.isOrganizing,
    organizationUiState,
    confirmedSelection: addComponent.target,
    selectedGateType: addComponent.gateType,
    formState: addComponent.formState,
  });

  // Cloud actions
  const cloudActions = useCloudActions({
    onLoadSuccess: () => setGraphReloadToken((c) => c + 1),
    toasts: cloudToasts,
  });

  // Evaluate flow
  const evaluateFlow = useEvaluateFlow({
    toasts,
    onGraphReload: reloadGraph,
    onViewRefresh: async () => await diagramView.refresh(),
  });

  const failuresReloadFlow = useFailuresReloadFlow({
    toasts,
    onGraphReload: reloadGraph,
    onViewRefresh: async () => await diagramView.refresh(),
  });

  // Draft handlers
  const draftHandlers = useDraftHandlers({
    toasts,
    onGraphReload: reloadGraph,
  });

  // View handlers
  const viewHandlers = useViewHandlers({
    toasts,
    onViewRefresh: async () => {
      await diagramView.refresh();
    },
  });

  // Cloud error recovery
  const cloudErrorRecovery = useCloudErrorRecovery({
    onRetrySuccess: async () => {
      reloadGraph();
      await diagramView.refresh();
      await draftHandlers.refreshDrafts();
      await viewHandlers.refreshViews();
    },
  });

  // Delete mode
  const deleteMode = useDeleteMode({
    isBlocked: false, // Manejado por el sistema de restricciones
    onDeleteSuccess: (selection) => {
      setGraphReloadToken((c) => c + 1);
      const isGate =
        selection.type === "gate" || selection.type === "collapsedGate";
      if (isGate) {
        deleteToasts.showGateDeleteSuccess();
      } else {
        deleteToasts.showNodeDeleteSuccess();
      }
    },
    onDeleteError: (selection) => {
      const isGate =
        selection.type === "gate" || selection.type === "collapsedGate";
      if (isGate) {
        deleteToasts.showGateDeleteError();
      } else {
        deleteToasts.showNodeDeleteError();
      }
    },
  });

  // RESTRICTIONS SYSTEM
  const restrictions = useRestrictions({
    isAddMode: addComponent.flags.isActive,
    isDeleteMode: deleteMode.isDeleteMode,
    isViewerMode: versionViewer.isActive,
    isOrganizationMode: addComponent.flags.isOrganizing,
    isSelectionMode: addComponent.flags.isSelectingTarget,
    isCloudBusy: cloudActions.cloudActionInFlight !== null,
    isEvaluationBusy: evaluateFlow.isLoading,
    isFailuresReloadBusy: failuresReloadFlow.isLoading,
    isDraftBusy: draftHandlers.actionInFlight !== null,
    isViewBusy: viewHandlers.actionInFlight !== null,
    isRebuildInProgress: rebuildFlow.isLoading,
    isCloudRecoveryActive:
      cloudErrorRecovery.isModalOpen ||
      cloudErrorRecovery.actionLoading !== null,
    isVersionHistoryOpen: versionHistoryPanel.isOpen,
    isEventDetailsOpen: eventDetails.isOpen,
    isNodeInfoOpen: nodeInfoPanel.isOpen,
  });

  // UNDO/REDO
  useUndoRedo({
    isBlocked: !restrictions.canUndoRedo,
    onCompleted: () => setGraphReloadToken((c) => c + 1),
  });

  // INSERT VALIDATION & EXECUTION
  const insertValidators = useMemo(
    () => [
      {
        id: "unique-component",
        validate: (payload: any) => {
          const componentId = payload.insert.componentId;
          if (!componentId) return false;
          return !existingNodeIds.has(componentId);
        },
      },
    ],
    [existingNodeIds]
  );

  const runInsertValidations = useCallback(
    (payload: any) =>
      insertValidators.every((validator) => validator.validate(payload)),
    [insertValidators]
  );

  const handleInsert = useCallback(async () => {
    if (!organizationPayload.payload || !organizationPayload.isValid) return;
    if (!runInsertValidations(organizationPayload.payload)) return;

    const payload = organizationPayload.payload;
    const insertTarget = payload.insert.target;
    const insertMeta = {
      componentId: payload.insert.componentId!,
      targetGateId:
        insertTarget?.hostType === "gate" ? insertTarget.hostId : null,
      hostComponentId:
        insertTarget?.hostType === "component" ? insertTarget.hostId : null,
      gateType: insertTarget?.relationType ?? null,
    };

    try {
      await insertOrganization(payload);
      await addComponent.confirmInsert(payload);
      
      // Set insert highlight
      insertHighlightTokenRef.current += 1;
      setInsertHighlight({
        ...insertMeta,
        token: insertHighlightTokenRef.current,
      });
      
      // Reset organization state
      setOrganizationUiState(null);
    } catch (error) {
      console.error("Insert failed:", error);
      toasts.error("No se pudo insertar el componente", "insert");
    }
  }, [
    organizationPayload.payload,
    organizationPayload.isValid,
    runInsertValidations,
    addComponent,
    toasts,
  ]);

  // AUTO-DISMISS EFFECTS
  
  // Auto-clear insert highlight after animation
  useEffect(() => {
    if (!insertHighlight) return;
    const timeout = window.setTimeout(() => {
      setInsertHighlight(null);
    }, 2600);
    return () => window.clearTimeout(timeout);
  }, [insertHighlight?.token]);

  // CROSS-MODE INTERACTIONS
  
  // Si entramos en delete mode, salir de add mode
  useEffect(() => {
    if (!deleteMode.isDeleteMode) return;
    if (addComponent.flags.isActive) {
      addComponent.cancel();
    }
  }, [deleteMode.isDeleteMode, addComponent]);

  // Si entramos en viewer mode, salir de todos los modos
  useEffect(() => {
    if (!versionViewer.isActive) return;
    if (addComponent.flags.isActive) {
      addComponent.cancel();
    }
    if (deleteMode.isDeleteMode) {
      deleteMode.onSelectionCancel();
    }
  }, [versionViewer.isActive, addComponent, deleteMode]);

  // DERIVED STATE FOR RENDER
  const activeGraph = versionViewer.isActive ? versionViewer.graph : graph;
  const activeStatus = versionViewer.isActive ? versionViewer.status : status;
  const activeErrorMessage = versionViewer.isActive
    ? versionViewer.errorMessage
    : errorMessage;
  const activeViewState = versionViewer.isActive
    ? versionViewer.viewState
    : diagramView;

  // Determine current step for AddComponentPanel
  const addComponentStep = 
    addComponent.state.type === "searchingComponent" ||
    addComponent.state.type === "componentSelected" ||
    addComponent.state.type === "selectingTarget"
      ? "selection"
      : addComponent.state.type === "choosingGate"
        ? "gateType"
        : "organization";

  const selectionStatus =
    addComponent.flags.isSelectingTarget
      ? "selecting"
      : addComponent.target
        ? "selected"
        : "idle";

  // RENDER
  return (
    <div className="app">
      <DiagramTopBar
        isAddMode={addComponent.flags.isActive}
        isBlocked={!restrictions.canEnterAddMode && !addComponent.flags.isActive}
        isAddDisabled={!restrictions.canEnterAddMode}
        isDeleteMode={deleteMode.isDeleteMode}
        isDeleteDisabled={!restrictions.canEnterDeleteMode}
        isVersionHistoryOpen={versionHistoryPanel.isOpen}
        isVersionHistoryDisabled={!restrictions.canOpenVersionHistory}
        isViewerMode={versionViewer.isActive}
        viewerVersion={versionViewer.version}
        skipDeleteConfirmation={deleteMode.skipConfirmForComponents}
        cloudSaveState={{
          isBusy: cloudActions.cloudActionInFlight === "save",
          label:
            cloudActions.cloudActionInFlight === "save"
              ? "Guardando..."
              : "Guardar",
          disabled: !restrictions.canSaveToCloud,
        }}
        cloudLoadState={{
          isBusy: cloudActions.cloudActionInFlight === "load",
          label:
            cloudActions.cloudActionInFlight === "load"
              ? "Cargando..."
              : "Cargar",
          disabled: !restrictions.canLoadFromCloud,
        }}
        evaluateState={{
          isBusy: evaluateFlow.isLoading,
          disabled: !restrictions.canEvaluate,
          label: evaluateFlow.isLoading ? "Evaluando..." : "Evaluar",
        }}
        failuresReloadState={{
          isBusy: failuresReloadFlow.isLoading,
          disabled: !restrictions.canReloadFailures,
          label: failuresReloadFlow.isLoading
            ? "Recargando..."
            : "Recargar fallas",
        }}
        onEvaluate={evaluateFlow.evaluate}
        onReloadFailures={failuresReloadFlow.reload}
        onToggleAddMode={
          addComponent.flags.isActive ? addComponent.cancel : addComponent.start
        }
        onToggleDeleteMode={deleteMode.toggleDeleteMode}
        onToggleVersionHistory={versionHistoryPanel.toggle}
        onSkipDeleteConfirmationChange={deleteMode.setSkipConfirmForComponents}
        onCloudSave={cloudActions.requestSave}
        viewsMenu={
          versionViewer.isActive ? null : (
            <ViewsMenu
              views={viewHandlers.views}
              isLoading={viewHandlers.isLoading}
              isBusy={
                cloudActions.cloudActionInFlight !== null ||
                !restrictions.canCreateView
              }
              disabled={
                cloudActions.cloudActionInFlight !== null ||
                !restrictions.canCreateView
              }
              onCreateView={viewHandlers.handleCreate}
              onSaveView={viewHandlers.handleSave}
              onLoadView={viewHandlers.handleLoad}
              onRenameView={viewHandlers.handleRename}
              onDeleteView={viewHandlers.handleDelete}
            />
          )
        }
        onCloudLoad={cloudActions.requestLoad}
        onExitViewer={versionViewer.exitViewer}
        draftsMenu={
          versionViewer.isActive ? null : (
            <DraftsMenu
              drafts={draftHandlers.drafts}
              isLoading={draftHandlers.isLoading}
              isBusy={
                cloudActions.cloudActionInFlight !== null ||
                !restrictions.canCreateDraft
              }
              disabled={
                cloudActions.cloudActionInFlight !== null ||
                !restrictions.canCreateDraft
              }
              onCreateDraft={draftHandlers.handleCreate}
              onSaveDraft={draftHandlers.handleSave}
              onLoadDraft={draftHandlers.handleLoad}
              onRenameDraft={draftHandlers.handleRename}
              onDeleteDraft={draftHandlers.handleDelete}
            />
          )
        }
      />
      <div className="diagram-workspace">
        <NodeInfoPanel
          isOpen={nodeInfoPanel.isOpen}
          dependency={!eventDetails.isOpen}
          loading={nodeInfoPanel.loading}
          error={nodeInfoPanel.error}
          data={nodeInfoPanel.data}
          onClose={nodeInfoPanel.close}
        />
        <EventDetailsPanel
          isOpen={eventDetails.isOpen}
          dependency={versionHistoryPanel.isOpen}
          event={eventDetails.event}
          version={eventDetails.version}
          payloadText={eventDetails.payloadText}
          onClose={eventDetails.close}
        />
        <DiagramCanvas
          isSelectionMode={addComponent.flags.isSelectingTarget}
          isOrganizationMode={addComponent.flags.isOrganizing}
          isDeleteMode={deleteMode.isDeleteMode}
          viewState={activeViewState}
          graph={activeGraph}
          status={activeStatus}
          errorMessage={activeErrorMessage}
          organizationSelection={addComponent.target}
          organizationGateType={addComponent.gateType}
          organizationComponentId={addComponent.formState.componentId}
          organizationCalculationType={addComponent.formState.calculationType}
          onOrganizationStateChange={setOrganizationUiState}
          preselectedNodeId={addComponent.draftSelection?.id ?? null}
          selectedNodeId={addComponent.target?.id ?? null}
          hoveredNodeId={addComponent.hoveredNodeId}
          deletePreselectedNodeId={deleteMode.draftSelection?.id ?? null}
          deleteSelectedNodeId={deleteMode.selectedSelection?.id ?? null}
          deleteHoveredNodeId={deleteMode.hoveredNodeId}
          insertHighlight={insertHighlight}
          onNodeHover={addComponent.handleNodeHover}
          onNodePreselect={addComponent.handleNodePreselect}
          onNodeConfirm={addComponent.handleNodeConfirm}
          onSelectionUpdate={(selection) => {
            // El canvas puede actualizar la selección (ej: cuando cambia de gate a collapsed)
            if (addComponent.target?.id !== selection.id) return;
            addComponent.selectTarget(selection);
          }}
          onSelectionCancel={addComponent.cancelTarget}
          onDeleteNodeHover={deleteMode.onNodeHover}
          onDeleteNodePreselect={deleteMode.onNodePreselect}
          onDeleteNodeConfirm={deleteMode.onNodeConfirm}
          onDeleteSelectionCancel={deleteMode.onSelectionCancel}
          onOrganizationCancel={addComponent.cancelOrganization}
          canOpenNodeContextMenu={restrictions.canOpenNodeContextMenu}
          onNodeInfoOpen={nodeInfoPanel.open}
        />
        <DeleteActionButton
          isVisible={deleteMode.isDeleteMode}
          isDisabled={!deleteMode.selectedSelection || deleteMode.isDeleting}
          onClick={deleteMode.requestDelete}
        />
        {addComponent.flags.isActive ? (
          <DiagramSidePanel>
            <AddComponentPanel
              step={addComponentStep}
              selectionStatus={selectionStatus}
              draftSelection={addComponent.draftSelection}
              confirmedSelection={addComponent.target}
              gateType={addComponent.gateType}
              isOrganizing={addComponent.flags.isOrganizing}
              formState={addComponent.formState}
              existingNodeIds={existingNodeIds}
              searchState={componentSearch}
              resetToken={addComponent.resetToken}
              onCancelAdd={addComponent.cancel}
              onComponentSelect={addComponent.selectComponent}
              onSelectionConfirm={addComponent.selectTarget}
              onSelectionCancel={addComponent.cancelTarget}
              onSelectionCleared={addComponent.clearTarget}
              onSelectionStart={addComponent.startTargetSelection}
              onGateTypeChange={addComponent.selectGate}
              onSelectionReset={addComponent.clearComponent}
              onFormStateChange={addComponent.setFormState}
              onOrganizationStart={addComponent.startOrganization}
              onOrganizationCancel={addComponent.cancelOrganization}
              onInsert={handleInsert}
            />
          </DiagramSidePanel>
        ) : null}
        <VersionHistoryPanelContainer
          isOpen={versionHistoryPanel.isOpen}
          onClose={versionHistoryPanel.close}
          onViewDetails={eventDetails.open}
          onShowVersion={(version) =>
            versionViewer.enterVersion(version, diagramView.getViewSnapshot())
          }
          onRebuild={rebuildFlow.requestRebuild}
        />
      </div>

      {/* Cloud Error Modal */}
      <CloudErrorModal
        open={cloudErrorRecovery.isModalOpen}
        error={cloudErrorRecovery.cloudError}
        loading={cloudErrorRecovery.actionLoading}
        actionError={cloudErrorRecovery.actionError}
        onCancel={cloudErrorRecovery.cancel}
        onRetry={cloudErrorRecovery.retry}
      />

      {/* Cloud Confirm Dialog */}
      {cloudActions.cloudDialogAction ? (
        <CloudConfirmDialog
          action={cloudActions.cloudDialogAction}
          isLoading={cloudActions.cloudActionInFlight !== null}
          onConfirm={cloudActions.confirmAction}
          onCancel={cloudActions.cancelAction}
        />
      ) : null}

      {/* Delete Confirm Dialog */}
      {deleteMode.confirmSelection ? (
        <DeleteConfirmDialog
          selection={deleteMode.confirmSelection}
          isLoading={deleteMode.isDeleting}
          onConfirm={deleteMode.confirmDelete}
          onCancel={deleteMode.cancelDelete}
        />
      ) : null}

      {/* Rebuild Confirm Dialog */}
      {rebuildFlow.dialog && (
        <RebuildConfirmDialog
          version={rebuildFlow.dialog.version}
          step={rebuildFlow.dialog.step}
          isLoading={rebuildFlow.isLoading}
          onCancel={rebuildFlow.cancel}
          onConfirm={rebuildFlow.confirm}
        />
      )}

      {/* Toasts - Sistema Unificado */}
      <ToastContainer toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </div>
  );
}

export default App;