import { useMemo } from "react";
import { GraphData } from "../../../core/graph";

export const useGates = (graph: GraphData) => {
  return useMemo(() => graph.edges, [graph.edges]);
};