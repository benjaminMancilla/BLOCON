import { Size } from "../types";
import { RAIL_PADDING, V_SPACING, GATE_PADDING_Y } from "../utils/constants";

export const measureOrGate = (childSizes: Size[]): Size => {
  const maxWidth = Math.max(...childSizes.map((child) => child.width));
  const totalHeight =
    childSizes.reduce((acc, child) => acc + child.height, 0) +
    V_SPACING * (childSizes.length - 1);
  return {
    width: maxWidth + RAIL_PADDING * 2,
    height: GATE_PADDING_Y + totalHeight,
  };
};