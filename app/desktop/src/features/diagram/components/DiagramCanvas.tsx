import { useEffect, useMemo, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import { DiagramComponentNode } from "./DiagramComponentNode";
import { DiagramCollapsedGateNode } from "./DiagramCollapsedGateNode";
import { CSSProperties } from "react";
import { DiagramGateNode } from "./DiagramGateNode";
import { useDiagramCamera } from "../hooks/useDiagramCamera";
import { useDiagramGraph } from "../hooks/useDiagramGraph";
import { buildDiagramLayout } from "../hooks/useDiagramLayout";
import { useDiagramView } from "../hooks/useDiagramView";
import { buildGateColorVars, resolveGateColor } from "../utils/gateColors";
import type { DiagramNodeSelection } from "../types/selection";
import type { GateType } from "../types/gates";
import type { GraphData } from "../../../core/graph";

const H_SPACING = 56;
const V_SPACING = 32;
const GATE_LABEL_HEIGHT = 30;
const GATE_PADDING_Y = 36;
const PLACEHOLDER_SIZE = { width: 200, height: 120 };

const buildChildrenMap = (graph: GraphData) => {
  const map = new Map<string, string[]>();
  graph.edges.forEach((edge) => {
    if (!map.has(edge.from)) {
      map.set(edge.from, []);
    }
    map.get(edge.from)?.push(edge.to);
  });
  return map;
};

const getDescendantGateIds = (graph: GraphData, gateId: string) => {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const childrenMap = buildChildrenMap(graph);
  const stack = [...(childrenMap.get(gateId) ?? [])];
  const descendants = new Set<string>();

  while (stack.length) {
    const current = stack.pop();
    if (!current || descendants.has(current)) continue;
    descendants.add(current);
    const node = nodeMap.get(current);
    if (node?.type === "gate") {
      const nextChildren = childrenMap.get(current) ?? [];
      stack.push(...nextChildren);
    }
  }

  return [...descendants].filter(
    (id) => nodeMap.get(id)?.type === "gate"
  );
};

type DiagramCanvasProps = {
  label?: string;
  isSelectionMode?: boolean;
  isOrganizationMode?: boolean;
  organizationSelection?: DiagramNodeSelection | null;
  organizationGateType?: GateType | null;
  hoveredNodeId?: string | null;
  preselectedNodeId?: string | null;
  selectedNodeId?: string | null;
  onEnterSelectionMode?: () => void;
  onExitSelectionMode?: () => void;
  onNodeHover?: (nodeId: string | null) => void;
  onNodePreselect?: (selection: DiagramNodeSelection) => void;
  onNodeConfirm?: (selection: DiagramNodeSelection) => void;
  onSelectionCancel?: () => void;
  onOrganizationCancel?: () => void;
};

export const DiagramCanvas = ({
  label = "Canvas",
  isSelectionMode = false,
  isOrganizationMode = false,
  organizationSelection = null,
  organizationGateType = null,
  hoveredNodeId = null,
  preselectedNodeId = null,
  selectedNodeId = null,
  onEnterSelectionMode,
  onExitSelectionMode,
  onNodeHover,
  onNodePreselect,
  onNodeConfirm,
  onSelectionCancel,
  onOrganizationCancel,
}: DiagramCanvasProps) => {
  const { cameraStyle, handlers } = useDiagramCamera();
  const { graph, status, errorMessage } = useDiagramGraph();
  const { collapsedGateIdSet, collapseGate, expandGate } = useDiagramView(graph);
 const organizationGateId = useMemo(() => {
    if (!isOrganizationMode) return null;
    if (organizationSelection?.type === "gate") {
      return organizationSelection.id;
    }
    return null;
  }, [isOrganizationMode, organizationSelection]);
  const organizationDescendantGateIds = useMemo(() => {
    if (!isOrganizationMode || !organizationGateId) return [];
    return getDescendantGateIds(graph, organizationGateId);
  }, [graph, isOrganizationMode, organizationGateId]);
  const organizationCollapsedGateIdSet = useMemo(() => {
    const merged = new Set<string>(collapsedGateIdSet);
    organizationDescendantGateIds.forEach((id) => merged.add(id));
    if (organizationGateId) {
      merged.delete(organizationGateId);
    }
    return merged;
  }, [collapsedGateIdSet, organizationDescendantGateIds, organizationGateId]);
  const layout = useMemo(
    () => buildDiagramLayout(graph, organizationCollapsedGateIdSet),
    [graph, organizationCollapsedGateIdSet]
  );
  const hasDiagram = status === "ready" && layout.nodes.length > 0;
  const [hoveredGateId, setHoveredGateId] = useState<string | null>(null);
  const [hoveredSelectableId, setHoveredSelectableId] =
    useState<string | null>(null);
  const gateAreasById = useMemo(
    () => new Map(layout.gateAreas.map((area) => [area.id, area])),
    [layout.gateAreas]
  );
  const gateParentById = useMemo(
    () => new Map(layout.gateAreas.map((area) => [area.id, area.parentId])),
    [layout.gateAreas]
  );
  const organizationGateArea = useMemo(() => {
    if (!organizationGateId) return null;
    return gateAreasById.get(organizationGateId) ?? null;
  }, [gateAreasById, organizationGateId]);
  const organizationLockedGateIds = useMemo(
    () => new Set(organizationDescendantGateIds),
    [organizationDescendantGateIds]
  );
  const isGateWithinOrganization = useMemo(() => {
    if (!isOrganizationMode || !organizationGateId) {
      return () => false;
    }
    return (gateId: string) => {
      let current: string | null = gateId;
      while (current) {
        if (current === organizationGateId) return true;
        current = gateParentById.get(current) ?? null;
      }
      return false;
    };
  }, [gateParentById, isOrganizationMode, organizationGateId]);
  const isNodeWithinOrganization = useMemo(() => {
    if (!isOrganizationMode || !organizationGateId) {
      return () => false;
    }
    return (nodeId: string, parentGateId: string | null) => {
      if (nodeId === organizationGateId) return true;
      let current: string | null = parentGateId;
      while (current) {
        if (current === organizationGateId) return true;
        current = gateParentById.get(current) ?? null;
      }
      return false;
    };
  }, [gateParentById, isOrganizationMode, organizationGateId]);
  const hoveredGateArea = hoveredGateId
    ? gateAreasById.get(hoveredGateId) ?? null
    : null;
  const organizationSelectionNode = useMemo(() => {
    if (!isOrganizationMode) return null;
    if (organizationSelection?.type !== "component") return null;
    return layout.nodes.find((node) => node.id === organizationSelection.id) ?? null;
  }, [isOrganizationMode, layout.nodes, organizationSelection]);
  const organizationGateSubtype = useMemo(() => {
    if (organizationGateArea?.subtype) return organizationGateArea.subtype;
    if (organizationGateType) return organizationGateType;
    return null;
  }, [organizationGateArea?.subtype, organizationGateType]);
  const virtualGateArea = useMemo(() => {
    if (!isOrganizationMode) return null;
    if (
      organizationSelection?.type !== "component" ||
      !organizationGateType ||
      !organizationSelectionNode
    ) {
      return null;
    }
    const isSeries = organizationGateType === "and";
    const maxChildWidth = Math.max(
      organizationSelectionNode.width,
      PLACEHOLDER_SIZE.width
    );
    const maxChildHeight = Math.max(
      organizationSelectionNode.height,
      PLACEHOLDER_SIZE.height
    );
    const width = isSeries
      ? organizationSelectionNode.width + PLACEHOLDER_SIZE.width + H_SPACING
      : maxChildWidth + 128;
    const height = isSeries
      ? GATE_PADDING_Y + maxChildHeight
      : GATE_PADDING_Y +
        organizationSelectionNode.height +
        PLACEHOLDER_SIZE.height +
        V_SPACING;
    const x = isSeries
      ? organizationSelectionNode.x
      : organizationSelectionNode.x - (width - organizationSelectionNode.width) / 2;
    const y = organizationSelectionNode.y - GATE_PADDING_Y;
    return {
      x,
      y,
      width,
      height,
    };
  }, [
    isOrganizationMode,
    organizationGateType,
    organizationSelection,
    organizationSelectionNode,
  ]);
  const organizationPlaceholder = useMemo(() => {
    if (!isOrganizationMode) return null;
    const subtype = organizationGateSubtype?.toLowerCase() ?? "and";
    if (organizationGateArea && organizationGateId) {
      const childNodes = layout.nodes.filter(
        (node) => node.parentGateId === organizationGateId
      );
      if (subtype === "or" || subtype === "koon") {
        const maxBottom = childNodes.length
          ? Math.max(...childNodes.map((node) => node.y + node.height))
          : organizationGateArea.y + GATE_PADDING_Y;
        return {
          x:
            organizationGateArea.x +
            (organizationGateArea.width - PLACEHOLDER_SIZE.width) / 2,
          y: maxBottom + V_SPACING,
          width: PLACEHOLDER_SIZE.width,
          height: PLACEHOLDER_SIZE.height,
        };
      }
      const maxRight = childNodes.length
        ? Math.max(...childNodes.map((node) => node.x + node.width))
        : organizationGateArea.x;
      const baseY = childNodes.length
        ? childNodes[0].y
        : organizationGateArea.y + GATE_PADDING_Y;
      return {
        x: maxRight + H_SPACING,
        y: baseY,
        width: PLACEHOLDER_SIZE.width,
        height: PLACEHOLDER_SIZE.height,
      };
    }
    if (virtualGateArea && organizationSelectionNode) {
      if (subtype === "or" || subtype === "koon") {
        return {
          x:
            virtualGateArea.x +
            (virtualGateArea.width - PLACEHOLDER_SIZE.width) / 2,
          y:
            organizationSelectionNode.y +
            organizationSelectionNode.height +
            V_SPACING,
          width: PLACEHOLDER_SIZE.width,
          height: PLACEHOLDER_SIZE.height,
        };
      }
      return {
        x:
          organizationSelectionNode.x +
          organizationSelectionNode.width +
          H_SPACING,
        y: organizationSelectionNode.y,
        width: PLACEHOLDER_SIZE.width,
        height: PLACEHOLDER_SIZE.height,
      };
    }
    return null;
  }, [
    isOrganizationMode,
    layout.nodes,
    organizationGateArea,
    organizationGateId,
    organizationGateSubtype,
    organizationSelectionNode,
    virtualGateArea,
  ]);
  const parentGateId = hoveredGateId
    ? gateAreasById.get(hoveredGateId)?.parentId ?? null
    : null;
  const visibleGateIds = useMemo(() => {
    const ids = new Set<string>();
    if (hoveredGateId) ids.add(hoveredGateId);
    if (parentGateId) ids.add(parentGateId);
    return ids;
  }, [hoveredGateId, parentGateId]);

  useEffect(() => {
    if (isSelectionMode) {
      onEnterSelectionMode?.();
    } else {
      onExitSelectionMode?.();
    }
  }, [isSelectionMode, onEnterSelectionMode, onExitSelectionMode]);

  useEffect(() => {
    if (!isSelectionMode) {
      setHoveredSelectableId(null);
      onNodeHover?.(null);
    }
  }, [isSelectionMode, onNodeHover]);

  useEffect(() => {
    if (!isSelectionMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onSelectionCancel?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSelectionMode, onSelectionCancel]);

  useEffect(() => {
    if (!isOrganizationMode) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOrganizationCancel?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOrganizationMode, onOrganizationCancel]);
  const selectionHandlers = useMemo(() => {
    const wrapPointer =
      <T extends (event: PointerEvent<HTMLDivElement>) => void>(handler: T) =>
      (event: PointerEvent<HTMLDivElement>) => {
        const shouldBlock = isSelectionMode && hoveredSelectableId !== null;
        if (shouldBlock) return;
        handler(event);
      };

    const wrapWheel =
      <T extends (event: WheelEvent<HTMLDivElement>) => void>(handler: T) =>
      (event: WheelEvent<HTMLDivElement>) => {
        const shouldBlock = isSelectionMode && hoveredSelectableId !== null;
        if (shouldBlock) return;
        handler(event);
      };

    return {
      onPointerDown: wrapPointer(handlers.onPointerDown),
      onPointerMove: wrapPointer(handlers.onPointerMove),
      onPointerUp: wrapPointer(handlers.onPointerUp),
      onPointerLeave: wrapPointer(handlers.onPointerLeave),
      onWheel: wrapWheel(handlers.onWheel),
    };
  }, [handlers, hoveredSelectableId, isSelectionMode]);

  const toSelection = useMemo(
    () => (nodeId: string, isGate: boolean): DiagramNodeSelection => ({
      id: nodeId,
      type: isGate ? "gate" : "component",
    }),
    []
  );

  const organizationIndicator = useMemo(() => {
    if (!isOrganizationMode) return null;
    if (organizationGateId) {
      return `Organizando ${organizationGateId}`;
    }
    if (organizationGateType) {
      return `Organizando nuevo ${organizationGateType.toUpperCase()}`;
    }
    return "Organizando";
  }, [isOrganizationMode, organizationGateId, organizationGateType]);
  return (
    <section className="diagram-canvas" aria-label={label}>
      <div
        className={`diagram-canvas__surface${
          isSelectionMode ? " diagram-canvas__surface--selection" : ""
        }${isOrganizationMode ? " diagram-canvas__surface--organization" : ""}`}
        {...selectionHandlers}
      >
        {isOrganizationMode ? (
          <div className="diagram-canvas__mode-indicator">
            {organizationIndicator}
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
              {layout.gateAreas.map((area) => (
                (() => {
                  const isVisible = visibleGateIds.has(area.id);
                  const gateColor = resolveGateColor(area.subtype, area.color ?? null);
                  const colorVars = buildGateColorVars(gateColor) as CSSProperties;
                  const isOrganizingGate =
                    isOrganizationMode && organizationGateId === area.id;
                  const isWithinOrganization =
                    isOrganizationMode && organizationGateId
                      ? isGateWithinOrganization(area.id)
                      : !isOrganizationMode &&
                        organizationSelection?.type === "component" &&
                        !!organizationSelectionNode
                        ? area.id === organizationSelectionNode.parentGateId
                        : false;
                  const shouldDim =
                    isOrganizationMode &&
                    organizationGateId &&
                    !isWithinOrganization;
                  return (
                    <div
                      key={`gate-area-${area.id}`}
                      className={`diagram-gate-area${
                        isVisible ? " diagram-gate-area--active" : ""
                      }${isOrganizingGate ? " diagram-gate-area--organization" : ""}${
                        shouldDim ? " diagram-gate-area--dimmed" : ""
                      }`}
                      data-gate-area-id={area.id}
                      style={{
                        left: area.x,
                        top: area.y,
                        width: area.width,
                        height: area.height,
                        zIndex: area.depth,
                        ...colorVars,
                      }}
                      onPointerEnter={() => setHoveredGateId(area.id)}
                      onPointerLeave={(event) => {
                        const nextTarget = event.relatedTarget as HTMLElement | null;
                        if (
                          nextTarget?.closest(
                            `[data-collapse-hitbox="${area.id}"]`
                          )
                        ) {
                          return;
                        }
                        setHoveredGateId(null);
                      }}
                      aria-hidden="true"
                    />
                  );
                })()
              ))}
              <svg
                className="diagram-canvas__edges"
                width={layout.width}
                height={layout.height}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="diagram-arrow"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path
                      d="M0,0 L6,3 L0,6 Z"
                      className="diagram-edge__arrow"
                    />
                  </marker>
                </defs>
                {layout.lines.map((line, index) => (
                  <line
                    key={`${line.kind}-${index}`}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    markerEnd={
                      line.kind === "rail" ? undefined : "url(#diagram-arrow)"
                    }
                    className={`diagram-edge diagram-edge--${line.kind}`}
                  />
                ))}
              </svg>     
              {isOrganizationMode && virtualGateArea && (
                <div
                  className="diagram-gate-area diagram-gate-area--organization diagram-gate-area--virtual"
                  style={{
                    left: virtualGateArea.x,
                    top: virtualGateArea.y,
                    width: virtualGateArea.width,
                    height: virtualGateArea.height,
                  }}
                  aria-hidden="true"
                />
              )}
              {isOrganizationMode && virtualGateArea && organizationGateType && (
                (() => {
                  const gateColor = resolveGateColor(organizationGateType, null);
                  const colorVars = buildGateColorVars(gateColor) as CSSProperties;
                  return (
                    <div
                      className="diagram-node diagram-node--gate diagram-node--organization"
                      style={{
                        left:
                          virtualGateArea.x +
                          (virtualGateArea.width - 180) / 2,
                        top: virtualGateArea.y,
                        width: 180,
                        height: GATE_LABEL_HEIGHT,
                        zIndex: 1200,
                        ...colorVars,
                      }}
                      aria-hidden="true"
                    >
                      <span className="diagram-gate__label">
                        Nuevo {organizationGateType.toUpperCase()}
                      </span>
                    </div>
                  );
                })()
              )} 
              {layout.nodes.map((node) => {
                const isGate = node.type === "gate" || !!node.isCollapsed;
                const isHovered =
                  isSelectionMode &&
                  (hoveredSelectableId === node.id || hoveredNodeId === node.id);
                const isPreselected =
                  isSelectionMode && preselectedNodeId === node.id;
                const isSelected = isSelectionMode && selectedNodeId === node.id;
                const isDimmed = isOrganizationMode
                  ? organizationGateId
                    ? !isNodeWithinOrganization(node.id, node.parentGateId ?? null)
                    : organizationSelectionNode
                      ? node.id !== organizationSelectionNode.id
                      : false
                  : false;
                const isLocked =
                  isOrganizationMode && organizationLockedGateIds.has(node.id);
                const handleSelectHover = () => {
                  if (!isSelectionMode) return;
                  setHoveredSelectableId(node.id);
                  onNodeHover?.(node.id);
                };
                const handleSelectHoverEnd = () => {
                  if (!isSelectionMode) return;
                  setHoveredSelectableId(null);
                  onNodeHover?.(null);
                };
                const handlePreselect = () => {
                  if (!isSelectionMode) return;
                  onNodePreselect?.(toSelection(node.id, isGate));
                };
                const handleConfirm = () => {
                  if (!isSelectionMode) return;
                  onNodeConfirm?.(toSelection(node.id, isGate));
                };

                return node.type === "component" ? (
                  node.isCollapsed ? (
                    <DiagramCollapsedGateNode
                      key={node.id}
                      node={node}
                      onExpand={expandGate}
                      onHoverStart={setHoveredGateId}
                      onHoverEnd={() => setHoveredGateId(null)}
                      isSelectionMode={isSelectionMode}
                      isHovered={isHovered}
                      isPreselected={isPreselected}
                      isSelected={isSelected}
                      isDimmed={isDimmed}
                      isOrganizationLocked={isLocked}
                      allowExpand={!isLocked}
                      onSelectHover={handleSelectHover}
                      onSelectHoverEnd={handleSelectHoverEnd}
                      onPreselect={handlePreselect}
                      onConfirm={handleConfirm}
                    />
                  ) : (
                    <DiagramComponentNode
                      key={node.id}
                      node={node}
                      onHoverStart={setHoveredGateId}
                      onHoverEnd={() => setHoveredGateId(null)}
                      isSelectionMode={isSelectionMode}
                      isHovered={isHovered}
                      isPreselected={isPreselected}
                      isSelected={isSelected}
                      isDimmed={isDimmed}
                      onSelectHover={handleSelectHover}
                      onSelectHoverEnd={handleSelectHoverEnd}
                      onPreselect={handlePreselect}
                      onConfirm={handleConfirm}
                    />
                  )
                ) : (
                  <DiagramGateNode
                    key={node.id}
                    node={node}
                    isLabelVisible={visibleGateIds.has(node.id)}
                    onHoverStart={setHoveredGateId}
                    onHoverEnd={() => setHoveredGateId(null)}
                    isSelectionMode={isSelectionMode}
                    isHovered={isHovered}
                    isPreselected={isPreselected}
                    isSelected={isSelected}
                    isDimmed={isDimmed}
                    isOrganizationLocked={isLocked}
                    onSelectHover={handleSelectHover}
                    onSelectHoverEnd={handleSelectHoverEnd}
                    onPreselect={handlePreselect}
                    onConfirm={handleConfirm}
                  />
                );
              })}
              {isOrganizationMode && organizationPlaceholder && (
                <div
                  className="diagram-node diagram-node--component diagram-node--organization-placeholder"
                  style={{
                    left: organizationPlaceholder.x,
                    top: organizationPlaceholder.y,
                    width: organizationPlaceholder.width,
                    height: organizationPlaceholder.height,
                  }}
                  aria-hidden="true"
                >
                  <div className="diagram-node__title">Nuevo componente</div>
                  <div className="diagram-node__meta">
                    <span className="diagram-node__icon">★</span>
                    <span className="diagram-node__meta-text">Pendiente</span>
                  </div>
                </div>
              )}
              {hoveredGateArea && (
                <div
                  className="diagram-gate__collapse-hitbox"
                  data-collapse-hitbox={hoveredGateArea.id}
                  style={{
                    left: hoveredGateArea.x + hoveredGateArea.width - 36,
                    top: hoveredGateArea.y + 4,
                  }}
                  onPointerEnter={() => setHoveredGateId(hoveredGateArea.id)}
                  onPointerLeave={(event) => {
                    const nextTarget = event.relatedTarget as HTMLElement | null;
                    if (
                      nextTarget?.closest(
                        `[data-gate-area-id="${hoveredGateArea.id}"]`
                      )
                    ) {
                      return;
                    }
                    setHoveredGateId(null);
                  }}
                >
                  {!(isOrganizationMode &&
                    organizationLockedGateIds.has(hoveredGateArea.id)) ? (
                    <button
                      type="button"
                      className="diagram-gate__collapse-button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => collapseGate(hoveredGateArea.id)}
                      aria-label={`Colapsar gate ${hoveredGateArea.id}`}
                    >
                      -
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};