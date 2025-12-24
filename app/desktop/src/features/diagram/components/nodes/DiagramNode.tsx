import type { CSSProperties, PointerEvent, ReactNode } from "react";
import type { DiagramLayoutNode } from "../../hooks/useDiagramLayout";
import type { DiagramNodeClassNameFlags } from "./utils/nodeClassNames";
import { buildNodeClassNames } from "./utils/nodeClassNames";

export type DiagramNodeHandlers = {
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onClick?: (event: PointerEvent<HTMLDivElement>) => void;
  onDoubleClick?: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
};

type DiagramNodeProps = {
  node: DiagramLayoutNode;
  baseClassName: string;
  classNameFlags: DiagramNodeClassNameFlags;
  handlers: DiagramNodeHandlers;
  style?: CSSProperties;
  children: ReactNode;
};

export const DiagramNode = ({
  node,
  baseClassName,
  classNameFlags,
  handlers,
  style,
  children,
}: DiagramNodeProps) => {
  return (
    <div
      className={buildNodeClassNames(baseClassName, classNameFlags)}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        ...style,
      }}
      data-node-id={node.id}
      onPointerEnter={handlers.onPointerEnter}
      onPointerLeave={handlers.onPointerLeave}
      onClick={handlers.onClick}
      onDoubleClick={handlers.onDoubleClick}
      onPointerDown={handlers.onPointerDown}
    >
      {children}
    </div>
  );
};