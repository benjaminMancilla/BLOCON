import { PlacementContext } from "../types";
import { calculateAnchorOffset } from "../utils/anchorCalculations";
import { COMPONENT_SIZE, GATE_PADDING_Y, H_SPACING } from "../utils/constants";
import { placeNode } from "./placeTreeHelpers";

export const placeAndGate = (
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

  const maxChildHeight = Math.max(
    ...children.map(
      (childId) => context.sizeMap.get(childId)?.height ?? COMPONENT_SIZE.height
    )
  );
  const baselineY = originY + GATE_PADDING_Y + maxChildHeight / 2;
  let cursorX = originX;

  children.forEach((childId) => {
    const childSize = context.sizeMap.get(childId) ?? COMPONENT_SIZE;
    const childY =
      baselineY -
      calculateAnchorOffset(
        childId,
        context.nodeMap,
        context.childrenMap,
        context.sizeMap,
        context.collapsedGateIds
      );

    placeNode(
      childId,
      cursorX,
      childY,
      context,
      new Set(stack),
      depth + 1,
      nodeId
    );

    cursorX += childSize.width + H_SPACING;
  });

  context.anchors.set(nodeId, {
    leftX: originX,
    rightX: originX + size.width,
    centerY: originY + GATE_PADDING_Y + maxChildHeight / 2,
  });
};