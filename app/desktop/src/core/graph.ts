export type GraphNode = {
  id: string;
  type: string;
  subtype?: string | null;
  k?: number | null;
  label?: string | null;
  name?: string | null;
  guid?: string;
  unit_type?: string | null;
  dist?: { kind?: string | null } | null;
  reliability?: number | null;
  conflict?: boolean;
  color?: string | null;
};

export type FailureType = "M1" | "M2";

export type FailureCacheRow = Record<string, unknown> | unknown[];

export type FailuresCacheEntry = {
  rows?: FailureCacheRow[] | null;
  last_update?: string | null;
};

export type FailuresCache = {
  items?: Record<string, FailuresCacheEntry | FailureCacheRow[] | null> | null;
};

export type GraphEdge = {
  from: string;
  to: string;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  root?: string | null;
  reliability_total?: number | null;
  failures_cache?: FailuresCache | null;
};

export const createEmptyGraph = (): GraphData => ({
  nodes: [],
  edges: []
});

export const getGraphSummary = (graph: GraphData) => ({
  root: graph.root ?? null,
  nodeCount: graph.nodes.length,
  edgeCount: graph.edges.length,
  reliabilityTotal: graph.reliability_total ?? null
});