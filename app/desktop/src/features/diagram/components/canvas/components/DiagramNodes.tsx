import type { PointerEvent } from "react";
import { DiagramComponentNode } from "../../DiagramComponentNode";
import { DiagramCollapsedGateNode } from "../../DiagramCollapsedGateNode";
import { DiagramGateNode } from "../../DiagramGateNode";
import type { DiagramLayoutNode } from "../../../hooks/useDiagramLayout";
import { useNodeStates } from "../hooks/useNodeStates";
import { DiagramOrganizationPlaceholderNode } from "./DiagramOrganizationPlaceholderNode";
import type { NodeContextMenuTarget } from "../../../hooks/useNodeContextMenu";
import type { QuickClickPayload } from "../../nodes/hooks/useQuickClick";

type SelectionHandlers = {
  onNodeHover: (nodeId: string) => void;
  onNodeHoverEnd: () => void;
  onNodePreselect: (nodeId: string) => void;
  onNodeConfirm: (nodeId: string) => void;
};

type DiagramNodesProps = {
  nodes: DiagramLayoutNode[];
  isSelectionMode: boolean;
  isOrganizationMode: boolean;
  hoveredSelectableId: string | null;
  hoveredNodeId: string | null;
  preselectedNodeId: string | null;
  selectedNodeId: string | null;
  organizationGateId: string | null;
  organizationPlaceholderId: string | null;
  organizationLockedGateIds: Set<string>;
  organizationComponentLabel: string;
  organizationCalculationMeta: { icon: string; label: string };
  isNodeWithinOrganization: (nodeId: string, parentGateId: string | null) => boolean;
  insertHighlightedComponentId: string | null;
  insertHighlightedGateId: string | null;
  draggingNodeId: string | null;
  visibleGateIds: Set<string>;
  canOpenNodeContextMenu: boolean;
  onHoverGateIdChange: (gateId: string | null) => void;
  onExpandGate: (gateId: string) => void;
  onDragStart: (event: PointerEvent<HTMLDivElement>, nodeId: string) => void;
  onNodeContextMenu: (target: NodeContextMenuTarget, position: { x: number; y: number }) => void;
  selectionHandlers: SelectionHandlers;
};

type DiagramNodeItemProps = Omit<DiagramNodesProps, "nodes"> & {
  node: DiagramLayoutNode;
};

const DiagramNodeItem = ({
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
  organizationComponentLabel,
  organizationCalculationMeta,
  isNodeWithinOrganization,
  insertHighlightedComponentId,
  insertHighlightedGateId,
  draggingNodeId,
  visibleGateIds,
  canOpenNodeContextMenu,
  onHoverGateIdChange,
  onExpandGate,
  onDragStart,
  onNodeContextMenu,
  selectionHandlers,
}: DiagramNodeItemProps) => {
  const {
    isPlaceholder,
    isHovered,
    isPreselected,
    isSelected,
    isDimmed,
    isInsertHighlighted,
    isLocked,
    isDraggable,
    isDragging,
    isOrganizationDraggable,
  } = useNodeStates({
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
  });

  const isOrganizationDragging = isOrganizationMode && isDragging;

  const handleSelectHover = () => selectionHandlers.onNodeHover(node.id);
  const handleSelectHoverEnd = () => selectionHandlers.onNodeHoverEnd();
  const handlePreselect = () => selectionHandlers.onNodePreselect(node.id);
  const handleConfirm = () => selectionHandlers.onNodeConfirm(node.id);
  const handleDragStart = (event: PointerEvent<HTMLDivElement>) =>
    onDragStart(event, node.id);
  const handleQuickClick = (payload: QuickClickPayload) => {
    if (!canOpenNodeContextMenu) return;
    const isCollapsedGate = node.type === "component" && node.isCollapsed;
    const target: NodeContextMenuTarget = {
      nodeId: node.id,
      nodeType: isCollapsedGate ? "gate" : node.type,
      gateSubtype: isCollapsedGate || node.type === "gate" ? node.subtype ?? null : null,
      name: null,
    };
    onNodeContextMenu(target, payload.position);
  };

  if (isPlaceholder) {
    return (
      <DiagramOrganizationPlaceholderNode
        key={node.id}
        node={node}
        label={organizationComponentLabel}
        meta={organizationCalculationMeta}
        isDragging={isOrganizationDragging}
        isDraggable={isDraggable}
        isOrganizationDraggable={isOrganizationDraggable}
        onPointerDown={handleDragStart}
      />
    );
  }

  if (node.type === "component") {
    if (node.isCollapsed) {
      return (
        <DiagramCollapsedGateNode
          key={node.id}
          node={node}
          onExpand={onExpandGate}
          onHoverStart={onHoverGateIdChange}
          onHoverEnd={() => onHoverGateIdChange(null)}
          isSelectionMode={isSelectionMode}
          isHovered={isHovered}
          isPreselected={isPreselected}
          isSelected={isSelected}
          isInsertHighlighted={isInsertHighlighted}
          isDimmed={isDimmed}
          isOrganizationLocked={isLocked}
          isDraggable={isDraggable}
          isDragging={isOrganizationDragging}
          isOrganizationDraggable={isOrganizationDraggable}
          isInteractive={canOpenNodeContextMenu}
          isQuickClickEnabled={canOpenNodeContextMenu}
          allowExpand={
            !isOrganizationMode && !isLocked && !(organizationGateId === node.id)
          }
          onDragStart={handleDragStart}
          onSelectHover={handleSelectHover}
          onSelectHoverEnd={handleSelectHoverEnd}
          onPreselect={handlePreselect}
          onConfirm={handleConfirm}
          onQuickClick={handleQuickClick}
        />
      );
    }

    return (
      <DiagramComponentNode
        key={node.id}
        node={node}
        onHoverStart={onHoverGateIdChange}
        onHoverEnd={() => onHoverGateIdChange(null)}
        isSelectionMode={isSelectionMode}
        isHovered={isHovered}
        isPreselected={isPreselected}
        isSelected={isSelected}
        isInsertHighlighted={isInsertHighlighted}
        isDimmed={isDimmed}
        isDraggable={isDraggable}
        isDragging={isOrganizationDragging}
        isOrganizationDraggable={isOrganizationDraggable}
        isInteractive={canOpenNodeContextMenu}
        isQuickClickEnabled={canOpenNodeContextMenu}
        onDragStart={handleDragStart}
        onSelectHover={handleSelectHover}
        onSelectHoverEnd={handleSelectHoverEnd}
        onPreselect={handlePreselect}
        onConfirm={handleConfirm}
        onQuickClick={handleQuickClick}
      />
    );
  }

  return (
    <DiagramGateNode
      key={node.id}
      node={node}
      isLabelVisible={visibleGateIds.has(node.id) || isSelected}
      onHoverStart={onHoverGateIdChange}
      onHoverEnd={() => onHoverGateIdChange(null)}
      isSelectionMode={isSelectionMode}
      isHovered={isHovered}
      isPreselected={isPreselected}
      isSelected={isSelected}
      isInsertHighlighted={isInsertHighlighted}
      isDimmed={isDimmed}
      isOrganizationLocked={isLocked}
      isDraggable={isDraggable}
      isDragging={isOrganizationDragging}
      isOrganizationDraggable={isOrganizationDraggable}
      isInteractive={canOpenNodeContextMenu}
      isQuickClickEnabled={canOpenNodeContextMenu}
      onDragStart={handleDragStart}
      onSelectHover={handleSelectHover}
      onSelectHoverEnd={handleSelectHoverEnd}
      onPreselect={handlePreselect}
      onConfirm={handleConfirm}
      onQuickClick={handleQuickClick}
    />
  );
};

export const DiagramNodes = ({ nodes, ...rest }: DiagramNodesProps) => (
  <>
    {nodes.map((node) => (
      <DiagramNodeItem key={node.id} node={node} {...rest} />
    ))}
  </>
);