import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

type ContextMenuProps = {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  onClose: () => void;
  className?: string;
  children: ReactNode;
};

export const ContextMenu = ({
  isOpen,
  position,
  onClose,
  className,
  children,
}: ContextMenuProps) => {
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
      className={["context-menu", className].filter(Boolean).join(" ")}
      ref={menuRef}
      role="menu"
      style={{ top: position.y, left: position.x }}
    >
      {children}
    </div>
  );
};