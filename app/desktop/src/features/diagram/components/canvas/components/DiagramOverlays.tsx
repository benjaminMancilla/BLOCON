import { DiagramComponentNode } from "../../DiagramComponentNode";
import { DiagramCollapsedGateNode } from "../../DiagramCollapsedGateNode";
import { DiagramGateNode } from "../../DiagramGateNode";
import type {
  DiagramGateArea,
  DiagramLayoutNode,
} from "../../../hooks/useDiagramLayout";
import { DiagramOrganizationPlaceholderNode } from "./DiagramOrganizationPlaceholderNode";

type DiagramOverlaysProps = {
  dragGhostNode: DiagramLayoutNode | null;
  organizationPlaceholderId: string | null;
  organizationComponentLabel: string;
  organizationCalculationMeta: { icon: string; label: string };
  hoveredGateArea: DiagramGateArea | null;
  isOrganizationMode: boolean;
  onCollapseGate: (gateId: string) => void;
  onHoverGateIdChange: (gateId: string | null) => void;
};

export const DiagramOverlays = ({
  dragGhostNode,
  organizationPlaceholderId,
  organizationComponentLabel,
  organizationCalculationMeta,
  hoveredGateArea,
  isOrganizationMode,
  onCollapseGate,
  onHoverGateIdChange,
}: DiagramOverlaysProps) => (
  <>
    {dragGhostNode ? (
      dragGhostNode.type === "component" ? (
        dragGhostNode.isCollapsed ? (
          <DiagramCollapsedGateNode
            key={`${dragGhostNode.id}-ghost`}
            node={dragGhostNode}
            onExpand={() => undefined}
            isSelectionMode={false}
            isDimmed={false}
            isOrganizationLocked={false}
            isDraggable={false}
            isDragging={false}
            isOrganizationDraggable={false}
            isDragGhost
            allowExpand={false}
          />
        ) : organizationPlaceholderId &&
          dragGhostNode.id === organizationPlaceholderId ? (
          <DiagramOrganizationPlaceholderNode
            key={`${dragGhostNode.id}-ghost`}
            node={dragGhostNode}
            label={organizationComponentLabel}
            meta={organizationCalculationMeta}
            isDragGhost
          />
        ) : (
          <DiagramComponentNode
            key={`${dragGhostNode.id}-ghost`}
            node={dragGhostNode}
            isSelectionMode={false}
            isDimmed={false}
            isDraggable={false}
            isDragging={false}
            isOrganizationDraggable={false}
            isDragGhost
          />
        )
      ) : (
        <DiagramGateNode
          key={`${dragGhostNode.id}-ghost`}
          node={dragGhostNode}
          isLabelVisible
          isSelectionMode={false}
          isDimmed={false}
          isOrganizationLocked={false}
          isDraggable={false}
          isDragging={false}
          isOrganizationDraggable={false}
          isDragGhost
        />
      )
    ) : null}
    {!isOrganizationMode && hoveredGateArea && (
      <div
        className="diagram-gate__collapse-hitbox"
        data-collapse-hitbox={hoveredGateArea.id}
        style={{
          left: hoveredGateArea.x + hoveredGateArea.width - 36,
          top: hoveredGateArea.y + 4,
        }}
        onPointerEnter={() => onHoverGateIdChange(hoveredGateArea.id)}
        onPointerLeave={(event) => {
          const nextTarget = event.relatedTarget as HTMLElement | null;
          if (
            nextTarget?.closest(
              `[data-gate-area-id="${hoveredGateArea.id}"]`
            )
          ) {
            return;
          }
          onHoverGateIdChange(null);
        }}
      >
        <button
          type="button"
          className="diagram-gate__collapse-button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => onCollapseGate(hoveredGateArea.id)}
          aria-label={`Colapsar gate ${hoveredGateArea.id}`}
        >
          -
        </button>
      </div>
    )}
  </>
);