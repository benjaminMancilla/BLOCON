import { GraphData } from "../../../../core/graph";
import { buildConnections } from "./connections/buildConnections";
import { measureTree } from "./measurement/measureTree";
import { placeTree } from "./placement/placeTree";
import { LayoutResult, MeasurementContext, PlacementContext, ConnectionContext } from "./types";
import { LAYOUT_PADDING } from "./utils/constants";
import { buildChildrenMap, buildNodeMap, getRootId } from "./utils/graphHelpers";

export const buildDiagramLayout = (
  graph: GraphData,
  collapsedGateIds?: Set<string>
): LayoutResult => {
  const nodeMap = buildNodeMap(graph);
  const childrenMap = buildChildrenMap(graph);

  const rootId = getRootId(graph);
  if (!rootId) {
    return { nodes: [], lines: [], gateAreas: [], width: 0, height: 0 };
  }

  const measurementContext: MeasurementContext = {
    nodeMap,
    childrenMap,
    collapsedGateIds,
    sizeCache: new Map(),
  };

  const sizeMap = measureTree(rootId, measurementContext);

  const placementContext: PlacementContext = {
    nodeMap,
    childrenMap,
    sizeMap,
    collapsedGateIds,
    nodes: [],
    gateAreas: [],
    anchors: new Map(),
  };

  const placement = placeTree(
    rootId,
    LAYOUT_PADDING,
    LAYOUT_PADDING,
    placementContext
  );

  const connectionContext: ConnectionContext = {
    nodeMap,
    childrenMap,
    sizeMap,
    collapsedGateIds,
    nodes: placement.nodes,
    gateAreas: placement.gateAreas,
    anchors: placement.anchors,
  };

  const lines = buildConnections(connectionContext);

  const bounds = placement.nodes.reduce(
    (acc, node) => {
      acc.maxX = Math.max(acc.maxX, node.x + node.width);
      acc.maxY = Math.max(acc.maxY, node.y + node.height);
      return acc;
    },
    { maxX: 0, maxY: 0 }
  );

  const rootSize = sizeMap.get(rootId);
  const width = Math.max(
    (rootSize?.width ?? 0) + LAYOUT_PADDING * 2,
    bounds.maxX + LAYOUT_PADDING
  );
  const height = Math.max(
    (rootSize?.height ?? 0) + LAYOUT_PADDING * 2,
    bounds.maxY + LAYOUT_PADDING
  );

  return {
    nodes: placement.nodes,
    lines,
    gateAreas: placement.gateAreas,
    width,
    height,
  };
};