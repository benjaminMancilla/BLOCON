import type { DiagramLayoutNode } from "../../../hooks/useDiagramLayout";

const formatGateMeta = (node: DiagramLayoutNode) => {
  const subtype = node.subtype?.toLowerCase();
  if (subtype === "koon") {
    const total = node.childCount ?? node.k ?? 1;
    const required = node.k ?? 1;
    return `Gate ${required}/${total}`;
  }
  if (subtype === "or") {
    return "Gate OR";
  }
  if (subtype === "and") {
    return "Gate AND";
  }
  return "Gate";
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
  const gateMeta = formatGateMeta(node);

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
      <div className="diagram-node__title">{node.id}</div>
      <div className="diagram-node__meta">
        <span className="diagram-node__icon">⟲</span>
        <span className="diagram-node__meta-text">{gateMeta}</span>
      </div>
      <div className="diagram-node__collapsed-label">{gateMeta}</div>
    </>
  );
};