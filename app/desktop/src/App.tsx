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
import { DraftsMenu } from "./features/diagram/components/drafts/DraftsMenu";
import { RebuildConfirmDialog } from "./features/diagram/components/RebuildConfirmDialog";
import { VersionHistoryPanelContainer } from "./features/diagram/components/VersionHistoryPanelContainer";
import { ToastContainer } from "./features/diagram/components/ToastContainer";

// Hooks
import { useDiagramGraph } from "./features/diagram/hooks/useDiagramGraph";
import { useDiagramView } from "./features/diagram/hooks/useDiagramView";
import { useCloudActions } from "./features/diagram/hooks/useCloudActions";
import { useDeleteMode } from "./features/diagram/hooks/useDeleteMode";
import { useCloudErrorRecovery } from "./features/diagram/hooks/useCloudErrorRecovery";
import { useDrafts } from "./features/diagram/hooks/useDrafts";
import { useEventDetails } from "./features/diagram/hooks/useEventDetails";
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
  useDraftToasts,
  useDeleteToasts,
  useInsertToast,
} from "./features/diagram/hooks/useToasts";

// Services
import { insertOrganization, loadCloudGraph } from "./services/graphService";
import { rebuildGraphAtVersion } from "./services/versionViewerService";
import { isRetryableCloudError } from "./services/apiClient";

// Types
import type { OrganizationUiState } from "./features/diagram/types/organization";
import type { GateType } from "./features/diagram/types/gates";

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
  const [rebuildDialog, setRebuildDialog] = useState<{
    version: number;
    step: 1 | 2;
  } | null>(null);
  const [isRebuildLoading, setIsRebuildLoading] = useState(false);
  const [recentlyInsertedComponentId, setRecentlyInsertedComponentId] =
    useState<string | null>(null);

  // FEATURE HOOKS
  const { graph, status, errorMessage } = useDiagramGraph(graphReloadToken);
  const diagramView = useDiagramView(graph);
  const versionHistoryPanel = useVersionHistoryPanel();
  const eventDetails = useEventDetails();
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
  const draftToasts = useDraftToasts(toasts);
  const deleteToasts = useDeleteToasts(toasts);
  const insertToast = useInsertToast(toasts);

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

  // Drafts
  const drafts = useDrafts();

  // Cloud error recovery
  const cloudErrorRecovery = useCloudErrorRecovery({
    onRetrySuccess: () => {
      setGraphReloadToken((c) => c + 1);
      void diagramView.refresh();
      void drafts.refreshDrafts();
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
    isDraftBusy: drafts.actionInFlight !== null,
    isRebuildInProgress: isRebuildLoading,
    isCloudRecoveryActive:
      cloudErrorRecovery.isModalOpen ||
      cloudErrorRecovery.actionLoading !== null,
    isVersionHistoryOpen: versionHistoryPanel.isOpen,
    isEventDetailsOpen: eventDetails.isOpen,
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

  // DRAFT HANDLERS
  const handleDraftCreate = useCallback(
    async (name?: string) => {
      try {
        await drafts.createDraft(name);
        draftToasts.showCreateSuccess();
      } catch {
        draftToasts.showCreateError();
      }
    },
    [drafts, draftToasts]
  );

  const handleDraftSave = useCallback(
    async (draftId: string) => {
      try {
        await drafts.saveDraft(draftId);
        draftToasts.showSaveSuccess();
      } catch {
        draftToasts.showSaveError();
      }
    },
    [drafts, draftToasts]
  );

  const handleDraftLoad = useCallback(
    async (draftId: string) => {
      try {
        const result = await drafts.loadDraft(draftId);
        if (result.status === "ok") {
          setGraphReloadToken((c) => c + 1);
          draftToasts.showLoadSuccess();
        } else if (result.status === "conflict") {
          draftToasts.showLoadConflict();
        } else {
          draftToasts.showLoadNotFound();
        }
      } catch {
        draftToasts.showLoadError();
      }
    },
    [drafts, draftToasts]
  );

  const handleDraftRename = useCallback(
    async (draftId: string, name: string) => {
      try {
        await drafts.renameDraft(draftId, name);
        draftToasts.showRenameSuccess();
      } catch {
        draftToasts.showRenameError();
      }
    },
    [drafts, draftToasts]
  );

  const handleDraftDelete = useCallback(
    async (draftId: string) => {
      try {
        await drafts.deleteDraft(draftId);
        draftToasts.showDeleteSuccess();
      } catch {
        draftToasts.showDeleteError();
      }
    },
    [drafts, draftToasts]
  );

  // REBUILD HANDLERS
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
        current ? { ...current, step: 2 } : current
      );
      return;
    }
    setIsRebuildLoading(true);
    try {
      await rebuildGraphAtVersion(rebuildDialog.version);
      await loadCloudGraph();
      setGraphReloadToken((c) => c + 1);
      versionViewer.exitViewer();
      versionHistoryPanel.close();
      eventDetails.close();
      toasts.success(
        `Rebuild completado en v${rebuildDialog.version}.`,
        "rebuild"
      );
    } catch (error) {
      if (isRetryableCloudError(error)) {
        return;
      }
      toasts.error("No se pudo completar el rebuild.", "rebuild");
    } finally {
      setIsRebuildLoading(false);
      setRebuildDialog(null);
    }
  }, [rebuildDialog, versionViewer, versionHistoryPanel, eventDetails, toasts]);

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
        onToggleAddMode={
          addComponent.flags.isActive ? addComponent.cancel : addComponent.start
        }
        onToggleDeleteMode={deleteMode.toggleDeleteMode}
        onToggleVersionHistory={versionHistoryPanel.toggle}
        onSkipDeleteConfirmationChange={deleteMode.setSkipConfirmForComponents}
        onCloudSave={cloudActions.requestSave}
        onCloudLoad={cloudActions.requestLoad}
        onExitViewer={versionViewer.exitViewer}
        draftsMenu={
          versionViewer.isActive ? null : (
            <DraftsMenu
              drafts={drafts.drafts}
              isLoading={drafts.isLoading}
              isBusy={
                cloudActions.cloudActionInFlight !== null ||
                !restrictions.canCreateDraft
              }
              disabled={
                cloudActions.cloudActionInFlight !== null ||
                !restrictions.canCreateDraft
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
          onRebuild={handleRebuildRequest}
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
      {rebuildDialog ? (
        <RebuildConfirmDialog
          version={rebuildDialog.version}
          step={rebuildDialog.step}
          isLoading={isRebuildLoading}
          onCancel={handleRebuildCancel}
          onConfirm={handleRebuildConfirm}
        />
      ) : null}

      {/* Toasts - Sistema Unificado */}
      <ToastContainer toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </div>
  );
}

export default App;