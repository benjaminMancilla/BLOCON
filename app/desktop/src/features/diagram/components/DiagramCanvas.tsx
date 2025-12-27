import { useCallback, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useDiagramCamera } from "../hooks/useDiagramCamera";
import { buildDiagramLayout } from "../hooks/useDiagramLayout";
import { useDiagramView } from "../hooks/useDiagramView";
import type { DiagramNodeSelection } from "../types/selection";
import type { GateType } from "../types/gates";
import type { OrganizationUiState } from "../types/organization";
import type { CalculationType } from "../types/addComponent";
import type { GraphData } from "../../../core/graph";
import type { DiagramStatus } from "../hooks/useDiagramGraph";
import { DiagramEdges } from "./canvas/components/DiagramEdges";
import { DiagramGateAreas } from "./canvas/components/DiagramGateAreas";
import { DiagramNodes } from "./canvas/components/DiagramNodes";
import { DiagramOverlays } from "./canvas/components/DiagramOverlays";
import { useDragAndDrop } from "./canvas/hooks/useDragAndDrop";
import { useInsertHighlight } from "./canvas/hooks/useInsertHighlight";
import { useOrganizationMode } from "./canvas/hooks/useOrganizationMode";
import { useSelectionMode } from "./canvas/hooks/useSelectionMode";

const ORGANIZATION_PADDING = 32;

type DiagramCanvasProps = {
  label?: string;
  isSelectionMode?: boolean;
  isOrganizationMode?: boolean;
  isDeleteMode?: boolean;
  graph: GraphData;
  status: DiagramStatus;
  errorMessage?: string | null;
  insertHighlight?: {
    token: number;
    componentId: string;
    targetGateId: string | null;
    hostComponentId: string | null;
    gateType: GateType | null;
  } | null;
  organizationSelection?: DiagramNodeSelection | null;
  organizationGateType?: GateType | null;
  organizationComponentId?: string | null;
  organizationCalculationType?: CalculationType | null;
  hoveredNodeId?: string | null;
  preselectedNodeId?: string | null;
  selectedNodeId?: string | null;
  deleteHoveredNodeId?: string | null;
  deletePreselectedNodeId?: string | null;
  deleteSelectedNodeId?: string | null;
  onEnterSelectionMode?: () => void;
  onExitSelectionMode?: () => void;
  onNodeHover?: (nodeId: string | null) => void;
  onNodePreselect?: (selection: DiagramNodeSelection) => void;
  onNodeConfirm?: (selection: DiagramNodeSelection) => void;
  onSelectionUpdate?: (selection: DiagramNodeSelection) => void;
  onSelectionCancel?: () => void;
  onEnterDeleteMode?: () => void;
  onExitDeleteMode?: () => void;
  onDeleteNodeHover?: (nodeId: string | null) => void;
  onDeleteNodePreselect?: (selection: DiagramNodeSelection) => void;
  onDeleteNodeConfirm?: (selection: DiagramNodeSelection) => void;
  onDeleteSelectionCancel?: () => void;
  onOrganizationCancel?: () => void;
  onOrganizationStateChange?: (state: OrganizationUiState | null) => void;
};

export const DiagramCanvas = ({
  label = "Canvas",
  isSelectionMode = false,
  isOrganizationMode = false,
  isDeleteMode = false,
  graph,
  status,
  errorMessage = null,
  insertHighlight = null,
  organizationSelection = null,
  organizationGateType = null,
  organizationComponentId = null,
  organizationCalculationType = null,
  hoveredNodeId = null,
  preselectedNodeId = null,
  selectedNodeId = null,
  deleteHoveredNodeId = null,
  deletePreselectedNodeId = null,
  deleteSelectedNodeId = null,
  onEnterSelectionMode,
  onExitSelectionMode,
  onNodeHover,
  onNodePreselect,
  onNodeConfirm,
  onSelectionUpdate,
  onSelectionCancel,
  onEnterDeleteMode,
  onExitDeleteMode,
  onDeleteNodeHover,
  onDeleteNodePreselect,
  onDeleteNodeConfirm,
  onDeleteSelectionCancel,
  onOrganizationCancel,
  onOrganizationStateChange,
}: DiagramCanvasProps) => {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const { cameraStyle, handlers, camera } = useDiagramCamera();
  const { collapsedGateIdSet, collapseGate, expandGate } = useDiagramView(graph);
  const [hoveredGateId, setHoveredGateId] = useState<string | null>(null);

  const handleCollapseGate = useCallback(
    (gateId: string) => {
      if (isOrganizationMode || isDeleteMode) return;
      collapseGate(gateId);
    },
    [collapseGate, isDeleteMode, isOrganizationMode]
  );

  const handleExpandGate = useCallback(
    (gateId: string) => {
      if (isOrganizationMode || isDeleteMode) return;
      expandGate(gateId);
    },
    [expandGate, isDeleteMode, isOrganizationMode]
  );

  const organization = useOrganizationMode({
    isActive: isOrganizationMode,
    graph,
    collapsedGateIdSet,
    selection: organizationSelection,
    gateType: organizationGateType,
    componentId: organizationComponentId,
    calculationType: organizationCalculationType,
    onStateChange: onOrganizationStateChange,
    onCancel: onOrganizationCancel,
  });

  const layout = useMemo(
    () => buildDiagramLayout(organization.graph, organization.collapsedGateIdSet),
    [organization.collapsedGateIdSet, organization.graph]
  );

  const hasDiagram = status === "ready" && layout.nodes.length > 0;
  const layoutNodeById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes]
  );

  const gateAreasById = useMemo(
    () => new Map(layout.gateAreas.map((area) => [area.id, area])),
    [layout.gateAreas]
  );
  const gateParentById = useMemo(
    () => new Map(layout.gateAreas.map((area) => [area.id, area.parentId])),
    [layout.gateAreas]
  );

  const selection = useSelectionMode({
    isActive: isSelectionMode,
    handlers,
    layoutNodeById,
    selectedNodeId,
    preselectedNodeId,
    onEnter: onEnterSelectionMode,
    onExit: onExitSelectionMode,
    onNodeHover,
    onNodePreselect,
    onNodeConfirm,
    onSelectionUpdate,
    onSelectionCancel,
  });

  const deleteSelection = useSelectionMode({
    isActive: isDeleteMode,
    handlers,
    layoutNodeById,
    selectedNodeId: deleteSelectedNodeId,
    preselectedNodeId: deletePreselectedNodeId,
    onEnter: onEnterDeleteMode,
    onExit: onExitDeleteMode,
    onNodeHover: onDeleteNodeHover,
    onNodePreselect: onDeleteNodePreselect,
    onNodeConfirm: onDeleteNodeConfirm,
    onSelectionCancel: onDeleteSelectionCancel,
  });

  const activeSelection = isDeleteMode ? deleteSelection : selection;
  const isInteractionMode = isSelectionMode || isDeleteMode;
  const activeHoveredSelectableId = isDeleteMode
    ? deleteSelection.hoveredSelectableId
    : selection.hoveredSelectableId;
  const activeHoveredNodeId = isDeleteMode ? deleteHoveredNodeId : hoveredNodeId;
  const activePreselectedNodeId = isDeleteMode
    ? deletePreselectedNodeId
    : preselectedNodeId;
  const activeSelectedNodeId = isDeleteMode
    ? deleteSelectedNodeId
    : selectedNodeId;

  const organizationGateArea = useMemo(() => {
    if (!organization.gateId) return null;
    return gateAreasById.get(organization.gateId) ?? null;
  }, [gateAreasById, organization.gateId]);

  const organizationArea = useMemo(() => {
    if (!isOrganizationMode || !organizationGateArea) return null;
    return {
      x: organizationGateArea.x - ORGANIZATION_PADDING,
      y: organizationGateArea.y - ORGANIZATION_PADDING,
      width: organizationGateArea.width + ORGANIZATION_PADDING * 2,
      height: organizationGateArea.height + ORGANIZATION_PADDING * 2,
    };
  }, [isOrganizationMode, organizationGateArea]);

  const organizationChildIds = useMemo(() => {
    if (!organization.gateId) return new Set<string>();
    return new Set(
      layout.nodes
        .filter((node) => node.parentGateId === organization.gateId)
        .map((node) => node.id)
    );
  }, [layout.nodes, organization.gateId]);

  const isGateWithinOrganization = useMemo(() => {
    if (!isOrganizationMode || !organization.gateId) {
      return () => false;
    }
    return (gateId: string) => {
      let current: string | null = gateId;
      while (current) {
        if (current === organization.gateId) return true;
        current = gateParentById.get(current) ?? null;
      }
      return false;
    };
  }, [gateParentById, isOrganizationMode, organization.gateId]);

  const isNodeWithinOrganization = useMemo(() => {
    if (!isOrganizationMode || !organization.gateId) {
      return () => false;
    }
    return (nodeId: string, parentGateId: string | null) => {
      if (nodeId === organization.gateId) return true;
      let current: string | null = parentGateId;
      while (current) {
        if (current === organization.gateId) return true;
        current = gateParentById.get(current) ?? null;
      }
      return false;
    };
  }, [gateParentById, isOrganizationMode, organization.gateId]);

  const hoveredGateArea = hoveredGateId
    ? gateAreasById.get(hoveredGateId) ?? null
    : null;
  
  const parentGateId = hoveredGateId
    ? gateAreasById.get(hoveredGateId)?.parentId ?? null
    : null;
  
  const visibleGateIds = useMemo(() => {
    const ids = new Set<string>();
    if (hoveredGateId) ids.add(hoveredGateId);
    if (parentGateId) ids.add(parentGateId);
    return ids;
  }, [hoveredGateId, parentGateId]);

  const getDiagramPoint = useCallback(
    (event: PointerEvent<HTMLDivElement> | globalThis.PointerEvent) => {
      const surface = surfaceRef.current;
      if (!surface) return null;
      const rect = surface.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left - camera.x) / camera.scale,
        y: (event.clientY - rect.top - camera.y) / camera.scale,
      };
    },
    [camera.scale, camera.x, camera.y]
  );

  const dragDrop = useDragAndDrop({
    isEnabled: isOrganizationMode,
    gateId: organization.gateId,
    organizationChildIds,
    organizationArea,
    axis: organization.axis,
    order: organization.order,
    defaultOrder: organization.defaultOrder,
    layoutNodeById,
    getDiagramPoint,
    setOrder: organization.setOrder,
  });

  const insertHighlightState = useInsertHighlight({
    highlight: insertHighlight,
    graph,
    status,
  });
  
  const organizationIndicator = useMemo(() => {
    if (!isOrganizationMode) return null;
    if (organization.gateId && !organization.isVirtualGate) {
      return `Organizando ${organization.gateId}`;
    }
    if (organization.gateSubtype) {
      return `Organizando nuevo ${organization.gateSubtype.toUpperCase()}`;
    }
    return "Organizando";
   }, [
    isOrganizationMode,
    organization.gateId,
    organization.gateSubtype,
    organization.isVirtualGate,
  ]);

  return (
    <section className="diagram-canvas" aria-label={label}>
      <div
        className={`diagram-canvas__surface${
          isInteractionMode ? " diagram-canvas__surface--selection" : ""
        }${isOrganizationMode ? " diagram-canvas__surface--organization" : ""}${
          isDeleteMode ? " diagram-canvas__surface--delete" : ""
        }`}
        {...activeSelection.cameraHandlers}
        ref={surfaceRef}
      >
        {isOrganizationMode ? (
          <div className="diagram-canvas__mode-indicator">
            {organizationIndicator}
          </div>
        ) : null}
        {isDeleteMode ? (
          <div className="diagram-canvas__mode-indicator diagram-canvas__mode-indicator--delete">
            Modo borrar
          </div>
        ) : null}
        <div className="diagram-canvas__viewport" style={cameraStyle}>
          {status !== "ready" && (
            <div className="diagram-canvas__placeholder">
              <div className="diagram-canvas__node">Nodo ejemplo</div>
              <p>
                {status === "loading" && "Cargando diagrama..."}
                {status === "error" &&
                  `No se pudo cargar el diagrama: ${errorMessage ?? "error desconocido"}`}
                {status === "idle" && "Esperando respuesta del backend."}
              </p>
            </div>
          )}
          {status === "ready" && !hasDiagram && (
            <div className="diagram-canvas__placeholder">
              <div className="diagram-canvas__node">Sin datos</div>
              <p>No hay nodos disponibles para renderizar el diagrama.</p>
            </div>
          )}
          {hasDiagram && (
            <div
              className="diagram-canvas__diagram"
              style={{ width: layout.width, height: layout.height }}
              onPointerLeave={() => setHoveredGateId(null)}
            >
              <DiagramGateAreas
                gateAreas={layout.gateAreas}
                visibleGateIds={visibleGateIds}
                isOrganizationMode={isOrganizationMode}
                organizationGateId={organization.gateId}
                organizationArea={organizationArea}
                selectedNodeId={activeSelectedNodeId}
                insertHighlightedGateId={insertHighlightState.highlightedGateId}
                isGateWithinOrganization={isGateWithinOrganization}
                onHoverGateIdChange={setHoveredGateId}
              />
              <DiagramEdges
                width={layout.width}
                height={layout.height}
                lines={layout.lines}
              />
              <DiagramNodes
                nodes={layout.nodes}
                isSelectionMode={isInteractionMode}
                isOrganizationMode={isOrganizationMode}
                hoveredSelectableId={activeHoveredSelectableId}
                hoveredNodeId={activeHoveredNodeId}
                preselectedNodeId={activePreselectedNodeId}
                selectedNodeId={activeSelectedNodeId}
                organizationGateId={organization.gateId}
                organizationPlaceholderId={organization.placeholderId}
                organizationLockedGateIds={organization.lockedGateIds}
                organizationComponentLabel={organization.componentLabel}
                organizationCalculationMeta={organization.calculationMeta}
                isNodeWithinOrganization={isNodeWithinOrganization}
                insertHighlightedComponentId={insertHighlightState.highlightedComponentId}
                insertHighlightedGateId={insertHighlightState.highlightedGateId}
                draggingNodeId={dragDrop.draggingNodeId}
                visibleGateIds={visibleGateIds}
                onHoverGateIdChange={setHoveredGateId}
                onExpandGate={handleExpandGate}
                onDragStart={dragDrop.handlers.onDragStart}
                selectionHandlers={activeSelection.handlers}
              />
              <DiagramOverlays
                dragGhostNode={dragDrop.ghostNode}
                organizationPlaceholderId={organization.placeholderId}
                organizationComponentLabel={organization.componentLabel}
                organizationCalculationMeta={organization.calculationMeta}
                hoveredGateArea={hoveredGateArea}
                isOrganizationMode={isOrganizationMode}
                onCollapseGate={handleCollapseGate}
                onHoverGateIdChange={setHoveredGateId}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
};