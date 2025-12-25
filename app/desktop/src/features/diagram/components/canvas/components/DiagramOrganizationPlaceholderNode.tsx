import type { PointerEvent } from "react";
import type { DiagramLayoutNode } from "../../../hooks/useDiagramLayout";

type OrganizationCalculationMeta = {
  icon: string;
  label: string;
};

type DiagramOrganizationPlaceholderNodeProps = {
  node: DiagramLayoutNode;
  label: string;
  meta: OrganizationCalculationMeta;
  isDragging?: boolean;
  isDraggable?: boolean;
  isOrganizationDraggable?: boolean;
  isDragGhost?: boolean;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
};

export const DiagramOrganizationPlaceholderNode = ({
  node,
  label,
  meta,
  isDragging = false,
  isDraggable = false,
  isOrganizationDraggable = false,
  isDragGhost = false,
  onPointerDown,
}: DiagramOrganizationPlaceholderNodeProps) => (
  <div
    key={node.id}
    className={`diagram-node diagram-node--component diagram-node--organization-placeholder${
      isDraggable ? " diagram-node--draggable" : ""
    }${
      isDragging ? " diagram-node--organization-drag-placeholder" : ""
    }${
      isOrganizationDraggable ? " diagram-node--organization-draggable" : ""
    }${isDragGhost ? " diagram-node--drag-ghost" : ""}`}
    style={{
      left: node.x,
      top: node.y,
      width: node.width,
      height: node.height,
    }}
    data-node-id={node.id}
    onPointerDown={onPointerDown}
    aria-hidden="true"
  >
    <div className="diagram-node__title">{label}</div>
    <div className="diagram-node__meta">
      <span className="diagram-node__icon">{meta.icon}</span>
      <span className="diagram-node__meta-text">{meta.label}</span>
    </div>
  </div>
);