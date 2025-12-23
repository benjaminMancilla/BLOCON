import { useMemo, useState } from "react";
import { DiagramComponentNode } from "./DiagramComponentNode";
import { DiagramCollapsedGateNode } from "./DiagramCollapsedGateNode";
import { CSSProperties } from "react";
import { DiagramGateNode } from "./DiagramGateNode";
import { useDiagramCamera } from "../hooks/useDiagramCamera";
import { useDiagramGraph } from "../hooks/useDiagramGraph";
import { buildDiagramLayout } from "../hooks/useDiagramLayout";
import { useDiagramView } from "../hooks/useDiagramView";
import { buildGateColorVars, resolveGateColor } from "../utils/gateColors";

type DiagramCanvasProps = {
  label?: string;
};

export const DiagramCanvas = ({ label = "Canvas" }: DiagramCanvasProps) => {
  const { cameraStyle, handlers } = useDiagramCamera();
  const { graph, status, errorMessage } = useDiagramGraph();
  const { collapsedGateIdSet, collapseGate, expandGate } = useDiagramView(graph);
  const layout = useMemo(
    () => buildDiagramLayout(graph, collapsedGateIdSet),
    [graph, collapsedGateIdSet]
  );
  const hasDiagram = status === "ready" && layout.nodes.length > 0;
  const [hoveredGateId, setHoveredGateId] = useState<string | null>(null);
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

  return (
    <section className="diagram-canvas" aria-label={label}>
      <div className="diagram-canvas__surface" {...handlers}>
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
              {layout.nodes.map((node) =>
                node.type === "component" ? (
                  node.isCollapsed ? (
                    <DiagramCollapsedGateNode
                      key={node.id}
                      node={node}
                      onExpand={expandGate}
                      onHoverStart={setHoveredGateId}
                      onHoverEnd={() => setHoveredGateId(null)}
                    />
                  ) : (
                    <DiagramComponentNode
                      key={node.id}
                      node={node}
                      onHoverStart={setHoveredGateId}
                      onHoverEnd={() => setHoveredGateId(null)}
                    />
                  )
                ) : (
                  <DiagramGateNode
                    key={node.id}
                    node={node}
                    isLabelVisible={visibleGateIds.has(node.id)}
                    onHoverStart={setHoveredGateId}
                    onHoverEnd={() => setHoveredGateId(null)}
                  />
                )
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