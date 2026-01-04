import { GraphNode } from "../../../../core/graph";

export type DiagramLayoutNode = {
  id: string;
  type: "component" | "gate";
  subtype?: string | null;
  k?: number | null;
  label?: string | null;
  name?: string | null;
  color?: string | null;
  parentGateId?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  distKind?: string | null;
  reliability?: number | null;
  childCount?: number;
  isCollapsed?: boolean;
};

export type DiagramLayoutLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: "series" | "rail" | "connector";
  arrow?: boolean;
};

export type DiagramGateArea = {
  id: string;
  parentId: string | null;
  subtype?: string | null;
  color?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  depth: number;
};

export type LayoutResult = {
  nodes: DiagramLayoutNode[];
  lines: DiagramLayoutLine[];
  gateAreas: DiagramGateArea[];
  anchors: Map<string, NodeAnchor>;
  width: number;
  height: number;
};

export type Size = {
  width: number;
  height: number;
};

export type NodeAnchor = {
  leftX: number;
  rightX: number;
  centerY: number;
};

export type MeasurementContext = {
  nodeMap: Map<string, GraphNode>;
  childrenMap: Map<string, string[]>;
  collapsedGateIds?: Set<string>;
  sizeCache: Map<string, Size>;
};

export type PlacementContext = {
  nodeMap: Map<string, GraphNode>;
  childrenMap: Map<string, string[]>;
  sizeMap: Map<string, Size>;
  collapsedGateIds?: Set<string>;
  nodes: DiagramLayoutNode[];
  gateAreas: DiagramGateArea[];
  anchors: Map<string, NodeAnchor>;
};

export type ConnectionContext = {
  nodeMap: Map<string, GraphNode>;
  childrenMap: Map<string, string[]>;
  sizeMap: Map<string, Size>;
  collapsedGateIds?: Set<string>;
  nodes: DiagramLayoutNode[];
  gateAreas: DiagramGateArea[];
  anchors: Map<string, NodeAnchor>;
};