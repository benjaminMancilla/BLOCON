import { GraphNode } from "../../../../../core/graph";
import { Size } from "../types";
import { COMPONENT_SIZE, GATE_PADDING_Y, V_SPACING } from "./constants";

export const normalizeSubtype = (node: GraphNode | undefined) =>
  node?.subtype?.toLowerCase() ?? "and";

export const shouldShowArrow = (
  targetNodeId: string,
  nodeMap: Map<string, GraphNode>,
  collapsedGateIds?: Set<string>
): boolean => {
  const targetNode = nodeMap.get(targetNodeId);
  if (!targetNode) return true;
  if (targetNode.type !== "gate") return true;
  if (collapsedGateIds?.has(targetNodeId)) return true;
  const subtype = normalizeSubtype(targetNode);
  if (subtype === "and") return true;
  return false;
};

export const calculateAnchorOffset = (
  childId: string,
  nodeMap: Map<string, GraphNode>,
  childrenMap: Map<string, string[]>,
  sizeMap: Map<string, Size>,
  collapsedGateIds?: Set<string>
): number => {
  const childNode = nodeMap.get(childId);
  const childSize = sizeMap.get(childId) ?? COMPONENT_SIZE;
  if (!childNode || childNode.type !== "gate") {
    return childSize.height / 2;
  }

  if (collapsedGateIds?.has(childId)) {
    return childSize.height / 2;
  }

  const grandChildren = childrenMap.get(childId) ?? [];
  if (grandChildren.length === 0) {
    return childSize.height / 2;
  }

  const childSubtype = normalizeSubtype(childNode);
  if (childSubtype === "or" || childSubtype === "koon") {
    const totalChildrenHeight =
      grandChildren
        .map(
          (grandChildId) => sizeMap.get(grandChildId)?.height ?? COMPONENT_SIZE.height
        )
        .reduce((acc, value) => acc + value, 0) +
      V_SPACING * (grandChildren.length - 1);
    return GATE_PADDING_Y + totalChildrenHeight / 2;
  }

  const maxGrandChildHeight = Math.max(
    ...grandChildren.map(
      (grandChildId) => sizeMap.get(grandChildId)?.height ?? COMPONENT_SIZE.height
    )
  );
  return GATE_PADDING_Y + maxGrandChildHeight / 2;
};