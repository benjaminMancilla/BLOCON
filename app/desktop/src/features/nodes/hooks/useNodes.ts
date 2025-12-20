import { useMemo } from "react";
import { GraphData } from "../../../core/graph";

export const useNodes = (graph: GraphData) => {
  return useMemo(() => graph.nodes, [graph.nodes]);
};