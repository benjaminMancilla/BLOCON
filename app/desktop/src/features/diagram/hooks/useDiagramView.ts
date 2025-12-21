import { useCallback, useEffect, useMemo, useState } from "react";
import { GraphData } from "../../../core/graph";
import {
  DiagramViewState,
  fetchDiagramView,
  saveDiagramView,
} from "../../../services/diagramViewService";

const filterExistingGateIds = (graph: GraphData, ids: string[]): string[] => {
  const gateIds = new Set(
    graph.nodes.filter((node) => node.type === "gate").map((node) => node.id)
  );
  return ids.filter((id) => gateIds.has(id));
};

const normalizeCollapsedIds = (ids: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  ids.forEach((id) => {
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    normalized.push(id);
  });
  return normalized;
};

export const useDiagramView = (graph: GraphData) => {
  const [collapsedGateIds, setCollapsedGateIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchDiagramView()
      .then((data: DiagramViewState) => {
        if (!active) {
          return;
        }
        setCollapsedGateIds(normalizeCollapsedIds(data.collapsedGateIds ?? []));
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setCollapsedGateIds([]);
      })
      .finally(() => {
        if (active) {
          setIsLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (graph.nodes.length === 0) {
      return;
    }
    const reconciled = filterExistingGateIds(graph, collapsedGateIds);
    const hasDiff =
      reconciled.length !== collapsedGateIds.length ||
      reconciled.some((id, index) => id !== collapsedGateIds[index]);
    if (hasDiff) {
      setCollapsedGateIds(reconciled);
    }
  }, [graph, collapsedGateIds]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    void saveDiagramView({ collapsedGateIds });
  }, [collapsedGateIds, isLoaded]);

  const collapsedGateIdSet = useMemo(
    () => new Set(collapsedGateIds),
    [collapsedGateIds]
  );

  const collapseGate = useCallback((gateId: string) => {
    setCollapsedGateIds((prev) =>
      prev.includes(gateId) ? prev : [...prev, gateId]
    );
  }, []);

  const expandGate = useCallback((gateId: string) => {
    setCollapsedGateIds((prev) => prev.filter((id) => id !== gateId));
  }, []);

  return {
    collapsedGateIds,
    collapsedGateIdSet,
    collapseGate,
    expandGate,
  };
};