import type { GraphData } from "../../../core/graph";

export const buildGateGuidMaps = (graph: GraphData) => {
  const gateGuidById = new Map<string, string>();
  const gateIdByGuid = new Map<string, string>();
  graph.nodes
    .filter((node) => node.type === "gate")
    .forEach((node) => {
      const guid = node.guid ?? node.id;
      gateGuidById.set(node.id, guid);
      gateIdByGuid.set(guid, node.id);
    });
  return { gateGuidById, gateIdByGuid };
};

export const normalizeCollapsedIds = (ids: string[]): string[] => {
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

export const migrateCollapsedGateGuids = (
  gateGuidById: Map<string, string>,
  gateIdByGuid: Map<string, string>,
  values: string[]
): string[] => {
  const resolved = values.map((value) => {
    if (gateIdByGuid.has(value)) {
      return value;
    }
    return gateGuidById.get(value) ?? value;
  });
  return normalizeCollapsedIds(resolved);
};