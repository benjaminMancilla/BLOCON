import { useState, type ReactNode } from "react";

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
    <aside
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
      <div className="diagram-side-panel__body">{children}</div>
    </aside>
  );
};