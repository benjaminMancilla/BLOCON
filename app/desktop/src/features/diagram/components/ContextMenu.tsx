import { useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";

type ContextMenuProps = {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  onClose: () => void;
  className?: string;
  containerRef?: RefObject<HTMLDivElement>;
  closeOnOutsideClick?: boolean;
  children: ReactNode;
};

export const ContextMenu = ({
  isOpen,
  position,
  onClose,
  className,
  containerRef,
  closeOnOutsideClick = true,
  children,
}: ContextMenuProps) => {
  const fallbackRef = useRef<HTMLDivElement | null>(null);
  const menuRef = containerRef ?? fallbackRef;

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!closeOnOutsideClick) return;
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
  }, [closeOnOutsideClick, isOpen, menuRef, onClose]);

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