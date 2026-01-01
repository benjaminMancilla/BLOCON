// features/diagram/machines/addComponentMachine.ts
import type { DiagramNodeSelection } from "../types/selection";
import type { GateType } from "../types/gates";
import type { AddComponentFormState } from "../types/addComponent";

// Estados posibles del flujo
export type AddComponentState =
  | { type: "idle" }
  | { type: "searchingComponent" }
  | { type: "componentSelected"; component: { id: string; name: string } }
  | { type: "selectingTarget"; component: { id: string; name: string } }
  | { type: "targetSelected"; component: { id: string; name: string }; target: DiagramNodeSelection }
  | { type: "choosingGate"; component: { id: string; name: string }; target: DiagramNodeSelection }
  | { type: "organizing"; component: { id: string; name: string }; target: DiagramNodeSelection; gateType: GateType | null }
  | { type: "inserting"; payload: any }
  | { type: "error"; message: string };

// Eventos que pueden ocurrir
export type AddComponentEvent =
  | { type: "START" }
  | { type: "SELECT_COMPONENT"; componentId: string; componentName: string }
  | { type: "CLEAR_COMPONENT" }
  | { type: "SELECT_TARGET"; target: DiagramNodeSelection }
  | { type: "CANCEL_TARGET" }
  | { type: "SELECT_GATE"; gateType: GateType | null }
  | { type: "START_ORGANIZATION" }
  | { type: "CANCEL_ORGANIZATION" }
  | { type: "CONFIRM_INSERT"; payload: any }
  | { type: "CANCEL" }
  | { type: "RESET" };

// Contexto adicional
export type AddComponentContext = {
  formState: AddComponentFormState;
  draftSelection: DiagramNodeSelection | null;
  hoveredNodeId: string | null;
};

// Transiciones válidas
export function addComponentReducer(
  state: AddComponentState,
  event: AddComponentEvent,
  context: AddComponentContext
): AddComponentState {
  // Manejar RESET globalmente - puede ocurrir desde cualquier estado
  if (event.type === "RESET") {
    return { type: "idle" };
  }

  // Manejar CANCEL globalmente - vuelve a idle desde cualquier estado
  if (event.type === "CANCEL") {
    return { type: "idle" };
  }

  switch (state.type) {
    case "idle":
      if (event.type === "START") {
        return { type: "searchingComponent" };
      }
      return state;

    case "searchingComponent":
      if (event.type === "SELECT_COMPONENT") {
        return {
          type: "componentSelected",
          component: { id: event.componentId, name: event.componentName },
        };
      }
      return state;

    case "componentSelected":
      if (event.type === "START") {
        return {
          type: "selectingTarget",
          component: state.component,
        };
      }
      if (event.type === "CLEAR_COMPONENT") {
        return { type: "searchingComponent" };
      }
      return state;

    case "selectingTarget":
      if (event.type === "SELECT_TARGET") {
        // Si es un gate, va directo a organization
        if (event.target.type === "gate") {
          return {
            type: "organizing",
            component: state.component,
            target: event.target,
            gateType: null, // Se usa el gate existente
          };
        }
        // Si es component, necesita elegir gate
        return {
          type: "choosingGate",
          component: state.component,
          target: event.target,
        };
      }
      if (event.type === "CANCEL_TARGET") {
        return {
          type: "componentSelected",
          component: state.component,
        };
      }
      console.warn("Invalid transition in selectingTarget", { state, event });
      return state;

    case "targetSelected":
      // Este estado parece no usarse en el flujo actual
      // pero lo mantengo por si acaso
      return state;

    case "choosingGate":
      if (event.type === "SELECT_GATE") {
        return {
          type: "organizing",
          component: state.component,
          target: state.target,
          gateType: event.gateType,
        };
      }
      if (event.type === "CANCEL_TARGET") {
        return {
          type: "selectingTarget",
          component: state.component,
        };
      }
      console.warn("Invalid transition in choosingGate", { state, event });
      return state;

    case "organizing":
      if (event.type === "CONFIRM_INSERT") {
        return {
          type: "inserting",
          payload: event.payload,
        };
      }
      if (event.type === "CANCEL_ORGANIZATION") {
        // Volver al paso anterior
        if (state.gateType !== null) {
          return {
            type: "choosingGate",
            component: state.component,
            target: state.target,
          };
        }
        return {
          type: "selectingTarget",
          component: state.component,
        };
      }
      return state;

    case "inserting":
      // Solo RESET puede salir de este estado (ya manejado arriba)
      return state;

    case "error":
      // Solo RESET puede salir de este estado (ya manejado arriba)
      return state;

    default:
      // Esto nunca debería ocurrir gracias al type system
      const exhaustiveCheck: never = state;
      return exhaustiveCheck;
  }
}

// Helper para derivar estados booleanos del estado de la máquina
export function deriveFlags(state: AddComponentState) {
  return {
    isActive: state.type !== "idle",
    isSearching: state.type === "searchingComponent",
    hasComponent: 
      state.type === "componentSelected" ||
      state.type === "selectingTarget" ||
      state.type === "targetSelected" ||
      state.type === "choosingGate" ||
      state.type === "organizing",
    isSelectingTarget: state.type === "selectingTarget",
    needsGateSelection: state.type === "choosingGate",
    isOrganizing: state.type === "organizing",
    isInserting: state.type === "inserting",
    canCancel: state.type !== "inserting",
  };
}

// Helper para validar si una transición es válida
export function canTransition(
  state: AddComponentState,
  event: AddComponentEvent
): boolean {
  const context: AddComponentContext = {
    formState: { componentId: null, calculationType: "exponential" },
    draftSelection: null,
    hoveredNodeId: null,
  };
  const nextState = addComponentReducer(state, event, context);
  return nextState !== state;
}