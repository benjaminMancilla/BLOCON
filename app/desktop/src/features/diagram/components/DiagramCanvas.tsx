import { useMemo, useState } from "react";
import { DiagramComponentNode } from "./DiagramComponentNode";
import { DiagramGateNode } from "./DiagramGateNode";
import { useDiagramCamera } from "../hooks/useDiagramCamera";
import { useDiagramGraph } from "../hooks/useDiagramGraph";
import { buildDiagramLayout } from "../hooks/useDiagramLayout";

type DiagramCanvasProps = {
  label?: string;
};

export const DiagramCanvas = ({ label = "Canvas" }: DiagramCanvasProps) => {
  const { cameraStyle, handlers } = useDiagramCamera();
  const { graph, status, errorMessage } = useDiagramGraph();
  const layout = useMemo(() => buildDiagramLayout(graph), [graph]);
  const hasDiagram = status === "ready" && layout.nodes.length > 0;
  const [hoveredGateId, setHoveredGateId] = useState<string | null>(null);
  const gateAreasById = useMemo(
    () => new Map(layout.gateAreas.map((area) => [area.id, area])),
    [layout.gateAreas]
  );
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
                <div
                  key={`gate-area-${area.id}`}
                  className="diagram-gate-area"
                  style={{
                    left: area.x,
                    top: area.y,
                    width: area.width,
                    height: area.height,
                    zIndex: area.depth + 1,
                  }}
                  onPointerEnter={() => setHoveredGateId(area.id)}
                  onPointerLeave={() => setHoveredGateId(null)}
                  aria-hidden="true"
                />
              ))}
              <svg
                className="diagram-canvas__edges"
                width={layout.width}
                height={layout.height}
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                aria-hidden="true"
              >
                {layout.lines.map((line, index) => (
                  <line
                    key={`${line.kind}-${index}`}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    className={`diagram-edge diagram-edge--${line.kind}`}
                  />
                ))}
              </svg>
              {layout.nodes.map((node) =>
                node.type === "component" ? (
                  <DiagramComponentNode key={node.id} node={node} />
                ) : (
                  <DiagramGateNode
                    key={node.id}
                    node={node}
                    isLabelVisible={visibleGateIds.has(node.id)}
                  />
                )
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};