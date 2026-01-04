import { GATE_PADDING_Y, RAIL_PADDING } from "./constants";

export type GateLayoutMetrics = {
  railPaddingLeft: number;
  railPaddingRight: number;
  railRightOffset: number;
  gatePaddingY: number;
};

const KOON_RIGHT_RAIL_EXTRA = 32;

export const getGateLayoutMetrics = (subtype?: string | null): GateLayoutMetrics => {
  const normalized = subtype?.toLowerCase() ?? "and";

  if (normalized === "koon") {
    return {
      railPaddingLeft: RAIL_PADDING,
      railPaddingRight: RAIL_PADDING + KOON_RIGHT_RAIL_EXTRA,
      railRightOffset: RAIL_PADDING + KOON_RIGHT_RAIL_EXTRA,
      gatePaddingY: GATE_PADDING_Y,
    };
  }

  return {
    railPaddingLeft: RAIL_PADDING,
    railPaddingRight: RAIL_PADDING,
    railRightOffset: 0,
    gatePaddingY: GATE_PADDING_Y,
  };
};