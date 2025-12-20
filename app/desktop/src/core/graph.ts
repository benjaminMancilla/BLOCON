export type GraphNode = {
  id: string;
  type: string;
  subtype?: string | null;
  k?: number | null;
  unit_type?: string | null;
  dist?: { kind?: string | null } | null;
  reliability?: number | null;
  conflict?: boolean;
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