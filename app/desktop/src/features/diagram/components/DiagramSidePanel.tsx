import { useState, type ReactNode } from "react";
import { AnimatedPanel } from "../../../ui/components/AnimatedPanel";
import { SurfaceCard } from "../../../ui/components/SurfaceCard";

type DiagramSidePanelProps = {
  children: ReactNode;
  className?: string;
};

export const DiagramSidePanel = ({
  children,
  className,
}: DiagramSidePanelProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <AnimatedPanel
      as="aside"
      className={`diagram-side-panel${className ? ` ${className}` : ""}${
        isCollapsed ? " diagram-side-panel--collapsed" : ""
      }`}
    >
      <button
        type="button"
        className="diagram-side-panel__collapse"
        onClick={() => setIsCollapsed((current) => !current)}
        aria-label={isCollapsed ? "Expandir panel" : "Colapsar panel"}
      >
        {isCollapsed ? "›" : "‹"}
      </button>
      <SurfaceCard className="diagram-side-panel__body">{children}</SurfaceCard>
    </AnimatedPanel>
  );
};
