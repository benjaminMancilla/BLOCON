import { PlacementContext, DiagramLayoutNode, DiagramGateArea, NodeAnchor } from "../types";
import { placeNode } from "./placeTreeHelpers";

export const placeTree = (
  rootId: string,
  originX: number,
  originY: number,
  context: PlacementContext
): { nodes: DiagramLayoutNode[]; gateAreas: DiagramGateArea[]; anchors: Map<string, NodeAnchor> } => {
  placeNode(rootId, originX, originY, context, new Set<string>(), 0, null);
  return {
    nodes: context.nodes,
    gateAreas: context.gateAreas,
    anchors: context.anchors,
  };
};