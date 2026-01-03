import { useCallback, useEffect, useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

export type QuickClickPayload = {
  button: number;
  position: { x: number; y: number };
};

type QuickClickState = {
  pointerId: number;
  button: number;
  targetId: string;
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
};

type UseQuickClickArgs = {
  targetId: string;
  isEnabled?: boolean;
  thresholdPx?: number;
  thresholdMs?: number;
  onQuickClick?: (payload: QuickClickPayload) => void;
};

export const useQuickClick = ({
  targetId,
  isEnabled = true,
  thresholdPx = 6,
  thresholdMs = 240,
  onQuickClick,
}: UseQuickClickArgs) => {
  const stateRef = useRef<QuickClickState | null>(null);
  const thresholdPxRef = useRef(thresholdPx);
  const thresholdMsRef = useRef(thresholdMs);
  const onQuickClickRef = useRef(onQuickClick);

  useEffect(() => {
    thresholdPxRef.current = thresholdPx;
  }, [thresholdPx]);

  useEffect(() => {
    thresholdMsRef.current = thresholdMs;
  }, [thresholdMs]);

  useEffect(() => {
    onQuickClickRef.current = onQuickClick;
  }, [onQuickClick]);

  const handlePointerMoveRef = useRef<(event: globalThis.PointerEvent) => void>(
    () => {}
  );
  const handlePointerUpRef = useRef<(event: globalThis.PointerEvent) => void>(
    () => {}
  );
  const handlePointerCancelRef = useRef<
    (event: globalThis.PointerEvent) => void
  >(() => {});

  const onWindowPointerMove = useCallback((event: globalThis.PointerEvent) => {
    handlePointerMoveRef.current(event);
  }, []);

  const onWindowPointerUp = useCallback((event: globalThis.PointerEvent) => {
    handlePointerUpRef.current(event);
  }, []);

  const onWindowPointerCancel = useCallback(
    (event: globalThis.PointerEvent) => {
      handlePointerCancelRef.current(event);
    },
    []
  );

  const handlePointerMove = useCallback((event: globalThis.PointerEvent) => {
    const state = stateRef.current;
    if (!state) return;
    if (event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const distance = Math.hypot(dx, dy);
    if (distance > thresholdPxRef.current) {
      state.moved = true;
    }
  }, []);

  const handlePointerUp = useCallback((event: globalThis.PointerEvent) => {
    const state = stateRef.current;
    if (!state) return;
    if (event.pointerId !== state.pointerId) return;

    const elapsed = performance.now() - state.startTime;
    const isQuick =
      !state.moved && elapsed <= thresholdMsRef.current;

    const element = document.elementFromPoint(event.clientX, event.clientY);
    const nodeElement = element?.closest("[data-node-id]");
    const sameTarget =
      nodeElement?.getAttribute("data-node-id") === state.targetId;

    if (isQuick && sameTarget) {
      onQuickClickRef.current?.({
        button: state.button,
        position: { x: event.clientX, y: event.clientY },
      });
    }

    stateRef.current = null;
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerCancel);
  }, [onWindowPointerCancel, onWindowPointerMove, onWindowPointerUp]);

  const handlePointerCancel = useCallback((event: globalThis.PointerEvent) => {
    const state = stateRef.current;
    if (!state) return;
    if (event.pointerId !== state.pointerId) return;
    stateRef.current = null;
    window.removeEventListener("pointermove", onWindowPointerMove);
    window.removeEventListener("pointerup", onWindowPointerUp);
    window.removeEventListener("pointercancel", onWindowPointerCancel);
  }, [onWindowPointerCancel, onWindowPointerMove, onWindowPointerUp]);

  useEffect(() => {
    handlePointerMoveRef.current = handlePointerMove;
  }, [handlePointerMove]);

  useEffect(() => {
    handlePointerUpRef.current = handlePointerUp;
  }, [handlePointerUp]);

  useEffect(() => {
    handlePointerCancelRef.current = handlePointerCancel;
  }, [handlePointerCancel]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!isEnabled) return;
      if (event.button !== 0 && event.button !== 2) return;
      stateRef.current = {
        pointerId: event.pointerId,
        button: event.button,
        targetId,
        startX: event.clientX,
        startY: event.clientY,
        startTime: performance.now(),
        moved: false,
      };
      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerCancel);
    },
    [
      isEnabled,
      onWindowPointerCancel,
      onWindowPointerMove,
      onWindowPointerUp,
      targetId,
    ]
  );

  const onContextMenu = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
    },
    []
  );

  useEffect(() => {
    return () => {
      stateRef.current = null;
      window.removeEventListener("pointermove", onWindowPointerMove);
      window.removeEventListener("pointerup", onWindowPointerUp);
      window.removeEventListener("pointercancel", onWindowPointerCancel);
    };
  }, [onWindowPointerCancel, onWindowPointerMove, onWindowPointerUp]);

  return {
    onPointerDown,
    onContextMenu,
  };
};