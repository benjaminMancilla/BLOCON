type DeleteActionButtonProps = {
  isVisible?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
};

export const DeleteActionButton = ({
  isVisible = false,
  isDisabled = false,
  onClick,
}: DeleteActionButtonProps) => {
  if (!isVisible) return null;
  return (
    <div className="diagram-delete-action">
      <button
        type="button"
        className="diagram-delete-action__button"
        onClick={onClick}
        disabled={isDisabled}
        aria-label="Borrar elemento seleccionado"
      >
        🗑️
      </button>
    </div>
  );
};