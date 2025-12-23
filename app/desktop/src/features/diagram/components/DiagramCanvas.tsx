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

type DiagramCanvasProps = {
  label?: string;
  isSelectionMode?: boolean;
  isOrganizationMode?: boolean;
  hoveredNodeId?: string | null;
  preselectedNodeId?: string | null;
  selectedNodeId?: string | null;
  onEnterSelectionMode?: () => void;
  onExitSelectionMode?: () => void;
  onNodeHover?: (nodeId: string | null) => void;
  onNodePreselect?: (selection: DiagramNodeSelection) => void;
  onNodeConfirm?: (selection: DiagramNodeSelection) => void;
  onSelectionCancel?: () => void;
};

export const DiagramCanvas = ({
  label = "Canvas",
  isSelectionMode = false,
  isOrganizationMode = false,
  hoveredNodeId = null,
  preselectedNodeId = null,
  selectedNodeId = null,
  onEnterSelectionMode,
  onExitSelectionMode,
  onNodeHover,
  onNodePreselect,
  onNodeConfirm,
  onSelectionCancel,
}: DiagramCanvasProps) => {
  const { cameraStyle, handlers } = useDiagramCamera();
  const { graph, status, errorMessage } = useDiagramGraph();
  const { collapsedGateIdSet, collapseGate, expandGate } = useDiagramView(graph);
  const layout = useMemo(
    () => buildDiagramLayout(graph, collapsedGateIdSet),
    [graph, collapsedGateIdSet]
  );
  const hasDiagram = status === "ready" && layout.nodes.length > 0;
  const [hoveredGateId, setHoveredGateId] = useState<string | null>(null);
  const [hoveredSelectableId, setHoveredSelectableId] =
    useState<string | null>(null);
  const gateAreasById = useMemo(
    () => new Map(layout.gateAreas.map((area) => [area.id, area])),
    [layout.gateAreas]
  );
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
            Modo organización · Placeholder
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
                  return (
                    <div
                      key={`gate-area-${area.id}`}
                      className={`diagram-gate-area${
                        isVisible ? " diagram-gate-area--active" : ""
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
              {layout.nodes.map((node) => {
                const isGate = node.type === "gate" || !!node.isCollapsed;
                const isHovered =
                  isSelectionMode &&
                  (hoveredSelectableId === node.id || hoveredNodeId === node.id);
                const isPreselected =
                  isSelectionMode && preselectedNodeId === node.id;
                const isSelected = isSelectionMode && selectedNodeId === node.id;
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
                    onSelectHover={handleSelectHover}
                    onSelectHoverEnd={handleSelectHoverEnd}
                    onPreselect={handlePreselect}
                    onConfirm={handleConfirm}
                  />
                );
              })}
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
                  <button
                    type="button"
                    className="diagram-gate__collapse-button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => collapseGate(hoveredGateArea.id)}
                    aria-label={`Colapsar gate ${hoveredGateArea.id}`}
                  >
                    -
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};