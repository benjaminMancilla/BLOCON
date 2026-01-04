import type { DiagramLayoutNode, NodeAnchor } from "../../../hooks/useDiagramLayout";
import { KoonBadge } from "../../KoonBadge";

type DiagramKoonBadgesProps = {
  nodes: DiagramLayoutNode[];
  anchors: Map<string, NodeAnchor>;
  onGraphReload?: () => void;
};

export const DiagramKoonBadges = ({
  nodes,
  anchors,
  onGraphReload,
}: DiagramKoonBadgesProps) => {
  const koonNodes = nodes.filter(
    (node) => node.type === "gate" && node.subtype?.toLowerCase() === "koon"
  );

  if (koonNodes.length === 0) return null;

  return (
    <>
      {koonNodes.map((node) => {
        const anchor = anchors.get(node.id);
        if (!anchor) return null;
        return (
          <KoonBadge
            key={`koon-badge-${node.id}`}
            gateId={node.id}
            k={node.k ?? 1}
            n={node.childCount ?? 0}
            position={{ x: anchor.rightX, y: anchor.centerY }}
            color={node.color ?? null}
            onGraphReload={onGraphReload}
          />
        );
      })}
    </>
  );
};