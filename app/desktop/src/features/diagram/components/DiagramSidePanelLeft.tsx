import { useEffect, useState, type ReactNode } from "react";

type DiagramSidePanelLeftProps = {
  children: ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
  dependency?: boolean;
};

export const DiagramSidePanelLeft = ({
  children,
  className,
  isOpen,
  onClose,
  dependency = true,
}: DiagramSidePanelLeftProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!dependency && isOpen) {
      onClose();
    }
  }, [dependency, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <aside
      className={`diagram-side-panel diagram-side-panel--left${
        className ? ` ${className}` : ""
      }${isCollapsed ? " diagram-side-panel--collapsed" : ""}`}
    >
      <button
        type="button"
        className="diagram-side-panel__collapse"
        onClick={() => setIsCollapsed((current) => !current)}
        aria-label={isCollapsed ? "Expandir panel" : "Colapsar panel"}
      >
        {isCollapsed ? "‹" : "›"}
      </button>
      <div className="diagram-side-panel__body">{children}</div>
    </aside>
  );
};