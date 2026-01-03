import { useCallback, useMemo, useRef, useState } from "react";
import { createEmptyGraph, type GraphData } from "../../../core/graph";
import type { DiagramStatus } from "./useDiagramGraph";
import type { DiagramViewStateController } from "./useDiagramView";
import { fetchGraphAtVersion } from "../../../services/versionViewerService";
import type { DiagramViewState } from "../../../services/diagramViewService";
import { buildGateGuidMaps } from "../utils/diagramViewUtils";

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
  const [viewerView, setViewerView] = useState<DiagramViewState>({
    collapsedGateIds: [],
  });
  const requestIdRef = useRef(0);
  const { gateGuidById, gateIdByGuid } = useMemo(
    () => buildGateGuidMaps(state.graph),
    [state.graph],
  );

  const cloneViewState = useCallback((view: DiagramViewState) => {
    if (typeof structuredClone === "function") {
      return structuredClone(view);
    }
    return JSON.parse(JSON.stringify(view)) as DiagramViewState;
  }, []);

  const collapseGate = useCallback((gateId: string) => {
    const guid = gateGuidById.get(gateId) ?? gateId;
    setViewerView((prev) =>
      prev.collapsedGateIds.includes(guid)
        ? prev
        : { ...prev, collapsedGateIds: [...prev.collapsedGateIds, guid] },
    );
  }, [gateGuidById]);

  const expandGate = useCallback((gateId: string) => {
    const guid = gateGuidById.get(gateId) ?? gateId;
    setViewerView((prev) => ({
      ...prev,
      collapsedGateIds: prev.collapsedGateIds.filter((id) => id !== guid),
    }));
  }, [gateGuidById]);

  const collapsedGateIdSet = useMemo(() => {
    const resolved = viewerView.collapsedGateIds
      .map((guid) => gateIdByGuid.get(guid))
      .filter((id): id is string => Boolean(id));
    return new Set(resolved);
  }, [viewerView.collapsedGateIds, gateIdByGuid]);

  const viewState: DiagramViewStateController = useMemo(
    () => ({
      collapsedGateIdSet,
      collapseGate,
      expandGate,
      refresh: async () => undefined,
      getViewSnapshot: () => cloneViewState(viewerView),
    }),
    [collapsedGateIdSet, collapseGate, expandGate, cloneViewState, viewerView],
  );

  const enterVersion = useCallback(async (
    version: number,
    initialView?: DiagramViewState,
  ) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setViewerView(
      cloneViewState(
        initialView ?? {
          collapsedGateIds: [],
        },
      ),
    );
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
  }, [cloneViewState]);

  const exitViewer = useCallback(() => {
    requestIdRef.current += 1;
    setViewerView({
      collapsedGateIds: [],
    });
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