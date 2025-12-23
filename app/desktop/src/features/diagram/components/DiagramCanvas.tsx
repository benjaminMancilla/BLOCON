import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { OrganizationUiState } from "../types/organization";
import type { GraphData } from "../../../core/graph";

const ORGANIZATION_PADDING = 32;
const ORGANIZATION_GATE_ID_PREFIX = "__organization_gate__";
const ORGANIZATION_COMPONENT_ID_PREFIX = "__organization_component__";

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

const normalizeGateType = (value: string | null | undefined): GateType | null => {
  const normalized = value?.toLowerCase() ?? null;
  if (normalized === "and" || normalized === "or" || normalized === "koon") {
    return normalized;
  }
  return null;
};

const getDirectChildren = (graph: GraphData, gateId: string) =>
  graph.edges.filter((edge) => edge.from === gateId).map((edge) => edge.to);

const applyGateOrder = (
  graph: GraphData,
  gateId: string,
  order: string[]
) => {
  const children = getDirectChildren(graph, gateId);
  const orderSet = new Set(order);
  const normalizedOrder = [
    ...order.filter((id) => children.includes(id)),
    ...children.filter((id) => !orderSet.has(id)),
  ];
  const edges = graph.edges.filter((edge) => edge.from !== gateId);
  normalizedOrder.forEach((childId) => {
    edges.push({ from: gateId, to: childId });
  });
  return {
    ...graph,
    edges,
  };
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
  onOrganizationStateChange?: (state: OrganizationUiState | null) => void;
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
  onOrganizationStateChange,
}: DiagramCanvasProps) => {
  const { cameraStyle, handlers, camera } = useDiagramCamera();
  const { graph, status, errorMessage } = useDiagramGraph();
  const { collapsedGateIdSet, collapseGate, expandGate } = useDiagramView(graph);
  const {
    graph: organizationBaseGraph,
    organizationGateId,
    organizationPlaceholderId,
    isVirtualOrganizationGate,
  } = useMemo(() => {
    if (!isOrganizationMode || !organizationSelection) {
      return {
        graph,
        organizationGateId: null,
        organizationPlaceholderId: null,
        isVirtualOrganizationGate: false,
      };
    }

    if (!graph.nodes.some((node) => node.id === organizationSelection.id)) {
      return {
        graph,
        organizationGateId: null,
        organizationPlaceholderId: null,
        isVirtualOrganizationGate: false,
      };
    }

    const existingIds = new Set(graph.nodes.map((node) => node.id));
    const createUniqueId = (prefix: string) => {
      let candidate = prefix;
      let index = 1;
      while (existingIds.has(candidate)) {
        candidate = `${prefix}-${index}`;
        index += 1;
      }
      existingIds.add(candidate);
      return candidate;
    };

    const placeholderId = createUniqueId(ORGANIZATION_COMPONENT_ID_PREFIX);
    const nodes = [
      ...graph.nodes,
      {
        id: placeholderId,
        type: "component",
      },
    ];
    const edges = [...graph.edges];
    let root = graph.root ?? null;
    let nextOrganizationGateId: string | null = null;
    let isVirtualGate = false;

    if (organizationSelection.type === "gate") {
      nextOrganizationGateId = organizationSelection.id;
      edges.push({ from: nextOrganizationGateId, to: placeholderId });
    } else if (organizationSelection.type === "component" && organizationGateType) {
      isVirtualGate = true;
      const gateId = createUniqueId(ORGANIZATION_GATE_ID_PREFIX);
      nextOrganizationGateId = gateId;
      nodes.push({
        id: gateId,
        type: "gate",
        subtype: organizationGateType,
      });
      const parentEdgeIndex = edges.findIndex(
        (edge) => edge.to === organizationSelection.id
      );
      if (parentEdgeIndex >= 0) {
        const parentId = edges[parentEdgeIndex].from;
        edges.splice(parentEdgeIndex, 1, { from: parentId, to: gateId });
      } else if (root === organizationSelection.id) {
        root = gateId;
      }
      edges.push({ from: gateId, to: organizationSelection.id });
      edges.push({ from: gateId, to: placeholderId });
    } else {
      return {
        graph,
        organizationGateId: null,
        organizationPlaceholderId: null,
        isVirtualOrganizationGate: false,
      };
    }

    return {
      graph: {
        ...graph,
        nodes,
        edges,
        root,
      },
      organizationGateId: nextOrganizationGateId,
      organizationPlaceholderId: placeholderId,
      isVirtualOrganizationGate: isVirtualGate,
    };
  }, [graph, isOrganizationMode, organizationGateType, organizationSelection]);
  const [organizationOrder, setOrganizationOrder] = useState<string[] | null>(
    null,
  );
  const [organizationInitialOrder, setOrganizationInitialOrder] = useState<
    string[] | null
  >(null);
  const organizationGateIdRef = useRef<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const defaultOrganizationOrder = useMemo(() => {
    if (!isOrganizationMode || !organizationGateId) return [];
    return getDirectChildren(organizationBaseGraph, organizationGateId);
  }, [isOrganizationMode, organizationBaseGraph, organizationGateId]);

  useEffect(() => {
    if (!isOrganizationMode || !organizationGateId) {
      organizationGateIdRef.current = null;
      setOrganizationOrder(null);
      setOrganizationInitialOrder(null);
      return;
    }

    if (organizationGateIdRef.current !== organizationGateId) {
      organizationGateIdRef.current = organizationGateId;
      setOrganizationOrder(defaultOrganizationOrder);
      setOrganizationInitialOrder(defaultOrganizationOrder);
      return;
    }

    if (!organizationOrder) {
      setOrganizationOrder(defaultOrganizationOrder);
    }
    if (!organizationInitialOrder) {
      setOrganizationInitialOrder(defaultOrganizationOrder);
    }
  }, [
    defaultOrganizationOrder,
    isOrganizationMode,
    organizationGateId,
    organizationInitialOrder,
    organizationOrder,
  ]);
  const organizationGraph = useMemo(() => {
    if (!isOrganizationMode || !organizationGateId) return organizationBaseGraph;
    if (!organizationOrder || organizationOrder.length === 0) {
      return organizationBaseGraph;
    }
    return applyGateOrder(
      organizationBaseGraph,
      organizationGateId,
      organizationOrder
    );
  }, [
    isOrganizationMode,
    organizationBaseGraph,
    organizationGateId,
    organizationOrder,
  ]);
  const organizationGateSubtype = useMemo(() => {
    if (!organizationGateId) return null;
    const node = organizationBaseGraph.nodes.find(
      (entry) => entry.id === organizationGateId
    );
    return normalizeGateType(node?.subtype ?? organizationGateType ?? null);
  }, [organizationBaseGraph.nodes, organizationGateId, organizationGateType]);

  useEffect(() => {
    if (
      !isOrganizationMode ||
      !organizationGateId ||
      !organizationPlaceholderId ||
      !organizationOrder ||
      !organizationInitialOrder
    ) {
      onOrganizationStateChange?.(null);
      return;
    }

    onOrganizationStateChange?.({
      gateId: organizationGateId,
      placeholderId: organizationPlaceholderId,
      gateSubtype: organizationGateSubtype,
      order: organizationOrder,
      initialOrder: organizationInitialOrder,
    });
  }, [
    isOrganizationMode,
    onOrganizationStateChange,
    organizationGateId,
    organizationGateSubtype,
    organizationInitialOrder,
    organizationOrder,
    organizationPlaceholderId,
  ]);
  const organizationDescendantGateIds = useMemo(() => {
    if (!isOrganizationMode || !organizationGateId) return [];
    return getDescendantGateIds(organizationGraph, organizationGateId);
  }, [organizationGraph, isOrganizationMode, organizationGateId]);
  const organizationCollapsedGateIdSet = useMemo(() => {
    const merged = new Set<string>(collapsedGateIdSet);
    organizationDescendantGateIds.forEach((id) => merged.add(id));
    if (organizationGateId) {
      merged.delete(organizationGateId);
    }
    return merged;
  }, [collapsedGateIdSet, organizationDescendantGateIds, organizationGateId]);
  const layout = useMemo(
    () => buildDiagramLayout(organizationGraph, organizationCollapsedGateIdSet),
    [organizationGraph, organizationCollapsedGateIdSet]
  );
  const hasDiagram = status === "ready" && layout.nodes.length > 0;
  const layoutNodeById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout.nodes]
  );
  const organizationChildIds = useMemo(() => {
    if (!organizationGateId) return new Set<string>();
    return new Set(
      layout.nodes
        .filter((node) => node.parentGateId === organizationGateId)
        .map((node) => node.id)
    );
  }, [layout.nodes, organizationGateId]);
  const [hoveredGateId, setHoveredGateId] = useState<string | null>(null);
  const [hoveredSelectableId, setHoveredSelectableId] =
    useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragPointerId, setDragPointerId] = useState<number | null>(null);
  const [dragGhostOffset, setDragGhostOffset] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [dragGhostPosition, setDragGhostPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
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
  const organizationArea = useMemo(() => {
    if (!isOrganizationMode || !organizationGateArea) return null;
    const expand = (area: { x: number; y: number; width: number; height: number }) => ({
      x: area.x - ORGANIZATION_PADDING,
      y: area.y - ORGANIZATION_PADDING,
      width: area.width + ORGANIZATION_PADDING * 2,
      height: area.height + ORGANIZATION_PADDING * 2,
    });
    return expand(organizationGateArea);
  }, [
    isOrganizationMode,
    organizationGateArea,
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
  const organizationAxis = useMemo(() => {
    if (!organizationGateSubtype) return "horizontal";
    if (organizationGateSubtype === "or" || organizationGateSubtype === "koon") {
      return "vertical";
    }
    return "horizontal";
  }, [organizationGateSubtype]);
  const getDiagramPoint = useCallback(
    (event: PointerEvent<HTMLDivElement> | globalThis.PointerEvent) => {
      const viewport = viewportRef.current;
      if (!viewport) return null;
      const rect = viewport.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left - camera.x) / camera.scale,
        y: (event.clientY - rect.top - camera.y) / camera.scale,
      };
    },
    [camera.scale, camera.x, camera.y]
  );

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
    if (isOrganizationMode) return;
    setDraggingNodeId(null);
    setDragPointerId(null);
    setDragGhostOffset(null);
    setDragGhostPosition(null);
  }, [isOrganizationMode]);

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

  const handleOrganizationDragStart = useCallback(
    (
      event: PointerEvent<HTMLDivElement>,
      nodeId: string
    ) => {
      if (!isOrganizationMode || !organizationGateId) return;
      if (!organizationChildIds.has(nodeId)) return;
      event.stopPropagation();
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = getDiagramPoint(event);
      const node = layoutNodeById.get(nodeId);
      if (point && node) {
        setDragGhostOffset({
          x: point.x - node.x,
          y: point.y - node.y,
        });
        setDragGhostPosition({ x: node.x, y: node.y });
      } else {
        setDragGhostOffset(null);
        setDragGhostPosition(null);
      }
      setDraggingNodeId(nodeId);
      setDragPointerId(event.pointerId);
    },
    [
      getDiagramPoint,
      isOrganizationMode,
      layoutNodeById,
      organizationChildIds,
      organizationGateId,
    ]
  );

useEffect(() => {
    if (!draggingNodeId || dragPointerId === null) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== dragPointerId) return;
      const point = getDiagramPoint(event);
      if (!point) return;
          if (dragGhostOffset) {
        setDragGhostPosition({
          x: point.x - dragGhostOffset.x,
          y: point.y - dragGhostOffset.y,
        });
      }
      if (!organizationArea) return;
      const isInside =
        point.x >= organizationArea.x &&
        point.x <= organizationArea.x + organizationArea.width &&
        point.y >= organizationArea.y &&
        point.y <= organizationArea.y + organizationArea.height;
      if (!isInside) return;

      const currentOrder = organizationOrder ?? defaultOrganizationOrder;
      if (!currentOrder.includes(draggingNodeId)) return;
      const remaining = currentOrder.filter((id) => id !== draggingNodeId);
      const axisValue = organizationAxis === "vertical" ? point.y : point.x;
      let insertIndex = remaining.length;
      for (let index = 0; index < remaining.length; index += 1) {
        const node = layoutNodeById.get(remaining[index]);
        if (!node) continue;
        const center =
          organizationAxis === "vertical"
            ? node.y + node.height / 2
            : node.x + node.width / 2;
        if (axisValue < center) {
          insertIndex = index;
          break;
        }
      }
      const nextOrder = [
        ...remaining.slice(0, insertIndex),
        draggingNodeId,
        ...remaining.slice(insertIndex),
      ];
      const hasChanged =
        nextOrder.length !== currentOrder.length ||
        nextOrder.some((value, index) => value !== currentOrder[index]);
      if (hasChanged) {
        setOrganizationOrder(nextOrder);
      }
    };

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      if (event.pointerId !== dragPointerId) return;
      setDraggingNodeId(null);
      setDragPointerId(null);
      setDragGhostOffset(null);
      setDragGhostPosition(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    defaultOrganizationOrder,
    dragPointerId,
    draggingNodeId,
    dragGhostOffset,
    getDiagramPoint,
    layoutNodeById,
    organizationArea,
    organizationAxis,
    organizationOrder,
  ]);

  const toSelection = useMemo(
    () => (nodeId: string, isGate: boolean): DiagramNodeSelection => ({
      id: nodeId,
      type: isGate ? "gate" : "component",
    }),
    []
  );

  const organizationIndicator = useMemo(() => {
    if (!isOrganizationMode) return null;
    if (organizationGateId && !isVirtualOrganizationGate) {
      return `Organizando ${organizationGateId}`;
    }
    if (organizationGateType) {
      return `Organizando nuevo ${organizationGateType.toUpperCase()}`;
    }
    return "Organizando";
  }, [isOrganizationMode, organizationGateId, organizationGateType]);

  const dragGhostNode = useMemo(() => {
    if (!draggingNodeId || !dragGhostPosition) return null;
    const node = layoutNodeById.get(draggingNodeId);
    if (!node) return null;
    return {
      ...node,
      x: dragGhostPosition.x,
      y: dragGhostPosition.y,
    };
  }, [dragGhostPosition, draggingNodeId, layoutNodeById]);
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
        <div
          className="diagram-canvas__viewport"
          style={cameraStyle}
          ref={viewportRef}
        >
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
                  const activeArea = isOrganizingGate && organizationArea
                    ? organizationArea
                    : area;
                  const isWithinOrganization =
                    isOrganizationMode && organizationGateId
                      ? isGateWithinOrganization(area.id)
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
                        left: activeArea.x,
                        top: activeArea.y,
                        width: activeArea.width,
                        height: activeArea.height,
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
                const isPlaceholder =
                  organizationPlaceholderId !== null &&
                  node.id === organizationPlaceholderId;
                const isGate = node.type === "gate" || !!node.isCollapsed;
                const isHovered =
                  isSelectionMode &&
                  (hoveredSelectableId === node.id || hoveredNodeId === node.id);
                const isPreselected =
                  isSelectionMode && preselectedNodeId === node.id;
                const isSelected = isSelectionMode && selectedNodeId === node.id;
                const isDimmed =
                  isOrganizationMode && organizationGateId
                    ? !isNodeWithinOrganization(node.id, node.parentGateId ?? null)
                    : false;
                const isDirectChild =
                  isOrganizationMode && organizationGateId
                    ? node.parentGateId === organizationGateId
                    : false;
                const isLocked =
                  isOrganizationMode &&
                  organizationLockedGateIds.has(node.id) &&
                  node.parentGateId !== organizationGateId;
                const isDraggable = isDirectChild;
                const isDragging = draggingNodeId === node.id;
                const isOrganizationDragging = isOrganizationMode && isDragging;
                const isOrganizationDraggable =
                  isOrganizationMode && isDraggable;
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

                if (isPlaceholder) {
                  return (
                    <div
                      key={node.id}
                      className={`diagram-node diagram-node--component diagram-node--organization-placeholder${
                        isDraggable ? " diagram-node--draggable" : ""
                      }${
                        isOrganizationDragging
                          ? " diagram-node--organization-drag-placeholder"
                          : ""
                      }${
                        isOrganizationDraggable
                          ? " diagram-node--organization-draggable"
                          : ""
                      }`}
                      style={{
                        left: node.x,
                        top: node.y,
                        width: node.width,
                        height: node.height,
                      }}
                      onPointerDown={(event) => {
                        if (!isDraggable) return;
                        handleOrganizationDragStart(event, node.id);
                      }}
                      aria-hidden="true"
                    >
                      <div className="diagram-node__title">Nuevo componente</div>
                      <div className="diagram-node__meta">
                        <span className="diagram-node__icon">★</span>
                        <span className="diagram-node__meta-text">Pendiente</span>
                      </div>
                    </div>
                  );
                }
                
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
                      isDraggable={isDraggable}
                      isDragging={isOrganizationDragging}
                      isOrganizationDraggable={isOrganizationDraggable}
                      allowExpand={
                        !isLocked &&
                        !(isOrganizationMode && organizationGateId === node.id)
                      }
                      onDragStart={(event) =>
                        handleOrganizationDragStart(event, node.id)
                      }
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
                      isDraggable={isDraggable}
                      isDragging={isOrganizationDragging}
                      isOrganizationDraggable={isOrganizationDraggable}
                      onDragStart={(event) =>
                        handleOrganizationDragStart(event, node.id)
                      }
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
                    isDraggable={isDraggable}
                    isDragging={isOrganizationDragging}
                    isOrganizationDraggable={isOrganizationDraggable}
                    onDragStart={(event) =>
                      handleOrganizationDragStart(event, node.id)
                    }
                    onSelectHover={handleSelectHover}
                    onSelectHoverEnd={handleSelectHoverEnd}
                    onPreselect={handlePreselect}
                    onConfirm={handleConfirm}
                  />
                );
              })}
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
                    (organizationLockedGateIds.has(hoveredGateArea.id) ||
                      hoveredGateArea.id === organizationGateId)) ? (
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