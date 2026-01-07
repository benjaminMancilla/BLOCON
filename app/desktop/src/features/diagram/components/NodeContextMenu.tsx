import type { RefObject } from "react";
import { ContextMenu } from "./ContextMenu";
import type { NodeContextMenuTarget } from "../hooks/useNodeContextMenu";

type NodeContextMenuProps = {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  target: NodeContextMenuTarget | null;
  onClose: () => void;
  onViewInfo?: (nodeId: string) => void;
  onDelete?: (target: NodeContextMenuTarget) => void;
  onAddHere?: (target: NodeContextMenuTarget) => void;
  menuRef?: RefObject<HTMLDivElement>;
};

const formatNodeTitle = (target: NodeContextMenuTarget) => {
  if (target.nodeType === "gate") {
    return `Gate ${target.nodeId}`;
  }
  return `Componente ${target.nodeId}`;
};

const formatNodeSubtitle = (target: NodeContextMenuTarget) => {
  if (target.nodeType === "gate") {
    const subtype = target.gateSubtype ? target.gateSubtype.toUpperCase() : null;
    const label = subtype ? `Tipo ${subtype}` : "Gate";
    if (target.name) {
      return `${label} · ${target.name}`;
    }
    return label;
  }
  return "Nodo componente";
};

export const NodeContextMenu = ({
  isOpen,
  position,
  target,
  onClose,
  onViewInfo,
  onDelete,
  onAddHere,
  menuRef,
}: NodeContextMenuProps) => {
  if (!isOpen || !position || !target) return null;

  const handleViewInfo = () => {
    onViewInfo?.(target.nodeId);
    onClose();
  };

  const handleDelete = () => {
    onDelete?.(target);
    onClose();
  };

  const handleAddHere = () => {
    onAddHere?.(target);
    onClose();
  };

  return (
    <ContextMenu
      isOpen={isOpen}
      position={position}
      onClose={onClose}
      className="node-context-menu"
      containerRef={menuRef}
      closeOnOutsideClick={false}
    >
      <div className="node-context-menu__header">
        <div className="node-context-menu__title">
          {formatNodeTitle(target)}
        </div>
        <div className="node-context-menu__subtitle">
          {formatNodeSubtitle(target)}
        </div>
      </div>
      <button type="button" role="menuitem" onClick={handleViewInfo}>
        Ver información
      </button>
      <button type="button" role="menuitem" data-tone="accent" onClick={handleAddHere}>
        Agregar aquí
      </button>
      <button type="button" role="menuitem" onClick={onClose}>
        Editar...
      </button>
      <button type="button" role="menuitem" onClick={onClose}>
        Organizar...
      </button>
      <button type="button" role="menuitem" data-tone="danger" onClick={handleDelete}>
        Borrar
      </button>
      <button type="button" role="menuitem" onClick={onClose}>
        Cerrar
      </button>
    </ContextMenu>
  );
};