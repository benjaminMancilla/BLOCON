import { useMemo } from "react";
import type { DiagramLayoutNode } from "../../../hooks/useDiagramLayout";

type UseNodeStatesArgs = {
  node: DiagramLayoutNode;
  isSelectionMode: boolean;
  isOrganizationMode: boolean;
  hoveredSelectableId: string | null;
  hoveredNodeId: string | null;
  preselectedNodeId: string | null;
  selectedNodeId: string | null;
  organizationGateId: string | null;
  organizationPlaceholderId: string | null;
  organizationLockedGateIds: Set<string>;
  isNodeWithinOrganization: (nodeId: string, parentGateId: string | null) => boolean;
  insertHighlightedComponentId: string | null;
  insertHighlightedGateId: string | null;
  draggingNodeId: string | null;
};

type NodeStates = {
  isPlaceholder: boolean;
  isHovered: boolean;
  isPreselected: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  isInsertHighlighted: boolean;
  isDirectChild: boolean;
  isLocked: boolean;
  isDraggable: boolean;
  isDragging: boolean;
  isOrganizationDraggable: boolean;
};

export const useNodeStates = ({
  node,
  isSelectionMode,
  isOrganizationMode,
  hoveredSelectableId,
  hoveredNodeId,
  preselectedNodeId,
  selectedNodeId,
  organizationGateId,
  organizationPlaceholderId,
  organizationLockedGateIds,
  isNodeWithinOrganization,
  insertHighlightedComponentId,
  insertHighlightedGateId,
  draggingNodeId,
}: UseNodeStatesArgs): NodeStates =>
  useMemo(() => {
    const isPlaceholder =
      organizationPlaceholderId !== null && node.id === organizationPlaceholderId;
    const isHovered =
      isSelectionMode &&
      (hoveredSelectableId === node.id || hoveredNodeId === node.id);
    const isPreselected = isSelectionMode && preselectedNodeId === node.id;
    const isSelected = selectedNodeId === node.id;
    const isDimmed =
      isOrganizationMode && organizationGateId
        ? !isNodeWithinOrganization(node.id, node.parentGateId ?? null)
        : false;
    const isInsertHighlighted =
      insertHighlightedComponentId === node.id ||
      insertHighlightedGateId === node.id;
    const isDirectChild =
      isOrganizationMode && organizationGateId
        ? node.parentGateId === organizationGateId
        : false;
    const isLocked =
      isOrganizationMode &&
      organizationLockedGateIds.has(node.id) &&
      node.parentGateId !== organizationGateId;
    const isDraggable = isDirectChild;
    const isDragging = draggingNodeId === node.id;
    const isOrganizationDraggable = isOrganizationMode && isDraggable;

    return {
      isPlaceholder,
      isHovered,
      isPreselected,
      isSelected,
      isDimmed,
      isInsertHighlighted,
      isDirectChild,
      isLocked,
      isDraggable,
      isDragging,
      isOrganizationDraggable,
    };
  }, [
    draggingNodeId,
    hoveredNodeId,
    hoveredSelectableId,
    insertHighlightedComponentId,
    insertHighlightedGateId,
    isNodeWithinOrganization,
    isOrganizationMode,
    isSelectionMode,
    node.id,
    node.parentGateId,
    organizationGateId,
    organizationLockedGateIds,
    organizationPlaceholderId,
    preselectedNodeId,
    selectedNodeId,
  ]);