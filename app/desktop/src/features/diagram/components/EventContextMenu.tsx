import { useEffect, useRef } from "react";

type EventContextMenuProps = {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  onClose: () => void;
  onViewDetails: () => void;
  onShowVersion: () => void;
  onRebuild: () => void;
};

export const EventContextMenu = ({
  isOpen,
  position,
  onClose,
  onViewDetails,
  onShowVersion,
  onRebuild,
}: EventContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  return (
    <div
      className="event-context-menu"
      ref={menuRef}
      role="menu"
      style={{ top: position.y, left: position.x }}
    >
      <button type="button" role="menuitem" onClick={onViewDetails}>
        Ver detalles
      </button>
      <button type="button" role="menuitem" onClick={onShowVersion}>
        Mostrar versión
      </button>
      <button
        type="button"
        role="menuitem"
        className="event-context-menu__danger"
        onClick={onRebuild}
      >
        Rebuild
      </button>
    </div>
  );
};