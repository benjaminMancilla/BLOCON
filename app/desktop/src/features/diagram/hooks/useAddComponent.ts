// features/diagram/hooks/useAddComponent.ts
import { useCallback, useReducer, useState } from "react";
import type { DiagramNodeSelection } from "../types/selection";
import type { GateType } from "../types/gates";
import type { AddComponentFormState } from "../types/addComponent";
import {
  addComponentReducer,
  deriveFlags,
  type AddComponentState,
  type AddComponentEvent,
  type AddComponentContext,
} from "../machines/AddComponentMachine";

type UseAddComponentOptions = {
  onInsertSuccess?: (componentId: string) => void;
  onInsertError?: (error: unknown) => void;
};

export function useAddComponent(options: UseAddComponentOptions = {}) {
  // Estado adicional (UI concerns)
  const [formState, setFormState] = useState<AddComponentFormState>({
    componentId: null,
    calculationType: "exponential",
  });
  const [draftSelection, setDraftSelection] = useState<DiagramNodeSelection | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Wrapper del reducer para que sea compatible con useReducer de React
  const reactReducer = useCallback(
    (state: AddComponentState, event: AddComponentEvent): AddComponentState => {
      // Construir el contexto con los valores actuales
      const context: AddComponentContext = {
        formState,
        draftSelection,
        hoveredNodeId,
      };
      return addComponentReducer(state, event, context);
    },
    [formState, draftSelection, hoveredNodeId]
  );

  // State machine
  const [state, dispatch] = useReducer(
    reactReducer,
    { type: "idle" } as AddComponentState
  );

  // Flags derivados
  const flags = deriveFlags(state);

  // Actions
  const start = useCallback(() => {
    dispatch({ type: "START" });
  }, []);

  const selectComponent = useCallback((componentId: string, componentName: string) => {
    setFormState({
      componentId,
      calculationType: "exponential",
    });
    dispatch({ type: "SELECT_COMPONENT", componentId, componentName });
  }, []);

  const clearComponent = useCallback(() => {
    setFormState({
      componentId: null,
      calculationType: "exponential",
    });
    setDraftSelection(null);
    setHoveredNodeId(null);
    dispatch({ type: "CLEAR_COMPONENT" });
  }, []);

  const startTargetSelection = useCallback(() => {
    dispatch({ type: "START" });
  }, []);

  const selectTarget = useCallback((target: DiagramNodeSelection) => {
    dispatch({ type: "SELECT_TARGET", target });
  }, []);

  const cancelTarget = useCallback(() => {
    setDraftSelection(null);
    setHoveredNodeId(null);
    dispatch({ type: "CANCEL_TARGET" });
  }, []);

  const selectGate = useCallback((gateType: GateType | null) => {
    dispatch({ type: "SELECT_GATE", gateType });
  }, []);

  const startOrganization = useCallback(() => {
    dispatch({ type: "START_ORGANIZATION" });
  }, []);

  const cancelOrganization = useCallback(() => {
    dispatch({ type: "CANCEL_ORGANIZATION" });
  }, []);

  const cancel = useCallback(() => {
    setFormState({
      componentId: null,
      calculationType: "exponential",
    });
    setDraftSelection(null);
    setHoveredNodeId(null);
    dispatch({ type: "CANCEL" });
  }, []);

  const confirmInsert = useCallback(async (payload: any) => {
    options.onInsertSuccess?.(payload.insert.componentId);
    dispatch({ type: "RESET" });
    setFormState({
      componentId: null,
      calculationType: "exponential",
    });
    setDraftSelection(null);
    setHoveredNodeId(null);
  }, [options]);

  const handleNodeHover = useCallback((nodeId: string | null) => {
    if (!flags.isSelectingTarget) return;
    setHoveredNodeId(nodeId);
  }, [flags.isSelectingTarget]);

  const handleNodePreselect = useCallback((selection: DiagramNodeSelection) => {
    if (!flags.isSelectingTarget) return;
    setDraftSelection(selection);
  }, [flags.isSelectingTarget]);

  const handleNodeConfirm = useCallback((selection: DiagramNodeSelection) => {
    if (!flags.isSelectingTarget) return;
    selectTarget(selection);
  }, [flags.isSelectingTarget, selectTarget]);

  // Helpers para el UI
  const getComponent = useCallback(() => {
    if (
      state.type === "componentSelected" ||
      state.type === "selectingTarget" ||
      state.type === "targetSelected" ||
      state.type === "choosingGate" ||
      state.type === "organizing"
    ) {
      return state.component;
    }
    return null;
  }, [state]);

  const getTarget = useCallback(() => {
    if (
      state.type === "targetSelected" ||
      state.type === "choosingGate" ||
      state.type === "organizing"
    ) {
      return state.target;
    }
    return null;
  }, [state]);

  const getGateType = useCallback((): GateType | null => {
    if (state.type === "organizing") {
      return state.gateType;
    }
    return null;
  }, [state]);

  return {
    // State
    state,
    flags,
    formState,
    draftSelection,
    hoveredNodeId,

    // Derived state
    component: getComponent(),
    target: getTarget(),
    gateType: getGateType(),

    // Actions
    start,
    selectComponent,
    clearComponent,
    startTargetSelection,
    selectTarget,
    cancelTarget,
    selectGate,
    startOrganization,
    cancelOrganization,
    confirmInsert,
    cancel,

    // Selection handlers
    handleNodeHover,
    handleNodePreselect,
    handleNodeConfirm,

    // Form
    setFormState,
  };
}