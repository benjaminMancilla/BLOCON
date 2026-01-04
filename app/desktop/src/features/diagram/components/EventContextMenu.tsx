import { ContextMenu } from "./ContextMenu";

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
  return (
    <ContextMenu
      isOpen={isOpen}
      position={position}
      onClose={onClose}
      className="event-context-menu"
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
    </ContextMenu>
  );
};