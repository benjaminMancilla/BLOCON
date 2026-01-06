export const motionTokens = {
  duration: {
    fast: "180ms",
    medium: "320ms",
    slow: "520ms",
  },
  easing: {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    emphasized: "cubic-bezier(0.2, 0.8, 0.2, 1)",
  },
} as const;

export const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;