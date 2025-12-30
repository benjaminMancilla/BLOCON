import { GraphData, GraphNode } from "../../../../../core/graph"

export const buildNodeMap = (graph: GraphData): Map<string, GraphNode> =>
  new Map<string, GraphNode>(graph.nodes.map((node) => [node.id, node]));

export const buildChildrenMap = (graph: GraphData): Map<string, string[]> => {
  const childrenMap = new Map<string, string[]>();
  graph.edges.forEach((edge) => {
    if (!childrenMap.has(edge.from)) {
      childrenMap.set(edge.from, []);
    }
    childrenMap.get(edge.from)?.push(edge.to);
  });
  return childrenMap;
};

export const getRootId = (graph: GraphData): string | null =>
  graph.root ?? graph.nodes[0]?.id ?? null;