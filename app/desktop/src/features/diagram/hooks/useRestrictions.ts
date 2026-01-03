// features/diagram/hooks/useRestrictions.ts
import { useMemo } from "react";

/**
 * Sistema centralizado para manejar restricciones de UI
 * Fuente única de verdad para saber qué acciones están bloqueadas
 */

type RestrictionInputs = {
  // Modos activos
  isAddMode: boolean;
  isDeleteMode: boolean;
  isViewerMode: boolean;
  isOrganizationMode: boolean;
  isSelectionMode: boolean;
  
  // Acciones en progreso
  isCloudBusy: boolean;
  isEvaluationBusy: boolean;
  isDraftBusy: boolean;
  isViewBusy: boolean;
  isRebuildInProgress: boolean;
  
  // Estados de recovery/error
  isCloudRecoveryActive: boolean;
  
  // Paneles abiertos
  isVersionHistoryOpen: boolean;
  isEventDetailsOpen: boolean;
};

export type Restrictions = {
  // Feature toggles
  canEnterAddMode: boolean;
  canEnterDeleteMode: boolean;
  canEnterViewerMode: boolean;
  
  // Cloud actions
  canSaveToCloud: boolean;
  canLoadFromCloud: boolean;

  // Evaluation
  canEvaluate: boolean;
  
  // Version history
  canOpenVersionHistory: boolean;
  canViewVersion: boolean;
  canRebuildAtVersion: boolean;
  
  // Drafts
  canCreateDraft: boolean;
  canLoadDraft: boolean;
  canSaveDraft: boolean;

  // Views
  canCreateView: boolean;
  canLoadView: boolean;
  canSaveView: boolean;
  
  // Undo/Redo
  canUndoRedo: boolean;
  
  // Canvas interactions
  canSelectNodes: boolean;
  canDragNodes: boolean;
  canCollapseGates: boolean;
  
  // Reasons (para debugging y UX)
  blockingReasons: string[];
};

export function useRestrictions(inputs: RestrictionInputs): Restrictions {
  return useMemo(() => {
    const reasons: string[] = [];
    
    // Helper para agregar bloqueos
    const blocked = (reason: string) => {
      reasons.push(reason);
      return false;
    };
    
    // Blocking conditions (ordenadas por prioridad)
    const isInCriticalError = inputs.isCloudRecoveryActive;
    const isInAsyncOperation =
      inputs.isCloudBusy ||
      inputs.isEvaluationBusy ||
      inputs.isDraftBusy ||
      inputs.isViewBusy ||
      inputs.isRebuildInProgress;
    const isInExclusiveMode = inputs.isViewerMode;
    const isInEditMode = inputs.isAddMode || inputs.isDeleteMode || inputs.isOrganizationMode || inputs.isSelectionMode;
    const hasOpenPanels = inputs.isVersionHistoryOpen || inputs.isEventDetailsOpen;
    
    // Add Mode
    const canEnterAddMode = 
      isInCriticalError ? blocked("Error crítico activo") :
      isInAsyncOperation ? blocked("Operación en progreso") :
      isInExclusiveMode ? blocked("Modo exclusivo activo") :
      inputs.isDeleteMode ? blocked("Modo borrar activo") :
      hasOpenPanels ? blocked("Panel abierto") :
      true;
    
    // Delete Mode
    const canEnterDeleteMode =
      isInCriticalError ? blocked("Error crítico activo") :
      isInAsyncOperation ? blocked("Operación en progreso") :
      isInExclusiveMode ? blocked("Modo exclusivo activo") :
      inputs.isAddMode ? blocked("Modo agregar activo") :
      hasOpenPanels ? blocked("Panel abierto") :
      true;
    
    // Cloud Save
    const canSaveToCloud =
      isInCriticalError ? blocked("Error crítico activo") :
      isInAsyncOperation ? blocked("Operación en progreso") :
      isInExclusiveMode ? blocked("Modo visor activo") :
      isInEditMode ? blocked("Modo de edición activo") :
      hasOpenPanels ? blocked("Panel abierto") :
      true;
    
    // Cloud Load (same as save)
    const canLoadFromCloud = canSaveToCloud;

    // Evaluation
    const canEvaluate =
      isInCriticalError ? blocked("Error crítico activo") :
      isInAsyncOperation ? blocked("Operación en progreso") :
      isInExclusiveMode ? blocked("Modo visor activo") :
      isInEditMode ? blocked("Modo de edición activo") :
      hasOpenPanels ? blocked("Panel abierto") :
      true;

    // Version History
    const canOpenVersionHistory =
      inputs.isCloudBusy ? blocked("Operación en progreso") :
      inputs.isAddMode ? blocked("Modo agregar activo") :
      inputs.isDeleteMode ? blocked("Modo borrar activo") :
      inputs.isRebuildInProgress ? blocked("Rebuild en progreso") :
      true;
    
    // Undo/Redo
    const canUndoRedo =
      isInCriticalError ? blocked("Error crítico activo") :
      isInAsyncOperation ? blocked("Operación en progreso") :
      isInExclusiveMode ? blocked("Modo visor activo") :
      isInEditMode ? blocked("Modo de edición activo") :
      true;
    
    // Drafts
    const canCreateDraft =
      isInCriticalError ? blocked("Error crítico activo") :
      inputs.isDraftBusy ? blocked("Operación de borrador en progreso") :
      isInExclusiveMode ? blocked("Modo visor activo") :
      isInEditMode ? blocked("Modo de edición activo") :
      hasOpenPanels ? blocked("Panel abierto") :
      true;
    
    const canLoadDraft = canCreateDraft;
    const canSaveDraft = canCreateDraft;

        // Views
    const canCreateView =
      isInCriticalError ? blocked("Error crítico activo") :
      inputs.isViewBusy ? blocked("Operación de vista en progreso") :
      isInExclusiveMode ? blocked("Modo visor activo") :
      isInEditMode ? blocked("Modo de edición activo") :
      hasOpenPanels ? blocked("Panel abierto") :
      true;

    const canLoadView = canCreateView;
    const canSaveView = canCreateView;

    // Canvas interactions
    const canSelectNodes = !isInCriticalError;
    const canDragNodes = inputs.isOrganizationMode && !isInCriticalError;
    const canCollapseGates = !inputs.isOrganizationMode && !isInCriticalError;
    
    return {
      canEnterAddMode,
      canEnterDeleteMode,
      canEnterViewerMode: !isInEditMode,
      canSaveToCloud,
      canLoadFromCloud,
      canEvaluate,
      canOpenVersionHistory,
      canViewVersion: true,
      canRebuildAtVersion: !isInAsyncOperation,
      canCreateDraft,
      canLoadDraft,
      canSaveDraft,
      canCreateView,
      canLoadView,
      canSaveView,
      canUndoRedo,
      canSelectNodes,
      canDragNodes,
      canCollapseGates,
      blockingReasons: reasons,
    };
  }, [inputs]);
}

// Helper hook para usar con componentes específicos
export function useFeatureRestriction(
  restrictions: Restrictions,
  feature: keyof Omit<Restrictions, "blockingReasons">
) {
  return {
    allowed: restrictions[feature],
    reasons: restrictions.blockingReasons,
  };
}