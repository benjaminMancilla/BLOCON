import { GraphNode } from "../../../../../core/graph";
import { ConnectionContext, DiagramLayoutLine, DiagramLayoutNode, DiagramGateArea } from "../types";
import { normalizeSubtype } from "../utils/anchorCalculations";
import { COMPONENT_SIZE, GATE_PADDING_Y, V_SPACING } from "../utils/constants";

const getNodeRect = (
  nodeId: string,
  gateAreaMap: Map<string, DiagramGateArea>,
  componentMap: Map<string, DiagramLayoutNode>,
  fallbackSize: { width: number; height: number }
) => {
  const component = componentMap.get(nodeId);
  if (component) {
    return { x: component.x, y: component.y, width: component.width, height: component.height };
  }
  const gateArea = gateAreaMap.get(nodeId);
  if (gateArea) {
    return { x: gateArea.x, y: gateArea.y, width: gateArea.width, height: gateArea.height };
  }
  return { x: 0, y: 0, width: fallbackSize.width, height: fallbackSize.height };
};

export const buildOrConnections = (
  nodeId: string,
  context: ConnectionContext,
  gateAreaMap: Map<string, DiagramGateArea>,
  componentMap: Map<string, DiagramLayoutNode>,
  shouldShowArrow: (
    targetNodeId: string,
    nodeMap: Map<string, GraphNode>,
    collapsedGateIds?: Set<string>
  ) => boolean
): DiagramLayoutLine[] => {
  const lines: DiagramLayoutLine[] = [];
  const children = context.childrenMap.get(nodeId) ?? [];
  const gateArea = gateAreaMap.get(nodeId);
  if (!gateArea || children.length === 0) return lines;

  const totalChildrenHeight =
    children
      .map((child) => context.sizeMap.get(child)?.height ?? COMPONENT_SIZE.height)
      .reduce((acc, value) => acc + value, 0) +
    V_SPACING * (children.length - 1);

  const railXLeft = gateArea.x;
  const railXRight = gateArea.x + gateArea.width;
  const railYTop = gateArea.y + GATE_PADDING_Y;
  const firstChildHeight =
    context.sizeMap.get(children[0])?.height ?? COMPONENT_SIZE.height;
  const lastChildHeight =
    context.sizeMap.get(children[children.length - 1])?.height ??
    COMPONENT_SIZE.height;
  const railYBottom = railYTop + totalChildrenHeight;
  const railYStart = railYTop + firstChildHeight / 2;
  const railYEnd = railYBottom - lastChildHeight / 2;

  lines.push({
    x1: railXLeft,
    y1: railYStart,
    x2: railXLeft,
    y2: railYEnd,
    kind: "rail",
  });
  lines.push({
    x1: railXRight,
    y1: railYStart,
    x2: railXRight,
    y2: railYEnd,
    kind: "rail",
  });

  children.forEach((childId) => {
    const childSize = context.sizeMap.get(childId) ?? COMPONENT_SIZE;
    const childRect = getNodeRect(
      childId,
      gateAreaMap,
      componentMap,
      childSize
    );
    const childNode = context.nodeMap.get(childId);
    const midY = childRect.y + childSize.height / 2;

    const childSubtype = normalizeSubtype(childNode);
    const childAnchor = context.anchors.get(childId);

    let leftX: number;
    let rightX: number;

    if (childNode?.type === "gate" && (childSubtype === "or" || childSubtype === "koon")) {
      leftX = childAnchor?.leftX ?? childRect.x;
      rightX = childAnchor?.rightX ?? childRect.x + childSize.width;
    } else {
      leftX = childRect.x;
      rightX = childRect.x + childSize.width;
    }

    lines.push({
      x1: railXLeft,
      y1: midY,
      x2: leftX,
      y2: midY,
      kind: "connector",
      arrow: shouldShowArrow(childId, context.nodeMap, context.collapsedGateIds),
    });
    lines.push({
      x1: rightX,
      y1: midY,
      x2: railXRight,
      y2: midY,
      kind: "connector",
      arrow: false,
    });

  });

  return lines;
};