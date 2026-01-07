import { uiTokens } from "./tokens";

export type GradientSection =
  | "app"
  | "canvas"
  | "panel"
  | "panelAlt"
  | "topbar"
  | "modal"
  | "toast";

const buildGradient = (blueAlpha: number, orangeAlpha: number) =>
  `radial-gradient(circle at 18% 22%, rgba(59, 130, 246, ${blueAlpha}) 0%, rgba(255, 255, 255, 0) 55%),` +
  `radial-gradient(circle at 82% 78%, rgba(249, 115, 22, ${orangeAlpha}) 0%, rgba(255, 255, 255, 0) 55%),` +
  uiTokens.colors.surface;

export const gradientBySection = (section: GradientSection): string => {
  switch (section) {
    case "canvas":
      return buildGradient(0.26, 0.22);
    case "panel":
      return buildGradient(0.22, 0.18);
    case "panelAlt":
      return buildGradient(0.18, 0.24);
    case "topbar":
      return buildGradient(0.2, 0.18);
    case "modal":
      return buildGradient(0.2, 0.16);
    case "toast":
      return buildGradient(0.18, 0.14);
    case "app":
    default:
      return buildGradient(0.28, 0.24);
  }
};