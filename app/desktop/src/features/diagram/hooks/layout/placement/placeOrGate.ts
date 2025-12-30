import { PlacementContext } from "../types";
import { COMPONENT_SIZE, GATE_PADDING_Y, V_SPACING } from "../utils/constants";
import { placeNode } from "./placeTreeHelpers";

export const placeOrGate = (
  nodeId: string,
  originX: number,
  originY: number,
  context: PlacementContext,
  stack: Set<string>,
  depth: number,
  parentGateId: string | null
) => {
  const children = context.childrenMap.get(nodeId) ?? [];
  const size = context.sizeMap.get(nodeId) ?? COMPONENT_SIZE;

  const totalChildrenHeight =
    children
      .map((child) => context.sizeMap.get(child)?.height ?? COMPONENT_SIZE.height)
      .reduce((acc, value) => acc + value, 0) +
    V_SPACING * (children.length - 1);

  const railXLeft = originX;
  const railXRight = originX + size.width;
  const railYTop = originY + GATE_PADDING_Y;

  context.anchors.set(nodeId, {
    leftX: railXLeft,
    rightX: railXRight,
    centerY: railYTop + totalChildrenHeight / 2,
  });

  let cursorY = railYTop;
  children.forEach((childId) => {
    const childSize = context.sizeMap.get(childId) ?? COMPONENT_SIZE;
    const childX = originX + (size.width - childSize.width) / 2;
    const childY = cursorY;
    placeNode(
      childId,
      childX,
      childY,
      context,
      new Set(stack),
      depth + 1,
      nodeId
    );
    cursorY += childSize.height + V_SPACING;
  });
};