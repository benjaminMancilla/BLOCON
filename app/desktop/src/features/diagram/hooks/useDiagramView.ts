import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphData } from "../../../core/graph";
import {
  DiagramViewState,
  fetchDiagramView,
  saveDiagramView,
} from "../../../services/diagramViewService";

export type DiagramViewStateController = {
  collapsedGateIdSet: Set<string>;
  collapseGate: (gateId: string) => void;
  expandGate: (gateId: string) => void;
};

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

export const useDiagramView = (graph: GraphData): DiagramViewStateController => {
  const [collapsedGateIds, setCollapsedGateIds] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasHydratedRef = useRef(false);
  const hasUserInteractionRef = useRef(false);
  const hasPendingSaveRef = useRef(false);

  useEffect(() => {
    let active = true;
    fetchDiagramView()
      .then((data: DiagramViewState) => {
        if (!active) {
          return;
        }
        hasHydratedRef.current = true;
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
      if (hasUserInteractionRef.current) {
        hasPendingSaveRef.current = true;
      }
      setCollapsedGateIds(reconciled);
    }
  }, [graph, collapsedGateIds]);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    if (!hasHydratedRef.current) {
      return;
    }
    if (!hasPendingSaveRef.current) {
      return;
    }
    hasPendingSaveRef.current = false;
    void saveDiagramView({ collapsedGateIds });
  }, [collapsedGateIds, isLoaded]);

  const collapsedGateIdSet = useMemo(
    () => new Set(collapsedGateIds),
    [collapsedGateIds]
  );

  const collapseGate = useCallback((gateId: string) => {
    hasUserInteractionRef.current = true;
    hasPendingSaveRef.current = true;
    setCollapsedGateIds((prev) =>
      prev.includes(gateId) ? prev : [...prev, gateId]
    );
  }, []);

  const expandGate = useCallback((gateId: string) => {
    hasUserInteractionRef.current = true;
    hasPendingSaveRef.current = true;
    setCollapsedGateIds((prev) => prev.filter((id) => id !== gateId));
  }, []);

  return {
    collapsedGateIdSet,
    collapseGate,
    expandGate,
  };
};