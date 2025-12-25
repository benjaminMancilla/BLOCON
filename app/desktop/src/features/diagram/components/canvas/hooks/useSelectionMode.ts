import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, WheelEvent } from "react";
import type {
  DiagramNodeSelection,
  DiagramNodeType,
} from "../../../types/selection";
import type { DiagramLayoutNode } from "../../../hooks/useDiagramLayout";

type CameraHandlers = {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLDivElement>) => void;
  onWheel: (event: WheelEvent<HTMLDivElement>) => void;
};

type UseSelectionModeArgs = {
  isActive: boolean;
  handlers: CameraHandlers;
  layoutNodeById: Map<string, DiagramLayoutNode>;
  selectedNodeId?: string | null;
  preselectedNodeId?: string | null;
  onEnter?: () => void;
  onExit?: () => void;
  onNodeHover?: (nodeId: string | null) => void;
  onNodePreselect?: (selection: DiagramNodeSelection) => void;
  onNodeConfirm?: (selection: DiagramNodeSelection) => void;
  onSelectionUpdate?: (selection: DiagramNodeSelection) => void;
  onSelectionCancel?: () => void;
};

type SelectionHandlers = {
  onNodeHover: (nodeId: string) => void;
  onNodeHoverEnd: () => void;
  onNodePreselect: (nodeId: string) => void;
  onNodeConfirm: (nodeId: string) => void;
};

type UseSelectionModeResult = {
  hoveredSelectableId: string | null;
  handlers: SelectionHandlers;
  toSelection: (nodeId: string) => DiagramNodeSelection | null;
  cameraHandlers: CameraHandlers;
};

export const useSelectionMode = ({
  isActive,
  handlers,
  layoutNodeById,
  selectedNodeId = null,
  preselectedNodeId = null,
  onEnter,
  onExit,
  onNodeHover,
  onNodePreselect,
  onNodeConfirm,
  onSelectionUpdate,
  onSelectionCancel,
}: UseSelectionModeArgs): UseSelectionModeResult => {
  const [hoveredSelectableId, setHoveredSelectableId] =
    useState<string | null>(null);

  const toSelection = useCallback(
    (nodeId: string): DiagramNodeSelection | null => {
      const node = layoutNodeById.get(nodeId);
      if (!node) return null;
      if (node.isCollapsed) {
        return { id: nodeId, type: "collapsedGate" };
      }
      if (node.type === "gate") {
        return { id: nodeId, type: "gate" };
      }
      return { id: nodeId, type: "component" };
    },
    [layoutNodeById]
  );

  useEffect(() => {
    if (isActive) {
      onEnter?.();
    } else {
      onExit?.();
    }
  }, [isActive, onEnter, onExit]);

  useEffect(() => {
    if (isActive) return;
    setHoveredSelectableId(null);
    onNodeHover?.(null);
  }, [isActive, onNodeHover]);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onSelectionCancel?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActive, onSelectionCancel]);

  const selectionTypeRef = useRef<{
    selectedId: string | null;
    selectedType: DiagramNodeType | null;
    preselectedId: string | null;
    preselectedType: DiagramNodeType | null;
  }>({
    selectedId: null,
    selectedType: null,
    preselectedId: null,
    preselectedType: null,
  });

  useEffect(() => {
    if (!onSelectionUpdate) return;

    const updateSelection = (
      nodeId: string | null,
      key: "selected" | "preselected"
    ) => {
      if (!nodeId) {
        if (key === "selected") {
          selectionTypeRef.current.selectedId = null;
          selectionTypeRef.current.selectedType = null;
        } else {
          selectionTypeRef.current.preselectedId = null;
          selectionTypeRef.current.preselectedType = null;
        }
        return;
      }
      const selection = toSelection(nodeId);
      if (!selection) return;
      const currentId =
        key === "selected"
          ? selectionTypeRef.current.selectedId
          : selectionTypeRef.current.preselectedId;
      const currentType =
        key === "selected"
          ? selectionTypeRef.current.selectedType
          : selectionTypeRef.current.preselectedType;
      if (currentId === selection.id && currentType === selection.type) {
        return;
      }
      if (key === "selected") {
        selectionTypeRef.current.selectedId = selection.id;
        selectionTypeRef.current.selectedType = selection.type;
      } else {
        selectionTypeRef.current.preselectedId = selection.id;
        selectionTypeRef.current.preselectedType = selection.type;
      }
      onSelectionUpdate(selection);
    };

    updateSelection(selectedNodeId, "selected");
    updateSelection(preselectedNodeId, "preselected");
  }, [onSelectionUpdate, preselectedNodeId, selectedNodeId, toSelection]);

  const selectionHandlers = useMemo(() => {
    const wrapPointer =
      <T extends (event: PointerEvent<HTMLDivElement>) => void>(handler: T) =>
      (event: PointerEvent<HTMLDivElement>) => {
        const shouldBlock = isActive && hoveredSelectableId !== null;
        if (shouldBlock) return;
        handler(event);
      };

    const wrapWheel =
      <T extends (event: WheelEvent<HTMLDivElement>) => void>(handler: T) =>
      (event: WheelEvent<HTMLDivElement>) => {
        const shouldBlock = isActive && hoveredSelectableId !== null;
        if (shouldBlock) return;
        handler(event);
      };

    return {
      onPointerDown: wrapPointer(handlers.onPointerDown),
      onPointerMove: wrapPointer(handlers.onPointerMove),
      onPointerUp: wrapPointer(handlers.onPointerUp),
      onPointerLeave: wrapPointer(handlers.onPointerLeave),
      onWheel: wrapWheel(handlers.onWheel),
    };
  }, [handlers, hoveredSelectableId, isActive]);

  const handleNodeHover = useCallback(
    (nodeId: string) => {
      if (!isActive) return;
      setHoveredSelectableId(nodeId);
      onNodeHover?.(nodeId);
    },
    [isActive, onNodeHover]
  );

  const handleNodeHoverEnd = useCallback(() => {
    if (!isActive) return;
    setHoveredSelectableId(null);
    onNodeHover?.(null);
  }, [isActive, onNodeHover]);

  const handleNodePreselect = useCallback(
    (nodeId: string) => {
      if (!isActive) return;
      const selection = toSelection(nodeId);
      if (selection) {
        onNodePreselect?.(selection);
      }
    },
    [isActive, onNodePreselect, toSelection]
  );

  const handleNodeConfirm = useCallback(
    (nodeId: string) => {
      if (!isActive) return;
      const selection = toSelection(nodeId);
      if (selection) {
        onNodeConfirm?.(selection);
      }
    },
    [isActive, onNodeConfirm, toSelection]
  );

  return {
    hoveredSelectableId,
    handlers: {
      onNodeHover: handleNodeHover,
      onNodeHoverEnd: handleNodeHoverEnd,
      onNodePreselect: handleNodePreselect,
      onNodeConfirm: handleNodeConfirm,
    },
    toSelection,
    cameraHandlers: selectionHandlers,
  };
};