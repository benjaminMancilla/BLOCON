import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiagramGateArea, DiagramLayoutNode } from "./useDiagramLayout";

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

type UseDiagramCameraOptions = {
  viewportRef: React.RefObject<HTMLDivElement>;
  nodes: DiagramLayoutNode[];
  gateAreas: DiagramGateArea[];
};

type UseDiagramCameraResult = {
  cameraStyle: React.CSSProperties;
  handlers: CameraHandlers;
  camera: CameraState;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const BOUNDS_PADDING_WORLD_WIDTH = 2600;
const BOUNDS_PADDING_WORLD_HEIGHT = 900;
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PanRange = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

const addPadding = (rect: Rect, padding_width: number, padding_height: number): Rect => ({
  x: rect.x - padding_width,
  y: rect.y - padding_height,
  width: rect.width + padding_width * 2,
  height: rect.height + padding_height * 2,
});

const getBoundsFromNodes = (nodes: DiagramLayoutNode[]): Rect | null => {
  if (nodes.length === 0) return null;
  const bounds = nodes.reduce(
    (acc, node) => {
      acc.minX = Math.min(acc.minX, node.x);
      acc.minY = Math.min(acc.minY, node.y);
      acc.maxX = Math.max(acc.maxX, node.x + node.width);
      acc.maxY = Math.max(acc.maxY, node.y + node.height);
      return acc;
    },
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY,
    }
  );

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
    return null;
  }

  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX,
    height: bounds.maxY - bounds.minY,
  };
};

const computeDiagramBounds = (
  nodes: DiagramLayoutNode[],
  gateAreas: DiagramGateArea[]
): Rect | null => {
  const rootGateArea = gateAreas.find((area) => area.parentId === null);
  console.log(rootGateArea)
  if (rootGateArea) {
    return addPadding(
      {
        x: rootGateArea.x,
        y: rootGateArea.y,
        width: rootGateArea.width,
        height: rootGateArea.height,
      },
      BOUNDS_PADDING_WORLD_WIDTH,
      BOUNDS_PADDING_WORLD_HEIGHT
    );
  }

  const rootNode = nodes.find((node) => node.parentGateId === null) ?? null;
  if (rootNode) {
    return addPadding(
      {
        x: rootNode.x,
        y: rootNode.y,
        width: rootNode.width,
        height: rootNode.height,
      },
      BOUNDS_PADDING_WORLD_WIDTH,
      BOUNDS_PADDING_WORLD_HEIGHT
    );
  }

  const fallbackBounds = getBoundsFromNodes(nodes);
  return fallbackBounds ? addPadding(fallbackBounds, BOUNDS_PADDING_WORLD_WIDTH, BOUNDS_PADDING_WORLD_HEIGHT) : null;
};

const computeAllowedPanRange = (
  bounds: Rect | null,
  viewportSize: { width: number; height: number },
  scale: number
): PanRange | null => {
  if (!bounds) return null;
  const vw = viewportSize.width;
  const vh = viewportSize.height;
  if (vw <= 0 || vh <= 0) return null;

  const left = bounds.x * scale;
  const right = (bounds.x + bounds.width) * scale;
  const top = bounds.y * scale;
  const bottom = (bounds.y + bounds.height) * scale;

  const bw = right - left;
  const bh = bottom - top;

  const pad = 12;

  let minX: number, maxX: number;
  let minY: number, maxY: number;

  // --- X ---
  if (bw <= vw - pad * 2) {
    minX = pad - left;
    maxX = (vw - pad) - right;
  } else {
    minX = (vw - pad) - right;
    maxX = pad - left;
  }

  // --- Y ---
  if (bh <= vh - pad * 2) {
    minY = pad - top;
    maxY = (vh - pad) - bottom;
  } else {
    minY = (vh - pad) - bottom;
    maxY = pad - top;
  }

  const t = clamp((1 - scale) / (1 - MIN_SCALE), 0, 1);
  const extra = 100 * t;
  minX -= extra;
  maxX += extra;
  minY -= extra;
  maxY += extra;

  return { minX, maxX, minY, maxY };
};

const clampPan = (
  pan: { x: number; y: number },
  range: PanRange | null
) => {
  if (!range) return pan;
  return {
    x: clamp(pan.x, range.minX, range.maxX),
    y: clamp(pan.y, range.minY, range.maxY),
  };
};

export const useDiagramCamera = ({
  viewportRef,
  nodes,
  gateAreas,
}: UseDiagramCameraOptions): UseDiagramCameraResult => {
  const [camera, setCamera] = useState<CameraState>({
    x: 0,
    y: 0,
    scale: 1,
  });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const activePointerId = useRef<number | null>(null);
  const diagramBounds = useMemo(
    () => computeDiagramBounds(nodes, gateAreas),
    [gateAreas, nodes]
  );

  const allowedPanRange = useMemo(
    () => computeAllowedPanRange(diagramBounds, viewportSize, camera.scale),
    [camera.scale, diagramBounds, viewportSize]
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = () => {
      const rect = viewport.getBoundingClientRect();
      setViewportSize({ width: rect.width, height: rect.height });
    };
    updateSize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateSize);
      return () => window.removeEventListener("resize", updateSize);
    }
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [viewportRef]);

  useEffect(() => {
    setCamera((current) => {
      const range = computeAllowedPanRange(
        diagramBounds,
        viewportSize,
        current.scale
      );
      if (!range) return current;
      const clamped = clampPan(current, range);
      if (clamped.x === current.x && clamped.y === current.y) return current;
      return { ...current, ...clamped };
    });
  }, [diagramBounds, viewportSize]);

  const applyZoom = useCallback(
    (nextScale: number, anchor: { x: number; y: number }) => {
      setCamera((current) => {
        const clampedScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
        const dx = (anchor.x - current.x) / current.scale;
        const dy = (anchor.y - current.y) / current.scale;
        const nextPan = {
          x: anchor.x - dx * clampedScale,
          y: anchor.y - dy * clampedScale,
        };
        const range = computeAllowedPanRange(
          diagramBounds,
          viewportSize,
          clampedScale
        );
        const clampedPan = clampPan(nextPan, range);
        return {
          ...current,
          scale: clampedScale,
          ...clampedPan,
        };
      });
    },
    [diagramBounds, viewportSize]
  );

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
        ...clampPan(
          { x: current.x + deltaX, y: current.y + deltaY },
          allowedPanRange
        ),
      }));
    },
    [allowedPanRange]
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

      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const nextScale = camera.scale * zoomFactor;

      const rect = event.currentTarget.getBoundingClientRect();
      const anchor = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };

      applyZoom(nextScale, anchor);
    },
    [applyZoom, camera.scale]
  );

  const cameraStyle = useMemo(
    () => ({
      transformOrigin: "0 0",
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