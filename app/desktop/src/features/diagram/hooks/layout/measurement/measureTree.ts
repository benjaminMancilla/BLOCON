import { MeasurementContext, Size } from "../types";
import { COMPONENT_SIZE, GATE_LABEL_SIZE } from "../utils/constants";
import { normalizeSubtype } from "../utils/anchorCalculations";
import { measureAndGate } from "./measureAndGate";
import { measureOrGate } from "./measureOrGate";

const measureNode = (
  nodeId: string,
  context: MeasurementContext,
  stack = new Set<string>()
): Size => {
  const { nodeMap, childrenMap, collapsedGateIds, sizeCache } = context;

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
  if (collapsedGateIds?.has(nodeId)) {
    sizeCache.set(nodeId, COMPONENT_SIZE);
    return COMPONENT_SIZE;
  }

  const children = childrenMap.get(nodeId) ?? [];
  if (children.length === 0) {
    const gateSize = {
      width: Math.max(GATE_LABEL_SIZE.width, COMPONENT_SIZE.width),
      height: Math.max(GATE_LABEL_SIZE.height, COMPONENT_SIZE.height),
    };
    sizeCache.set(nodeId, gateSize);
    return gateSize;
  }

  const childSizes = children.map((childId) =>
    measureNode(childId, context, new Set(stack))
  );
  const subtype = normalizeSubtype(node);
  const gateSize =
    subtype === "or" || subtype === "koon"
      ? measureOrGate(childSizes)
      : measureAndGate(childSizes);

  sizeCache.set(nodeId, gateSize);
  return gateSize;
};

export const measureTree = (
  rootId: string,
  context: MeasurementContext
): Map<string, Size> => {
  measureNode(rootId, context);
  return context.sizeCache;
};