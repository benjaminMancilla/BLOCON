import { GraphNode } from "../../../../../core/graph";
import { ConnectionContext, DiagramLayoutLine, DiagramLayoutNode, DiagramGateArea } from "../types";
import { COMPONENT_SIZE } from "../utils/constants";

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

export const buildAndConnections = (
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
  if (children.length === 0) return lines;

  let previousAnchor: { leftX: number; rightX: number; centerY: number } | null = null;

  children.forEach((childId) => {
    const childSize = context.sizeMap.get(childId) ?? COMPONENT_SIZE;
    const childRect = getNodeRect(
      childId,
      gateAreaMap,
      componentMap,
      childSize
    );

    const nextAnchor = context.anchors.get(childId) ?? {
      leftX: childRect.x,
      rightX: childRect.x + childSize.width,
      centerY: childRect.y + childSize.height / 2,
    };

    if (previousAnchor) {
      lines.push({
        x1: previousAnchor.rightX,
        y1: previousAnchor.centerY,
        x2: nextAnchor.leftX,
        y2: nextAnchor.centerY,
        kind: "series",
        arrow: shouldShowArrow(childId, context.nodeMap, context.collapsedGateIds),
      });
    }

    previousAnchor = nextAnchor;
  });

  return lines;
};