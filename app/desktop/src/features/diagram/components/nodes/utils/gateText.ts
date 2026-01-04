import type { DiagramLayoutNode } from "../../../hooks/useDiagramLayout";

const normalizeText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

export const getGatePrimaryLabel = (node: DiagramLayoutNode) =>
  normalizeText(node.label) ?? node.id;

export const getGateSecondaryLabel = (node: DiagramLayoutNode) => {
  const normalizedName = normalizeText(node.name);
  if (!normalizedName) return null;

  const normalizedLabel = normalizeText(node.label);
  const primaryLabel = normalizedLabel ?? node.id;

  if (normalizedName === node.id) return null;
  if (normalizedName === primaryLabel) return null;

  return normalizedName;
};