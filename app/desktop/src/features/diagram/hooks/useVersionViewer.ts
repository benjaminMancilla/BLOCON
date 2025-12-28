import { useCallback, useMemo, useRef, useState } from "react";
import { createEmptyGraph, type GraphData } from "../../../core/graph";
import type { DiagramStatus } from "./useDiagramGraph";
import type { DiagramViewStateController } from "./useDiagramView";
import { fetchGraphAtVersion } from "../../../services/versionViewerService";

type VersionViewerState = {
  isActive: boolean;
  version: number | null;
  graph: GraphData;
  status: DiagramStatus;
  errorMessage: string | null;
};

export const useVersionViewer = () => {
  const [state, setState] = useState<VersionViewerState>({
    isActive: false,
    version: null,
    graph: createEmptyGraph(),
    status: "idle",
    errorMessage: null,
  });
  const [collapsedGateIds, setCollapsedGateIds] = useState<string[]>([]);
  const requestIdRef = useRef(0);

  const collapseGate = useCallback((gateId: string) => {
    setCollapsedGateIds((prev) =>
      prev.includes(gateId) ? prev : [...prev, gateId],
    );
  }, []);

  const expandGate = useCallback((gateId: string) => {
    setCollapsedGateIds((prev) => prev.filter((id) => id !== gateId));
  }, []);

  const viewState: DiagramViewStateController = useMemo(
    () => ({
      collapsedGateIdSet: new Set(collapsedGateIds),
      collapseGate,
      expandGate,
    }),
    [collapsedGateIds, collapseGate, expandGate],
  );

  const enterVersion = useCallback(async (version: number) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setCollapsedGateIds([]);
    setState((current) => ({
      ...current,
      isActive: true,
      version,
      status: "loading",
      errorMessage: null,
    }));

    try {
      const graph = await fetchGraphAtVersion(version);
      if (requestIdRef.current !== requestId) return;
      setState({
        isActive: true,
        version,
        graph,
        status: "ready",
        errorMessage: null,
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;
      setState((current) => ({
        ...current,
        isActive: true,
        version,
        status: "error",
        errorMessage:
          error instanceof Error
            ? error.message
            : "No se pudo cargar la versión solicitada.",
      }));
    }
  }, []);

  const exitViewer = useCallback(() => {
    requestIdRef.current += 1;
    setCollapsedGateIds([]);
    setState({
      isActive: false,
      version: null,
      graph: createEmptyGraph(),
      status: "idle",
      errorMessage: null,
    });
  }, []);

  return {
    ...state,
    viewState,
    enterVersion,
    exitViewer,
  };
};