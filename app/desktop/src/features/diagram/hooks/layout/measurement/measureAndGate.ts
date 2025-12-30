import { Size } from "../types";
import { H_SPACING, GATE_PADDING_Y } from "../utils/constants";

export const measureAndGate = (childSizes: Size[]): Size => {
  const totalWidth =
    childSizes.reduce((acc, child) => acc + child.width, 0) +
    H_SPACING * (childSizes.length - 1);
  const maxHeight = Math.max(...childSizes.map((child) => child.height));
  return {
    width: totalWidth,
    height: GATE_PADDING_Y + maxHeight,
  };
};