import { Size } from "../types";
import { V_SPACING } from "../utils/constants";
import { GateLayoutMetrics } from "../utils/gateLayoutMetrics";

export const measureOrGate = (
  childSizes: Size[],
  metrics: GateLayoutMetrics
): Size => {
  const maxWidth = Math.max(...childSizes.map((child) => child.width));
  const totalHeight =
    childSizes.reduce((acc, child) => acc + child.height, 0) +
    V_SPACING * (childSizes.length - 1);
  return {
    width: maxWidth + metrics.railPaddingLeft + metrics.railPaddingRight,
    height: metrics.gatePaddingY + totalHeight,
  };
};