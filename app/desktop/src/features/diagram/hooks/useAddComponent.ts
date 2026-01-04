// features/diagram/hooks/useAddComponent.ts
import { useCallback, useEffect, useReducer, useState, useRef } from "react";
import type { DiagramNodeSelection } from "../types/selection";
import type { GateType } from "../types/gates";
import type { AddComponentFormState } from "../types/addComponent";
import {
  addComponentReducer,
  deriveFlags,
  type AddComponentState,
  type AddComponentEvent,
  type AddComponentContext,
} from "../machines/addComponentMachine";

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
  const [resetToken, setResetToken] = useState(0);

  // Wrapper del reducer
  const reactReducer = useCallback(
    (state: AddComponentState, event: AddComponentEvent): AddComponentState => {
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

  // Refs para evitar loops infinitos en useEffect
  const prevStateType = useRef<string>(state.type);
  const shouldAutoStartSelection = useRef(false);

  // TRANSICIÓN AUTOMÁTICA 1: componentSelected → selectingTarget
  useEffect(() => {
    if (state.type === "componentSelected" && prevStateType.current !== "componentSelected") {
      prevStateType.current = state.type;
      if (shouldAutoStartSelection.current) {
        // Automáticamente entrar en modo selección
        dispatch({ type: "START" });
      }
      shouldAutoStartSelection.current = false;
    } else {
      prevStateType.current = state.type;
    }
  }, [state.type]);

  // TRANSICIÓN AUTOMÁTICA 2: Cuando llegamos a organizing desde choosingGate, activar modo organización
  useEffect(() => {
    if (state.type === "organizing" && prevStateType.current === "choosingGate") {
      // Automáticamente activar el modo organización
      setTimeout(() => dispatch({ type: "START_ORGANIZATION" }), 0);
    }
  }, [state.type]);

  // Actions
  const start = useCallback(() => {
    dispatch({ type: "START" });
  }, []);

  const selectComponent = useCallback(
    (
      componentId: string,
      componentName?: string,
      options: { autoStartSelection?: boolean } = {}
    ) => {
      shouldAutoStartSelection.current = options.autoStartSelection ?? true;
      setFormState({
        componentId,
        calculationType: "exponential",
      });
      dispatch({
        type: "SELECT_COMPONENT",
        componentId,
        componentName: componentName || componentId,
      });
      // La transición automática a selectingTarget ocurre vía useEffect
    },
    []
  );

  const clearComponent = useCallback(() => {
    setFormState({
      componentId: null,
      calculationType: "exponential",
    });
    setDraftSelection(null);
    setHoveredNodeId(null);
    dispatch({ type: "CLEAR_COMPONENT" });
    setResetToken((current) => current + 1);
  }, []);

  const startTargetSelection = useCallback(() => {
    dispatch({ type: "START" });
  }, []);

  const selectTarget = useCallback((target: DiagramNodeSelection) => {
    dispatch({ type: "SELECT_TARGET", target });
    // Si selecciona gate, va directo a organizing y el useEffect activa START_ORGANIZATION
    // Si selecciona component, va a choosingGate y usuario debe elegir tipo de gate
  }, []);

  const cancelTarget = useCallback(() => {
    // Cancelar el MODO selección (volver a componentSelected)
    shouldAutoStartSelection.current = false;
    setDraftSelection(null);
    setHoveredNodeId(null);
    dispatch({ type: "CANCEL_TARGET" });
  }, []);

  const clearTarget = useCallback(() => {
    // Solo limpiar la selección actual, mantener modo activo
    setDraftSelection(null);
    setHoveredNodeId(null);
    dispatch({ type: "CLEAR_TARGET" });
  }, []);

  const selectGate = useCallback((gateType: GateType | null) => {
    if (state.type !== "choosingGate" && state.type !== "organizing") {
      console.warn("selectGate called but not in choosingGate/organizing state");
      return;
    }
    
    if (!gateType) {
      console.warn("selectGate called with null gateType");
      return;
    }

    // Seleccionar el gate type → esto nos lleva a organizing
    dispatch({ type: "SELECT_GATE", gateType });
    // El useEffect detectará el cambio a organizing y despachará START_ORGANIZATION
  }, [state.type]);

  const startOrganization = useCallback(() => {
    dispatch({ type: "START_ORGANIZATION" });
  }, []);

  const cancelOrganization = useCallback(() => {
    // Cancelar el modo organización
    // Si estaba organizando Y había seleccionado un gateType, vuelve a choosingGate
    // Si estaba organizando un gate existente, vuelve a selectingTarget
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
    setResetToken((current) => current + 1);
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
    setResetToken((current) => current + 1);
  }, [options]);

  // Selection handlers
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
    resetToken,

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
    clearTarget,
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