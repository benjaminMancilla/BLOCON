import type { DiagramLayoutNode } from "../../../hooks/useDiagramLayout";
import { getGatePrimaryLabel } from "../utils/gateText";

const formatReliability = (reliability?: number | null) => {
  if (reliability === null || reliability === undefined) {
    return "—";
  }
  return `${(reliability * 100).toFixed(1)}%`;
};

type DiagramCollapsedGateContentProps = {
  node: DiagramLayoutNode;
  allowExpand: boolean;
  onExpand: (gateId: string) => void;
};

export const DiagramCollapsedGateContent = ({
  node,
  allowExpand,
  onExpand,
}: DiagramCollapsedGateContentProps) => {
  const gateLabel = getGatePrimaryLabel(node);
  const gateReliability = formatReliability(node.reliability);
  const gateMeta = "Gate";
  const normalizedSubtype = node.subtype?.toLowerCase() ?? "and";
  const collapsedLabel =
    normalizedSubtype === "koon"
      ? `${node.k ?? 1}/${node.childCount ?? 0}`
      : normalizedSubtype.toUpperCase();

  return (
    <>
      {allowExpand ? (
        <button
          type="button"
          className="diagram-node__expand"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onExpand(node.id);
          }}
          aria-label={`Expandir gate ${node.id}`}
        >
          +
        </button>
      ) : null}
      <div className="diagram-node__title">{gateLabel}</div>
      <div className="diagram-node__meta">
        <span className="diagram-node__icon diagram-node__icon--gate-label">
          {collapsedLabel}
        </span>
        <span className="diagram-node__meta-text">{gateMeta}</span>
      </div>
      <div className="diagram-node__collapsed-label">{gateReliability}</div>
    </>
  );
};