// features/diagram/hooks/useOrganizationPayload.ts
import { useEffect, useMemo, useState } from "react";
import type { DiagramNodeSelection } from "../types/selection";
import type { GateType } from "../types/gates";
import type { AddComponentFormState } from "../types/addComponent";
import type {
  OrganizationPayload,
  OrganizationUiState,
  OrganizationInsertTarget,
} from "../types/organization";

type UseOrganizationPayloadOptions = {
  isActive: boolean;
  organizationUiState: OrganizationUiState | null;
  confirmedSelection: DiagramNodeSelection | null;
  selectedGateType: GateType | null;
  formState: AddComponentFormState;
};

const isGateSelection = (selection: DiagramNodeSelection | null) =>
  selection?.type === "gate";

/**
 * Hook que construye el payload de organization basado en:
 * - El estado de la UI de organization (del canvas)
 * - La selección confirmada (target)
 * - El tipo de gate seleccionado (si aplica)
 * - El form state (componentId, calculationType)
 */
export function useOrganizationPayload({
  isActive,
  organizationUiState,
  confirmedSelection,
  selectedGateType,
  formState,
}: UseOrganizationPayloadOptions) {
  const [payload, setPayload] = useState<OrganizationPayload | null>(null);

  // Construir el target de inserción
  const insertTarget = useMemo((): OrganizationInsertTarget | null => {
    if (!confirmedSelection?.id) return null;

    const isGate = isGateSelection(confirmedSelection);
    
    return {
      hostId: confirmedSelection.id,
      hostType: isGate ? "gate" : "component",
      relationType: isGate
        ? organizationUiState?.gateSubtype ?? null
        : selectedGateType,
    };
  }, [confirmedSelection, organizationUiState?.gateSubtype, selectedGateType]);

  // Construir el payload completo
  useEffect(() => {
    // Solo construir si el modo organization está activo y tenemos UI state
    if (!isActive || !organizationUiState) {
      setPayload(null);
      return;
    }

    // Encontrar la posición del placeholder en el orden
    const placeholderIndex = organizationUiState.order.indexOf(
      organizationUiState.placeholderId
    );
    const positionIndex = placeholderIndex >= 0 ? placeholderIndex + 1 : null;

    // Construir insert data
    const insert = {
      componentId: formState.componentId,
      calculationType: formState.calculationType,
      // Si es koon, agregar k: 1 por defecto
      ...(insertTarget?.relationType === "koon" ? { k: 1 } : {}),
      target: insertTarget,
      position: {
        index: positionIndex,
        referenceId: null,
      },
    };

    // Determinar si hubo cambios en el orden
    const orderChanged =
      organizationUiState.order.length !==
        organizationUiState.initialOrder.length ||
      organizationUiState.order.some(
        (value, index) => value !== organizationUiState.initialOrder[index]
      );

    // Construir reorder si hubo cambios
    const reorder = orderChanged
      ? organizationUiState.order
          .map((id, index) => ({
            position: index + 1,
            id:
              id === organizationUiState.placeholderId
                ? formState.componentId
                : id,
          }))
          .filter(
            (entry): entry is { position: number; id: string } =>
              entry.id !== null
          )
      : null;

    setPayload({
      insert,
      reorder,
    });
  }, [
    isActive,
    organizationUiState,
    insertTarget,
    formState,
  ]);

  // Validar que el payload está completo
  const isValid = useMemo(() => {
    if (!payload) return false;
    if (!payload.insert.componentId) return false;
    if (!payload.insert.target) return false;
    return true;
  }, [payload]);

  return {
    payload,
    isValid,
  };
}