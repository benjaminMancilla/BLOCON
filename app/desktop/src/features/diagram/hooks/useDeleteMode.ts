import { useCallback, useEffect, useMemo, useState } from "react";
import type { DiagramNodeSelection } from "../types/selection";
import { deleteNode } from "../../../services/graphService";

type UseDeleteModeArgs = {
  isBlocked?: boolean;
  onDeleteSuccess?: (selection: DiagramNodeSelection) => void;
  onDeleteError?: (selection: DiagramNodeSelection, error: unknown) => void;
};

type UseDeleteModeResult = {
  isDeleteMode: boolean;
  isDeleteBlocked: boolean;
  skipConfirmForComponents: boolean;
  draftSelection: DiagramNodeSelection | null;
  selectedSelection: DiagramNodeSelection | null;
  hoveredNodeId: string | null;
  confirmSelection: DiagramNodeSelection | null;
  isDeleting: boolean;
  toggleDeleteMode: () => void;
  setSkipConfirmForComponents: (value: boolean) => void;
  onNodeHover: (nodeId: string | null) => void;
  onNodePreselect: (selection: DiagramNodeSelection) => void;
  onNodeConfirm: (selection: DiagramNodeSelection) => void;
  onSelectionCancel: () => void;
  requestDelete: () => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
};

const isGateSelection = (selection: DiagramNodeSelection | null) =>
  selection?.type === "gate" || selection?.type === "collapsedGate";

export const useDeleteMode = ({
  isBlocked = false,
  onDeleteSuccess,
  onDeleteError,
}: UseDeleteModeArgs): UseDeleteModeResult => {
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [skipConfirmForComponents, setSkipConfirmForComponents] =
    useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [draftSelection, setDraftSelection] =
    useState<DiagramNodeSelection | null>(null);
  const [selectedSelection, setSelectedSelection] =
    useState<DiagramNodeSelection | null>(null);
  const [confirmSelection, setConfirmSelection] =
    useState<DiagramNodeSelection | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isDeleteBlocked = isBlocked;

  const requiresConfirm = useCallback(
    (selection: DiagramNodeSelection | null) => {
      if (!selection) return false;
      if (isGateSelection(selection)) return true;
      return !skipConfirmForComponents;
    },
    [skipConfirmForComponents],
  );

  const resetSelection = useCallback(() => {
    setDraftSelection(null);
    setSelectedSelection(null);
    setHoveredNodeId(null);
    setConfirmSelection(null);
  }, []);

  useEffect(() => {
    if (!isDeleteMode) {
      resetSelection();
    }
  }, [isDeleteMode, resetSelection]);

  useEffect(() => {
    if (!isDeleteBlocked || !isDeleteMode) return;
    setIsDeleteMode(false);
  }, [isDeleteBlocked, isDeleteMode]);

  const performDelete = useCallback(
    async (selection: DiagramNodeSelection) => {
      if (isDeleting) return;
      setIsDeleting(true);
      try {
        await deleteNode(selection.id);
        onDeleteSuccess?.(selection);
        resetSelection();
      } catch (error) {
        console.error("Error deleting node:", error);
        onDeleteError?.(selection, error);
      } finally {
        setIsDeleting(false);
      }
    },
    [isDeleting, onDeleteError, onDeleteSuccess, resetSelection],
  );

  const requestDelete = useCallback(
    (selectionOverride?: DiagramNodeSelection | null) => {
      const selection = selectionOverride ?? selectedSelection;
      if (!selection || isDeleting) return;
      if (requiresConfirm(selection)) {
        setConfirmSelection(selection);
        return;
      }
      void performDelete(selection);
    },
    [isDeleting, performDelete, requiresConfirm, selectedSelection],
  );

  const confirmDelete = useCallback(async () => {
    if (!confirmSelection) return;
    await performDelete(confirmSelection);
    setConfirmSelection(null);
  }, [confirmSelection, performDelete]);

  const cancelDelete = useCallback(() => {
    setConfirmSelection(null);
  }, []);

  const toggleDeleteMode = useCallback(() => {
    if (isDeleteBlocked) return;
    setIsDeleteMode((current) => !current);
  }, [isDeleteBlocked]);

  const handleNodeHover = useCallback(
    (nodeId: string | null) => {
      if (!isDeleteMode) return;
      setHoveredNodeId(nodeId);
    },
    [isDeleteMode],
  );

  const handleNodePreselect = useCallback(
    (selection: DiagramNodeSelection) => {
      if (!isDeleteMode) return;
      setDraftSelection(selection);
      setSelectedSelection(selection);
    },
    [isDeleteMode],
  );

  const handleNodeConfirm = useCallback(
    (selection: DiagramNodeSelection) => {
      if (!isDeleteMode) return;
      setDraftSelection(selection);
      setSelectedSelection(selection);
      requestDelete(selection);
    },
    [isDeleteMode, requestDelete],
  );

  const handleSelectionCancel = useCallback(() => {
    setIsDeleteMode(false);
  }, []);

  useEffect(() => {
    if (!isDeleteMode) return;
    setHoveredNodeId(null);
  }, [isDeleteMode]);

  return useMemo(
    () => ({
      isDeleteMode,
      isDeleteBlocked,
      skipConfirmForComponents,
      draftSelection,
      selectedSelection,
      hoveredNodeId,
      confirmSelection,
      isDeleting,
      toggleDeleteMode,
      setSkipConfirmForComponents,
      onNodeHover: handleNodeHover,
      onNodePreselect: handleNodePreselect,
      onNodeConfirm: handleNodeConfirm,
      onSelectionCancel: handleSelectionCancel,
      requestDelete: () => requestDelete(),
      confirmDelete,
      cancelDelete,
    }),
    [
      cancelDelete,
      confirmDelete,
      confirmSelection,
      draftSelection,
      handleNodeConfirm,
      handleNodeHover,
      handleNodePreselect,
      handleSelectionCancel,
      hoveredNodeId,
      isDeleteBlocked,
      isDeleteMode,
      isDeleting,
      requestDelete,
      selectedSelection,
      skipConfirmForComponents,
      toggleDeleteMode,
    ],
  );
};