import { GraphData, GraphNode } from "../../../core/graph";

export type DiagramLayoutNode = {
  id: string;
  type: "component" | "gate";
  subtype?: string | null;
  k?: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  distKind?: string | null;
  reliability?: number | null;
  childCount?: number;
};

export type DiagramLayoutLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: "series" | "rail" | "connector";
};

type LayoutResult = {
  nodes: DiagramLayoutNode[];
  lines: DiagramLayoutLine[];
  width: number;
  height: number;
};

type Size = {
  width: number;
  height: number;
};

const COMPONENT_SIZE: Size = { width: 200, height: 120 };
const GATE_LABEL_SIZE: Size = { width: 180, height: 30 };
const H_SPACING = 56;
const V_SPACING = 32;
const GATE_PADDING_Y = 36;
const RAIL_PADDING = 64;
const LAYOUT_PADDING = 96;

const normalizeSubtype = (node: GraphNode | undefined) =>
  node?.subtype?.toLowerCase() ?? "and";

export const buildDiagramLayout = (graph: GraphData): LayoutResult => {
  const nodeMap = new Map<string, GraphNode>(
    graph.nodes.map((node) => [node.id, node])
  );
  const childrenMap = new Map<string, string[]>();
  graph.edges.forEach((edge) => {
    if (!childrenMap.has(edge.from)) {
      childrenMap.set(edge.from, []);
    }
    childrenMap.get(edge.from)?.push(edge.to);
  });

  const rootId = graph.root ?? graph.nodes[0]?.id ?? null;
  if (!rootId) {
    return { nodes: [], lines: [], width: 0, height: 0 };
  }

  const sizeCache = new Map<string, Size>();
  const measure = (nodeId: string, stack = new Set<string>()): Size => {
    if (sizeCache.has(nodeId)) {
      return sizeCache.get(nodeId) as Size;
    }
    if (stack.has(nodeId)) {
      return COMPONENT_SIZE;
    }
    stack.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (!node || node.type !== "gate") {
      sizeCache.set(nodeId, COMPONENT_SIZE);
      return COMPONENT_SIZE;
    }

    const children = childrenMap.get(nodeId) ?? [];
    if (children.length === 0) {
      const gateSize = {
        width: GATE_LABEL_SIZE.width,
        height: GATE_LABEL_SIZE.height + COMPONENT_SIZE.height,
      };
      sizeCache.set(nodeId, gateSize);
      return gateSize;
    }

    const childSizes = children.map((childId) => measure(childId, new Set(stack)));
    const subtype = normalizeSubtype(node);
    if (subtype === "or" || subtype === "koon") {
      const maxWidth = Math.max(...childSizes.map((child) => child.width));
      const totalHeight =
        childSizes.reduce((acc, child) => acc + child.height, 0) +
        V_SPACING * (childSizes.length - 1);
      const gateSize = {
        width: maxWidth + RAIL_PADDING * 2,
        height: GATE_LABEL_SIZE.height + GATE_PADDING_Y + totalHeight,
      };
      sizeCache.set(nodeId, gateSize);
      return gateSize;
    }

    const totalWidth =
      childSizes.reduce((acc, child) => acc + child.width, 0) +
      H_SPACING * (childSizes.length - 1);
    const maxHeight = Math.max(...childSizes.map((child) => child.height));
    const gateSize = {
      width: totalWidth,
      height: GATE_LABEL_SIZE.height + GATE_PADDING_Y + maxHeight,
    };
    sizeCache.set(nodeId, gateSize);
    return gateSize;
  };

  const layoutNodes: DiagramLayoutNode[] = [];
  const layoutLines: DiagramLayoutLine[] = [];
  const anchorMap = new Map<
    string,
    { leftX: number; rightX: number; centerY: number }
  >();

  const setAnchor = (
    nodeId: string,
    anchor: { leftX: number; rightX: number; centerY: number }
  ) => {
    anchorMap.set(nodeId, anchor);
  };

  const place = (
    nodeId: string,
    originX: number,
    originY: number,
    stack = new Set<string>()
  ) => {
    if (stack.has(nodeId)) return;
    stack.add(nodeId);

    const node = nodeMap.get(nodeId);
    const size = sizeCache.get(nodeId) ?? COMPONENT_SIZE;

    if (!node || node.type !== "gate") {
      layoutNodes.push({
        id: nodeId,
        type: "component",
        x: originX,
        y: originY,
        width: size.width,
        height: size.height,
        distKind: node?.dist?.kind ?? null,
        reliability: node?.reliability ?? null,
      });
      setAnchor(nodeId, {
        leftX: originX,
        rightX: originX + size.width,
        centerY: originY + size.height / 2,
      });
      return;
    }

    const children = childrenMap.get(nodeId) ?? [];
    layoutNodes.push({
      id: nodeId,
      type: "gate",
      subtype: node.subtype,
      k: node.k ?? null,
      childCount: children.length,
      x: originX + (size.width - GATE_LABEL_SIZE.width) / 2,
      y: originY,
      width: GATE_LABEL_SIZE.width,
      height: GATE_LABEL_SIZE.height,
    });

    if (children.length === 0) {
      setAnchor(nodeId, {
        leftX: originX,
        rightX: originX + size.width,
        centerY: originY + size.height / 2,
      });
      return;
    }

    const subtype = normalizeSubtype(node);
    if (subtype === "or" || subtype === "koon") {
      const totalChildrenHeight =
        children
          .map((child) => sizeCache.get(child)?.height ?? COMPONENT_SIZE.height)
          .reduce((acc, value) => acc + value, 0) +
        V_SPACING * (children.length - 1);
      
      // Rails en los bordes del nodo (sin padding interno)
      const railXLeft = originX;
      const railXRight = originX + size.width;
      const railYTop = originY + GATE_LABEL_SIZE.height + GATE_PADDING_Y;
      const railYBottom = railYTop + totalChildrenHeight;
      
      layoutLines.push({
        x1: railXLeft,
        y1: railYTop,
        x2: railXLeft,
        y2: railYBottom,
        kind: "rail",
      });
      layoutLines.push({
        x1: railXRight,
        y1: railYTop,
        x2: railXRight,
        y2: railYBottom,
        kind: "rail",
      });

      setAnchor(nodeId, {
        leftX: railXLeft,
        rightX: railXRight,
        centerY: originY + size.height / 2,
      });

      let cursorY = railYTop;
      children.forEach((childId) => {
        const childSize = sizeCache.get(childId) ?? COMPONENT_SIZE;
        const childX = originX + (size.width - childSize.width) / 2;
        const childY = cursorY;
        place(childId, childX, childY, new Set(stack));
        
        const midY = childY + childSize.height / 2;
        
        // Determinar posiciones de conexión según el tipo de hijo
        const childNode = nodeMap.get(childId);
        const childSubtype = normalizeSubtype(childNode);
        const childAnchor = anchorMap.get(childId);
        
        let leftX: number;
        let rightX: number;
        
        // Para OR/KOON: usar anchors (apuntan a los rails)
        // Para AND o componentes: usar posiciones visuales
        if (childNode?.type === "gate" && (childSubtype === "or" || childSubtype === "koon")) {
          leftX = childAnchor?.leftX ?? childX;
          rightX = childAnchor?.rightX ?? childX + childSize.width;
        } else {
          leftX = childX;
          rightX = childX + childSize.width;
        }
        
        layoutLines.push({
          x1: railXLeft,
          y1: midY,
          x2: leftX,
          y2: midY,
          kind: "connector",
        });
        layoutLines.push({
          x1: rightX,
          y1: midY,
          x2: railXRight,
          y2: midY,
          kind: "connector",
        });
        cursorY += childSize.height + V_SPACING;
      });
      return;
    }

    const maxChildHeight = Math.max(
      ...children.map(
        (childId) => sizeCache.get(childId)?.height ?? COMPONENT_SIZE.height
      )
    );
    let cursorX = originX;
    let previousAnchor: { leftX: number; rightX: number; centerY: number } | null =
      null;
    children.forEach((childId) => {
      const childSize = sizeCache.get(childId) ?? COMPONENT_SIZE;
      const childY =
        originY +
        GATE_LABEL_SIZE.height +
        GATE_PADDING_Y +
        (maxChildHeight - childSize.height) / 2;
      place(childId, cursorX, childY, new Set(stack));
      const nextAnchor = anchorMap.get(childId) ?? {
        leftX: cursorX,
        rightX: cursorX + childSize.width,
        centerY: childY + childSize.height / 2,
      };

      if (previousAnchor) {
        layoutLines.push({
          x1: previousAnchor.rightX,
          y1: previousAnchor.centerY,
          x2: nextAnchor.leftX,
          y2: nextAnchor.centerY,
          kind: "series",
        });
      }

      previousAnchor = nextAnchor;
      cursorX += childSize.width + H_SPACING;
    });

    setAnchor(nodeId, {
      leftX: originX,
      rightX: originX + size.width,
      centerY:
        originY +
        GATE_LABEL_SIZE.height +
        GATE_PADDING_Y +
        maxChildHeight / 2,
    });
  };

  measure(rootId);
  const rootSize = sizeCache.get(rootId) ?? COMPONENT_SIZE;
  place(rootId, LAYOUT_PADDING, LAYOUT_PADDING);

  const bounds = layoutNodes.reduce(
    (acc, node) => {
      acc.maxX = Math.max(acc.maxX, node.x + node.width);
      acc.maxY = Math.max(acc.maxY, node.y + node.height);
      return acc;
    },
    { maxX: 0, maxY: 0 }
  );
  const width = Math.max(rootSize.width + LAYOUT_PADDING * 2, bounds.maxX + LAYOUT_PADDING);
  const height = Math.max(rootSize.height + LAYOUT_PADDING * 2, bounds.maxY + LAYOUT_PADDING);

  return {
    nodes: layoutNodes,
    lines: layoutLines,
    width,
    height,
  };
};