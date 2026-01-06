import { useCallback, useState } from "react";
import type { DiagramNodeSelection } from "../types/selection";
import { deleteNode } from "../../../services/graphService";

type UseDeleteNodeActionArgs = {
  skipConfirmForComponents: boolean;
  onDeleteSuccess?: (selection: DiagramNodeSelection) => void;
  onDeleteError?: (selection: DiagramNodeSelection, error: unknown) => void;
};

type UseDeleteNodeActionResult = {
  confirmSelection: DiagramNodeSelection | null;
  isDeleting: boolean;
  requestDelete: (selection: DiagramNodeSelection) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
};

const isGateSelection = (selection: DiagramNodeSelection | null) =>
  selection?.type === "gate" || selection?.type === "collapsedGate";

export const useDeleteNodeAction = ({
  skipConfirmForComponents,
  onDeleteSuccess,
  onDeleteError,
}: UseDeleteNodeActionArgs): UseDeleteNodeActionResult => {
  const [confirmSelection, setConfirmSelection] =
    useState<DiagramNodeSelection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const requiresConfirm = useCallback(
    (selection: DiagramNodeSelection | null) => {
      if (!selection) return false;
      if (isGateSelection(selection)) return true;
      return !skipConfirmForComponents;
    },
    [skipConfirmForComponents],
  );

  const performDelete = useCallback(
    async (selection: DiagramNodeSelection) => {
      if (isDeleting) return;
      setIsDeleting(true);
      try {
        await deleteNode(selection.id);
        onDeleteSuccess?.(selection);
      } catch (error) {
        console.error("Error deleting node:", error);
        onDeleteError?.(selection, error);
      } finally {
        setIsDeleting(false);
      }
    },
    [isDeleting, onDeleteError, onDeleteSuccess],
  );

  const requestDelete = useCallback(
    (selection: DiagramNodeSelection) => {
      if (!selection || isDeleting) return;
      if (requiresConfirm(selection)) {
        setConfirmSelection(selection);
        return;
      }
      void performDelete(selection);
    },
    [isDeleting, performDelete, requiresConfirm],
  );

  const confirmDelete = useCallback(async () => {
    if (!confirmSelection) return;
    await performDelete(confirmSelection);
    setConfirmSelection(null);
  }, [confirmSelection, performDelete]);

  const cancelDelete = useCallback(() => {
    setConfirmSelection(null);
  }, []);

  return {
    confirmSelection,
    isDeleting,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
};