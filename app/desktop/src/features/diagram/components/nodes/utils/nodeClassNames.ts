export type DiagramNodeClassNameFlags = {
  isSelectionMode?: boolean;
  isHovered?: boolean;
  isPreselected?: boolean;
  isSelected?: boolean;
  isInsertHighlighted?: boolean;
  isDimmed?: boolean;
  isOrganizationLocked?: boolean;
  isDraggable?: boolean;
  isDragging?: boolean;
  isOrganizationDraggable?: boolean;
  isDragGhost?: boolean;
  isLabelVisible?: boolean;
  isInteractive?: boolean;
};

export const buildNodeClassNames = (
  baseClassName: string,
  {
    isSelectionMode,
    isHovered,
    isPreselected,
    isSelected,
    isInsertHighlighted,
    isDimmed,
    isOrganizationLocked,
    isDraggable,
    isDragging,
    isOrganizationDraggable,
    isDragGhost,
    isLabelVisible,
    isInteractive,
  }: DiagramNodeClassNameFlags,
) => {
  return `${baseClassName}${
    isLabelVisible ? " diagram-node--gate-visible" : ""
  }${isSelectionMode ? " diagram-node--selectable" : ""}${
    isHovered ? " diagram-node--hovered" : ""
  }${isPreselected ? " diagram-node--preselected" : ""}${
    isSelected ? " diagram-node--selected" : ""
  }${isInsertHighlighted ? " diagram-node--insert-highlight" : ""}${
    isDimmed ? " diagram-node--dimmed" : ""
  }${isOrganizationLocked ? " diagram-node--locked" : ""}${
    isDraggable ? " diagram-node--draggable" : ""
  }${isDragging ? " diagram-node--organization-drag-placeholder" : ""}${
    isOrganizationDraggable ? " diagram-node--organization-draggable" : ""
  }${isDragGhost ? " diagram-node--drag-ghost" : ""}${
    isInteractive ? " diagram-node--interactive" : ""
  }`;
};