import { useEffect, useState } from "react";
import { createEmptyGraph, GraphData } from "../../../core/graph";
import { fetchGraph } from "../../../services/graphService";

export type DiagramStatus = "idle" | "loading" | "error" | "ready";

export type DiagramState = {
  graph: GraphData;
  status: DiagramStatus;
  errorMessage: string | null;
};

export const useDiagramGraph = (reloadToken = 0): DiagramState => {
  const [graph, setGraph] = useState<GraphData>(() => createEmptyGraph());
  const [status, setStatus] = useState<DiagramStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    fetchGraph()
      .then((data) => {
        if (!active) {
          return;
        }
        setGraph(data);
        setStatus("ready");
      })
      .catch((error: Error) => {
        if (!active) {
          return;
        }
        setErrorMessage(error.message);
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  return { graph, status, errorMessage };
};