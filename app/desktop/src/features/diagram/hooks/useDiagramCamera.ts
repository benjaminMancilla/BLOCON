import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";

type CameraState = {
  x: number;
  y: number;
  scale: number;
};

type CameraHandlers = {
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
  onWheel: (event: React.WheelEvent<HTMLDivElement>) => void;
};

type UseDiagramCameraResult = {
  cameraStyle: React.CSSProperties;
  handlers: CameraHandlers;
  camera: CameraState;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const useDiagramCamera = (): UseDiagramCameraResult => {
  const [camera, setCamera] = useState<CameraState>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const activePointerId = useRef<number | null>(null);

  const updateCamera = useCallback((next: Partial<CameraState>) => {
    setCamera((current) => ({ ...current, ...next }));
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      activePointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      lastPoint.current = { x: event.clientX, y: event.clientY };
    },
    []
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== event.pointerId) return;
      if (!lastPoint.current) return;
      event.preventDefault();
      const deltaX = event.clientX - lastPoint.current.x;
      const deltaY = event.clientY - lastPoint.current.y;

      lastPoint.current = { x: event.clientX, y: event.clientY };
      setCamera((current) => ({
        ...current,
        x: current.x + deltaX,
        y: current.y + deltaY,
      }));
    },
    []
  );

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    lastPoint.current = null;
    activePointerId.current = null;
  }, []);

  const onPointerLeave = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerId.current !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) return;
      lastPoint.current = null;
      activePointerId.current = null;
    },
    []
  );

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      const zoomFactor = direction > 0 ? 1.1 : 0.9;
      const nextScale = clamp(camera.scale * zoomFactor, 0.5, 3);

      const rect = event.currentTarget.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;
      const dx = (offsetX - camera.x) / camera.scale;
      const dy = (offsetY - camera.y) / camera.scale;

      updateCamera({
        scale: nextScale,
        x: offsetX - dx * nextScale,
        y: offsetY - dy * nextScale,
      });
    },
    [camera.scale, camera.x, camera.y, updateCamera]
  );

  const cameraStyle = useMemo(
    () => ({
      transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`,
    }),
    [camera.x, camera.y, camera.scale]
  );

  return {
    cameraStyle,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave,
      onWheel,
    },
    camera,
  };
};