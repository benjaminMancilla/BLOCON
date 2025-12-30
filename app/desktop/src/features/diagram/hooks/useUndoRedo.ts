import { useCallback, useEffect, useRef } from "react";
import { redoGraph, undoGraph } from "../../../services/graphService";

type UseUndoRedoOptions = {
  isBlocked: boolean;
  onCompleted: () => void;
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select";
};

export const useUndoRedo = ({ isBlocked, onCompleted }: UseUndoRedoOptions) => {
  const isBlockedRef = useRef(isBlocked);
  const onCompletedRef = useRef(onCompleted);

  useEffect(() => {
    isBlockedRef.current = isBlocked;
  }, [isBlocked]);

  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  const runUndo = useCallback(async () => {
    if (isBlockedRef.current) return;
    await undoGraph();
    onCompletedRef.current();
  }, []);

  const runRedo = useCallback(async () => {
    if (isBlockedRef.current) return;
    await redoGraph();
    onCompletedRef.current();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey) return;
      if (isEditableTarget(event.target)) return;
      if (!event.ctrlKey) return;
      if (event.shiftKey) return;

      if (event.key === "z" || event.key === "Z") {
        event.preventDefault();
        void runUndo();
      }

      if (event.key === "y" || event.key === "Y") {
        event.preventDefault();
        void runRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runRedo, runUndo]);
};