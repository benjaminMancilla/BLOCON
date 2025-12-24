import { useCallback, useEffect, useRef, useState } from "react";

type ShakeAnimationOptions = {
  durationMs: number;
};

type ShakeAnimationResult = {
  shakingItems: Record<string, boolean>;
  triggerShake: (id: string) => void;
};

export const useShakeAnimation = ({
  durationMs,
}: ShakeAnimationOptions): ShakeAnimationResult => {
  const [shakingItems, setShakingItems] = useState<Record<string, boolean>>({});
  const timersRef = useRef<Record<string, number>>({});

  const triggerShake = useCallback(
    (id: string) => {
      setShakingItems((prev) => ({ ...prev, [id]: true }));
      const existingTimer = timersRef.current[id];
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }
      timersRef.current[id] = window.setTimeout(() => {
        setShakingItems((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        delete timersRef.current[id];
      }, durationMs);
    },
    [durationMs],
  );

  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  return { shakingItems, triggerShake };
};