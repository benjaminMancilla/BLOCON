import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiagramNodeSelection } from "../types/selection";
import { useDeleteNodeAction } from "./useDeleteNodeAction";

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
  requestDeleteForSelection: (selection: DiagramNodeSelection) => void;
};

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

  const isDeleteBlocked = isBlocked;

  const handleDeleteSuccess = useCallback(
    (selection: DiagramNodeSelection) => {
      onDeleteSuccess?.(selection);
      setDraftSelection(null);
      setSelectedSelection(null);
      setHoveredNodeId(null);
    },
    [onDeleteSuccess],
  );

  const deleteAction = useDeleteNodeAction({
    skipConfirmForComponents,
    onDeleteSuccess: handleDeleteSuccess,
    onDeleteError,
  });

  const resetSelection = useCallback(() => {
    setDraftSelection(null);
    setSelectedSelection(null);
    setHoveredNodeId(null);
    deleteAction.cancelDelete();
  }, [deleteAction]);

  const previousDeleteMode = useRef(isDeleteMode);
  useEffect(() => {
    if (previousDeleteMode.current && !isDeleteMode) {
      resetSelection();
    }
    previousDeleteMode.current = isDeleteMode;
  }, [isDeleteMode, resetSelection]);

  useEffect(() => {
    if (!isDeleteBlocked || !isDeleteMode) return;
    setIsDeleteMode(false);
  }, [isDeleteBlocked, isDeleteMode]);

  const requestDelete = useCallback(
    (selectionOverride?: DiagramNodeSelection | null) => {
      const selection = selectionOverride ?? selectedSelection;
      if (!selection) return;
      deleteAction.requestDelete(selection);
    },
    [deleteAction, selectedSelection],
  );

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
      confirmSelection: deleteAction.confirmSelection,
      isDeleting: deleteAction.isDeleting,
      toggleDeleteMode,
      setSkipConfirmForComponents,
      onNodeHover: handleNodeHover,
      onNodePreselect: handleNodePreselect,
      onNodeConfirm: handleNodeConfirm,
      onSelectionCancel: handleSelectionCancel,
      requestDelete: () => requestDelete(),
      confirmDelete: deleteAction.confirmDelete,
      cancelDelete: deleteAction.cancelDelete,
      requestDeleteForSelection: (selection) => requestDelete(selection),
    }),
    [
      deleteAction,
      draftSelection,
      handleNodeConfirm,
      handleNodeHover,
      handleNodePreselect,
      handleSelectionCancel,
      hoveredNodeId,
      isDeleteBlocked,
      isDeleteMode,
      requestDelete,
      selectedSelection,
      skipConfirmForComponents,
      toggleDeleteMode,
    ],
  );
};