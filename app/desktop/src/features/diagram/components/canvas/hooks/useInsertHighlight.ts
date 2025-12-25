import { useEffect, useRef, useState } from "react";
import type { GraphData } from "../../../../../core/graph";
import type { DiagramStatus } from "../../../hooks/useDiagramGraph";

type InsertHighlight = {
  token: number;
  componentId: string;
  targetGateId: string | null;
  hostComponentId: string | null;
};

type UseInsertHighlightArgs = {
  highlight: InsertHighlight | null;
  graph: GraphData;
  status: DiagramStatus;
  durationMs?: number;
};

type InsertHighlightState = {
  highlightedComponentId: string | null;
  highlightedGateId: string | null;
};

const DEFAULT_DURATION = 2600;

export const useInsertHighlight = ({
  highlight,
  graph,
  status,
  durationMs = DEFAULT_DURATION,
}: UseInsertHighlightArgs): InsertHighlightState => {
  const [highlightedComponentId, setHighlightedComponentId] =
    useState<string | null>(null);
  const [highlightedGateId, setHighlightedGateId] = useState<string | null>(
    null
  );
  const timeoutRef = useRef<number | null>(null);
  const tokenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!highlight || status !== "ready") return;
    if (tokenRef.current === highlight.token) return;

    const edgesByFrom = new Map<string, string[]>();
    graph.edges.forEach((edge) => {
      if (!edgesByFrom.has(edge.from)) {
        edgesByFrom.set(edge.from, []);
      }
      edgesByFrom.get(edge.from)?.push(edge.to);
    });

    const resolveGateId = () => {
      if (highlight.targetGateId) return highlight.targetGateId;
      if (!highlight.hostComponentId) return null;
      const gateNodes = graph.nodes.filter((node) => node.type === "gate");
      for (const gate of gateNodes) {
        const children = edgesByFrom.get(gate.id) ?? [];
        if (
          children.includes(highlight.componentId) &&
          children.includes(highlight.hostComponentId)
        ) {
          return gate.id;
        }
      }
      return null;
    };

    setHighlightedComponentId(highlight.componentId);
    setHighlightedGateId(resolveGateId());
    tokenRef.current = highlight.token;

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setHighlightedComponentId(null);
      setHighlightedGateId(null);
    }, durationMs);

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [durationMs, graph.edges, graph.nodes, highlight, status]);

  return { highlightedComponentId, highlightedGateId };
};