import { PlacementContext } from "../types";
import { COMPONENT_SIZE, GATE_LABEL_SIZE } from "../utils/constants";
import { placeAndGate } from "./placeAndGate";
import { placeOrGate } from "./placeOrGate";
import { normalizeSubtype } from "../utils/anchorCalculations";

const setAnchor = (
  context: PlacementContext,
  nodeId: string,
  anchor: { leftX: number; rightX: number; centerY: number }
) => {
  context.anchors.set(nodeId, anchor);
};

const placeComponent = (
  nodeId: string,
  originX: number,
  originY: number,
  context: PlacementContext,
  parentGateId: string | null
) => {
  const node = context.nodeMap.get(nodeId);
  const size = context.sizeMap.get(nodeId) ?? COMPONENT_SIZE;
  context.nodes.push({
    id: nodeId,
    type: "component",
    label: node?.label ?? null,
    name: node?.name ?? null,
    parentGateId,
    x: originX,
    y: originY,
    width: size.width,
    height: size.height,
    distKind: node?.dist?.kind ?? null,
    reliability: node?.reliability ?? null,
  });
  setAnchor(context, nodeId, {
    leftX: originX,
    rightX: originX + size.width,
    centerY: originY + size.height / 2,
  });
};

const placeCollapsedGate = (
  nodeId: string,
  originX: number,
  originY: number,
  context: PlacementContext,
  parentGateId: string | null
) => {
  const node = context.nodeMap.get(nodeId);
  const size = context.sizeMap.get(nodeId) ?? COMPONENT_SIZE;
  context.nodes.push({
    id: nodeId,
    type: "component",
    subtype: node?.subtype ?? null,
    k: node?.k ?? null,
    label: node?.label ?? null,
    name: node?.name ?? null,
    color: node?.color ?? null,
    reliability: node?.reliability ?? null,
    childCount: context.childrenMap.get(nodeId)?.length ?? 0,
    parentGateId,
    x: originX,
    y: originY,
    width: size.width,
    height: size.height,
    isCollapsed: true,
  });
  setAnchor(context, nodeId, {
    leftX: originX,
    rightX: originX + size.width,
    centerY: originY + size.height / 2,
  });
};

export const placeNode = (
  nodeId: string,
  originX: number,
  originY: number,
  context: PlacementContext,
  stack = new Set<string>(),
  depth = 0,
  parentGateId: string | null = null
) => {
  if (stack.has(nodeId)) return;
  stack.add(nodeId);

  const node = context.nodeMap.get(nodeId);
  if (!node || node.type !== "gate") {
    placeComponent(nodeId, originX, originY, context, parentGateId);
    return;
  }

  if (context.collapsedGateIds?.has(nodeId)) {
    placeCollapsedGate(nodeId, originX, originY, context, parentGateId);
    return;
  }

  const size = context.sizeMap.get(nodeId) ?? COMPONENT_SIZE;
  const children = context.childrenMap.get(nodeId) ?? [];

  context.gateAreas.push({
    id: nodeId,
    parentId: parentGateId,
    subtype: node.subtype ?? null,
    color: node.color ?? null,
    x: originX,
    y: originY,
    width: size.width,
    height: size.height,
    depth,
  });

  context.nodes.push({
    id: nodeId,
    type: "gate",
    subtype: node.subtype,
    k: node.k ?? null,
    label: node.label ?? null,
    name: node.name ?? null,
    color: node.color ?? null,
    reliability: node.reliability ?? null,
    childCount: children.length,
    parentGateId,
    x: originX + (size.width - GATE_LABEL_SIZE.width) / 2,
    y: originY,
    width: GATE_LABEL_SIZE.width,
    height: GATE_LABEL_SIZE.height,
  });

  if (children.length === 0) {
    setAnchor(context, nodeId, {
      leftX: originX,
      rightX: originX + size.width,
      centerY: originY + size.height / 2,
    });
    return;
  }

  const subtype = normalizeSubtype(node);
  if (subtype === "or" || subtype === "koon") {
    placeOrGate(nodeId, originX, originY, context, stack, depth, parentGateId);
    return;
  }

  placeAndGate(nodeId, originX, originY, context, stack, depth, parentGateId);
};