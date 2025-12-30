import type { CSSProperties } from "react";
import type { DiagramGateArea } from "../../../hooks/useDiagramLayout";
import { buildGateColorVars, resolveGateColor } from "../../../utils/gateColors";

const SELECTED_GATE_PADDING = 24;

type DiagramGateAreasProps = {
  gateAreas: DiagramGateArea[];
  visibleGateIds: Set<string>;
  isOrganizationMode: boolean;
  organizationGateId: string | null;
  organizationArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  selectedNodeId: string | null;
  insertHighlightedGateId: string | null;
  isGateWithinOrganization: (gateId: string) => boolean;
  onHoverGateIdChange: (gateId: string | null) => void;
};

export const DiagramGateAreas = ({
  gateAreas,
  visibleGateIds,
  isOrganizationMode,
  organizationGateId,
  organizationArea,
  selectedNodeId,
  insertHighlightedGateId,
  isGateWithinOrganization,
  onHoverGateIdChange,
}: DiagramGateAreasProps) => (
  <>
    {gateAreas.map((area) => {
      const isVisible = visibleGateIds.has(area.id);
      const gateColor = resolveGateColor(area.subtype, area.color ?? null);
      const colorVars = buildGateColorVars(gateColor) as CSSProperties;
      const isOrganizingGate = isOrganizationMode && organizationGateId === area.id;
      const isSelectedGate = selectedNodeId === area.id && !isOrganizingGate;
      const activeArea =
        isOrganizingGate && organizationArea
          ? organizationArea
          : isSelectedGate
            ? {
                x: area.x - SELECTED_GATE_PADDING,
                y: area.y - SELECTED_GATE_PADDING,
                width: area.width + SELECTED_GATE_PADDING * 2,
                height: area.height + SELECTED_GATE_PADDING * 2,
              }
            : area;
      const isWithinOrganization =
        isOrganizationMode && organizationGateId
          ? isGateWithinOrganization(area.id)
          : false;
      const shouldDim =
        isOrganizationMode && organizationGateId && !isWithinOrganization;

      return (
        <div
          key={`gate-area-${area.id}`}
          className={`diagram-gate-area${
            isVisible ? " diagram-gate-area--active" : ""
          }${
            isOrganizingGate ? " diagram-gate-area--organization" : ""
          }${isSelectedGate ? " diagram-gate-area--selected" : ""}${
            insertHighlightedGateId === area.id
              ? " diagram-gate-area--insert-highlight"
              : ""
          }${shouldDim ? " diagram-gate-area--dimmed" : ""}`}
          data-gate-area-id={area.id}
          style={{
            left: activeArea.x,
            top: activeArea.y,
            width: activeArea.width,
            height: activeArea.height,
            zIndex: area.depth,
            ...colorVars,
          }}
          onPointerEnter={() => onHoverGateIdChange(area.id)}
          onPointerLeave={(event) => {
            const nextTarget = event.relatedTarget as HTMLElement | null;
            if (nextTarget?.closest(`[data-collapse-hitbox="${area.id}"]`)) {
              return;
            }
            onHoverGateIdChange(null);
          }}
          aria-hidden="true"
        />
      );
    })}
  </>
);