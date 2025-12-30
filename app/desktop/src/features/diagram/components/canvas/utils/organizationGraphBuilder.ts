import type { GraphData } from "../../../../../core/graph";
import type { DiagramNodeSelection } from "../../../types/selection";
import type { GateType } from "../../../types/gates";

const ORGANIZATION_GATE_ID_PREFIX = "__organization_gate__";
const ORGANIZATION_COMPONENT_ID_PREFIX = "__organization_component__";

type OrganizationGraphResult = {
  graph: GraphData;
  organizationGateId: string | null;
  organizationPlaceholderId: string | null;
  isVirtualOrganizationGate: boolean;
};

const createUniqueIdFactory = (graph: GraphData) => {
  const existingIds = new Set(graph.nodes.map((node) => node.id));
  return (prefix: string) => {
    let candidate = prefix;
    let index = 1;
    while (existingIds.has(candidate)) {
      candidate = `${prefix}-${index}`;
      index += 1;
    }
    existingIds.add(candidate);
    return candidate;
  };
};

export const buildOrganizationGraph = (
  graph: GraphData,
  selection: DiagramNodeSelection | null,
  gateType: GateType | null
): OrganizationGraphResult => {
  if (!selection) {
    return {
      graph,
      organizationGateId: null,
      organizationPlaceholderId: null,
      isVirtualOrganizationGate: false,
    };
  }

  if (!graph.nodes.some((node) => node.id === selection.id)) {
    return {
      graph,
      organizationGateId: null,
      organizationPlaceholderId: null,
      isVirtualOrganizationGate: false,
    };
  }

  const createUniqueId = createUniqueIdFactory(graph);
  const placeholderId = createUniqueId(ORGANIZATION_COMPONENT_ID_PREFIX);
  const nodes = [
    ...graph.nodes,
    {
      id: placeholderId,
      type: "component",
    },
  ];
  const edges = [...graph.edges];
  let root = graph.root ?? null;
  let nextOrganizationGateId: string | null = null;
  let isVirtualGate = false;

  if (selection.type === "gate") {
    nextOrganizationGateId = selection.id;
    edges.push({ from: nextOrganizationGateId, to: placeholderId });
  } else if (
    (selection.type === "component" || selection.type === "collapsedGate") &&
    gateType
  ) {
    isVirtualGate = true;
    const gateId = createUniqueId(ORGANIZATION_GATE_ID_PREFIX);
    nextOrganizationGateId = gateId;
    nodes.push({
      id: gateId,
      type: "gate",
      subtype: gateType,
    });
    const parentEdgeIndex = edges.findIndex(
      (edge) => edge.to === selection.id
    );
    if (parentEdgeIndex >= 0) {
      const parentId = edges[parentEdgeIndex].from;
      edges.splice(parentEdgeIndex, 1, { from: parentId, to: gateId });
    } else if (root === selection.id) {
      root = gateId;
    }
    edges.push({ from: gateId, to: selection.id });
    edges.push({ from: gateId, to: placeholderId });
  } else {
    return {
      graph,
      organizationGateId: null,
      organizationPlaceholderId: null,
      isVirtualOrganizationGate: false,
    };
  }

  return {
    graph: {
      ...graph,
      nodes,
      edges,
      root,
    },
    organizationGateId: nextOrganizationGateId,
    organizationPlaceholderId: placeholderId,
    isVirtualOrganizationGate: isVirtualGate,
  };
};