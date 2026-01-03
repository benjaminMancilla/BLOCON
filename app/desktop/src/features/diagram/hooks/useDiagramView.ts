import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GraphData } from "../../../core/graph";
import {
  DiagramViewState,
  fetchDiagramView,
  saveDiagramView,
} from "../../../services/diagramViewService";
import {
  buildGateGuidMaps,
  migrateCollapsedGateGuids,
} from "../utils/diagramViewUtils";

export type DiagramViewStateController = {
  collapsedGateIdSet: Set<string>;
  collapseGate: (gateId: string) => void;
  expandGate: (gateId: string) => void;
  refresh: () => Promise<void>;
  getViewSnapshot: () => DiagramViewState;
};

export const useDiagramView = (graph: GraphData): DiagramViewStateController => {
  const [collapsedGateGuids, setCollapsedGateGuids] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const hasHydratedRef = useRef(false);
  const hasUserInteractionRef = useRef(false);
  const hasPendingSaveRef = useRef(false);
  const { gateGuidById, gateIdByGuid } = useMemo(
    () => buildGateGuidMaps(graph),
    [graph]
  );

  const refresh = useCallback(async () => {
    try {
      const data = await fetchDiagramView();
      hasHydratedRef.current = true;
      setCollapsedGateGuids(
        migrateCollapsedGateGuids(
          gateGuidById,
          gateIdByGuid,
          data.collapsedGateIds ?? []
        )
      );
    } catch (error) {
      setCollapsedGateGuids([]);
    }
  }, [gateGuidById, gateIdByGuid]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchDiagramView();
        if (!active) {
          return;
        }
        hasHydratedRef.current = true;
        setCollapsedGateGuids(
          migrateCollapsedGateGuids(
            gateGuidById,
            gateIdByGuid,
            data.collapsedGateIds ?? []
          )
        );
      } catch (error) {
        if (!active) {
          return;
        }
        setCollapsedGateGuids([]);
      } finally {
        if (active) {
          setIsLoaded(true);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [gateGuidById, gateIdByGuid]);

  useEffect(() => {
    if (graph.nodes.length === 0) {
      return;
    }
    const reconciled = migrateCollapsedGateGuids(
      gateGuidById,
      gateIdByGuid,
      collapsedGateGuids
    );
    const hasDiff =
      reconciled.length !== collapsedGateGuids.length ||
      reconciled.some((id, index) => id !== collapsedGateGuids[index]);
    if (hasDiff) {
      if (hasUserInteractionRef.current) {
        hasPendingSaveRef.current = true;
      }
      setCollapsedGateGuids(reconciled);
    }
  }, [graph, gateGuidById, gateIdByGuid, collapsedGateGuids]);

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
    void saveDiagramView({ collapsedGateIds: collapsedGateGuids });
  }, [collapsedGateGuids, isLoaded]);

  const collapsedGateIdSet = useMemo(() => {
    const resolved = collapsedGateGuids
      .map((guid) => gateIdByGuid.get(guid))
      .filter((id): id is string => Boolean(id));
    return new Set(resolved);
  }, [collapsedGateGuids, gateIdByGuid]);

  const collapseGate = useCallback((gateId: string) => {
    hasUserInteractionRef.current = true;
    hasPendingSaveRef.current = true;
    const guid = gateGuidById.get(gateId) ?? gateId;
    setCollapsedGateGuids((prev) =>
      prev.includes(guid) ? prev : [...prev, guid]
    );
  }, [gateGuidById]);

  const expandGate = useCallback((gateId: string) => {
    hasUserInteractionRef.current = true;
    hasPendingSaveRef.current = true;
    const guid = gateGuidById.get(gateId) ?? gateId;
    setCollapsedGateGuids((prev) => prev.filter((id) => id !== guid));
  }, [gateGuidById]);

    const getViewSnapshot = useCallback(
    (): DiagramViewState => ({
      collapsedGateIds: [...collapsedGateGuids],
    }),
    [collapsedGateGuids],
  );

  return {
    collapsedGateIdSet,
    collapseGate,
    expandGate,
    refresh,
    getViewSnapshot,
  };
};