import { ConnectionContext, DiagramLayoutLine } from "../types";
import { normalizeSubtype, shouldShowArrow } from "../utils/anchorCalculations";
import { buildAndConnections } from "./buildAndConnections";
import { buildOrConnections } from "./buildOrConnections";

export const buildConnections = (context: ConnectionContext): DiagramLayoutLine[] => {
  const lines: DiagramLayoutLine[] = [];
  const gateAreaMap = new Map(
    context.gateAreas.map((area) => [area.id, area])
  );
  const componentMap = new Map(
    context.nodes
      .filter((node) => node.type === "component")
      .map((node) => [node.id, node])
  );

  context.nodeMap.forEach((node, nodeId) => {
    if (node.type !== "gate") return;
    if (context.collapsedGateIds?.has(nodeId)) return;

    const children = context.childrenMap.get(nodeId) ?? [];
    if (children.length === 0) return;

    const subtype = normalizeSubtype(node);
    if (subtype === "or" || subtype === "koon") {
      lines.push(
        ...buildOrConnections(
          nodeId,
          context,
          gateAreaMap,
          componentMap,
          shouldShowArrow
        )
      );
      return;
    }

    lines.push(
      ...buildAndConnections(
        nodeId,
        context,
        gateAreaMap,
        componentMap,
        shouldShowArrow
      )
    );
  });

  return lines;
};