import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphData } from "../../../../../core/graph";
import type { DiagramNodeSelection } from "../../../types/selection";
import {
  calculationTypeOptions,
  getCalculationTypeOption,
} from "../../../icons/calculationTypeIcons";
import type { GateType } from "../../../types/gates";
import type { CalculationType } from "../../../types/addComponent";
import type { OrganizationUiState } from "../../../types/organization";
import { buildOrganizationGraph } from "../utils/organizationGraphBuilder";

const buildChildrenMap = (graph: GraphData) => {
  const map = new Map<string, string[]>();
  graph.edges.forEach((edge) => {
    if (!map.has(edge.from)) {
      map.set(edge.from, []);
    }
    map.get(edge.from)?.push(edge.to);
  });
  return map;
};

const getDescendantGateIds = (graph: GraphData, gateId: string) => {
  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const childrenMap = buildChildrenMap(graph);
  const stack = [...(childrenMap.get(gateId) ?? [])];
  const descendants = new Set<string>();

  while (stack.length) {
    const current = stack.pop();
    if (!current || descendants.has(current)) continue;
    descendants.add(current);
    const node = nodeMap.get(current);
    if (node?.type === "gate") {
      const nextChildren = childrenMap.get(current) ?? [];
      stack.push(...nextChildren);
    }
  }

  return [...descendants].filter((id) => nodeMap.get(id)?.type === "gate");
};

const normalizeGateType = (value: string | null | undefined): GateType | null => {
  const normalized = value?.toLowerCase() ?? null;
  if (normalized === "and" || normalized === "or" || normalized === "koon") {
    return normalized;
  }
  return null;
};

const getDirectChildren = (graph: GraphData, gateId: string) =>
  graph.edges.filter((edge) => edge.from === gateId).map((edge) => edge.to);

const applyGateOrder = (graph: GraphData, gateId: string, order: string[]) => {
  const children = getDirectChildren(graph, gateId);
  const orderSet = new Set(order);
  const normalizedOrder = [
    ...order.filter((id) => children.includes(id)),
    ...children.filter((id) => !orderSet.has(id)),
  ];
  const edges = graph.edges.filter((edge) => edge.from !== gateId);
  normalizedOrder.forEach((childId) => {
    edges.push({ from: gateId, to: childId });
  });
  return {
    ...graph,
    edges,
  };
};

type OrganizationCalculationMeta = {
  icon: string;
  label: string;
};

type UseOrganizationModeArgs = {
  isActive: boolean;
  graph: GraphData;
  collapsedGateIdSet: Set<string>;
  selection: DiagramNodeSelection | null;
  gateType: GateType | null;
  componentId?: string | null;
  calculationType?: CalculationType | null;
  onStateChange?: (state: OrganizationUiState | null) => void;
  onCancel?: () => void;
};

type UseOrganizationModeResult = {
  graph: GraphData;
  baseGraph: GraphData;
  gateId: string | null;
  placeholderId: string | null;
  isVirtualGate: boolean;
  gateSubtype: GateType | null;
  order: string[] | null;
  initialOrder: string[] | null;
  defaultOrder: string[];
  collapsedGateIdSet: Set<string>;
  descendantGateIds: string[];
  lockedGateIds: Set<string>;
  axis: "horizontal" | "vertical";
  componentLabel: string;
  calculationMeta: OrganizationCalculationMeta;
  setOrder: (order: string[]) => void;
};

export const useOrganizationMode = ({
  isActive,
  graph,
  collapsedGateIdSet,
  selection,
  gateType,
  componentId = null,
  calculationType = null,
  onStateChange,
  onCancel,
}: UseOrganizationModeArgs): UseOrganizationModeResult => {
  const {
    graph: organizationBaseGraph,
    organizationGateId,
    organizationPlaceholderId,
    isVirtualOrganizationGate,
  } = useMemo(() => {
    if (!isActive) {
      return {
        graph,
        organizationGateId: null,
        organizationPlaceholderId: null,
        isVirtualOrganizationGate: false,
      };
    }

    return buildOrganizationGraph(graph, selection, gateType);
  }, [gateType, graph, isActive, selection]);

  const [organizationOrder, setOrganizationOrder] = useState<string[] | null>(
    null
  );
  const [organizationInitialOrder, setOrganizationInitialOrder] = useState<
    string[] | null
  >(null);
  const organizationGateIdRef = useRef<string | null>(null);

  const defaultOrganizationOrder = useMemo(() => {
    if (!isActive || !organizationGateId) return [];
    return getDirectChildren(organizationBaseGraph, organizationGateId);
  }, [isActive, organizationBaseGraph, organizationGateId]);

  useEffect(() => {
    if (!isActive || !organizationGateId) {
      organizationGateIdRef.current = null;
      setOrganizationOrder(null);
      setOrganizationInitialOrder(null);
      return;
    }

    if (organizationGateIdRef.current !== organizationGateId) {
      organizationGateIdRef.current = organizationGateId;
      setOrganizationOrder(defaultOrganizationOrder);
      setOrganizationInitialOrder(defaultOrganizationOrder);
      return;
    }

    if (!organizationOrder) {
      setOrganizationOrder(defaultOrganizationOrder);
    }
    if (!organizationInitialOrder) {
      setOrganizationInitialOrder(defaultOrganizationOrder);
    }
  }, [
    defaultOrganizationOrder,
    isActive,
    organizationGateId,
    organizationInitialOrder,
    organizationOrder,
  ]);

  const organizationGraph = useMemo(() => {
    if (!isActive || !organizationGateId) return organizationBaseGraph;
    if (!organizationOrder || organizationOrder.length === 0) {
      return organizationBaseGraph;
    }
    return applyGateOrder(
      organizationBaseGraph,
      organizationGateId,
      organizationOrder
    );
  }, [
    isActive,
    organizationBaseGraph,
    organizationGateId,
    organizationOrder,
  ]);

  const organizationGateSubtype = useMemo(() => {
    if (!organizationGateId) return null;
    const node = organizationBaseGraph.nodes.find(
      (entry) => entry.id === organizationGateId
    );
    return normalizeGateType(node?.subtype ?? gateType ?? null);
  }, [gateType, organizationBaseGraph.nodes, organizationGateId]);

  const organizationCalculationMeta = useMemo(() => {
    return (
      getCalculationTypeOption(calculationType) ?? calculationTypeOptions[0]
    );
  }, [calculationType]);

  useEffect(() => {
    if (
      !isActive ||
      !organizationGateId ||
      !organizationPlaceholderId ||
      !organizationOrder ||
      !organizationInitialOrder
    ) {
      onStateChange?.(null);
      return;
    }

    onStateChange?.({
      gateId: organizationGateId,
      placeholderId: organizationPlaceholderId,
      gateSubtype: organizationGateSubtype,
      order: organizationOrder,
      initialOrder: organizationInitialOrder,
    });
  }, [
    isActive,
    onStateChange,
    organizationGateId,
    organizationGateSubtype,
    organizationInitialOrder,
    organizationOrder,
    organizationPlaceholderId,
  ]);

  const organizationDescendantGateIds = useMemo(() => {
    if (!isActive || !organizationGateId) return [];
    return getDescendantGateIds(organizationGraph, organizationGateId);
  }, [organizationGraph, isActive, organizationGateId]);

  const organizationCollapsedGateIdSet = useMemo(() => {
    const merged = new Set<string>(collapsedGateIdSet);
    organizationDescendantGateIds.forEach((id) => merged.add(id));
    if (organizationGateId) {
      merged.delete(organizationGateId);
    }
    return merged;
  }, [collapsedGateIdSet, organizationDescendantGateIds, organizationGateId]);

  const organizationAxis = useMemo(() => {
    if (!organizationGateSubtype) return "horizontal";
    if (organizationGateSubtype === "or" || organizationGateSubtype === "koon") {
      return "vertical";
    }
    return "horizontal";
  }, [organizationGateSubtype]);

  const organizationLockedGateIds = useMemo(
    () => new Set(organizationDescendantGateIds),
    [organizationDescendantGateIds]
  );

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, onCancel]);

  return {
    graph: organizationGraph,
    baseGraph: organizationBaseGraph,
    gateId: organizationGateId,
    placeholderId: organizationPlaceholderId,
    isVirtualGate: isVirtualOrganizationGate,
    gateSubtype: organizationGateSubtype,
    order: organizationOrder,
    initialOrder: organizationInitialOrder,
    defaultOrder: defaultOrganizationOrder,
    collapsedGateIdSet: organizationCollapsedGateIdSet,
    descendantGateIds: organizationDescendantGateIds,
    lockedGateIds: organizationLockedGateIds,
    axis: organizationAxis,
    componentLabel: componentId ?? "",
    calculationMeta: organizationCalculationMeta,
    setOrder: setOrganizationOrder,
  };
};