const DEFAULT_GATE_COLORS: Record<string, string> = {
  and: "#2563eb",
  or: "#16a34a",
  koon: "#f97316",
};

const normalizeSubtype = (subtype?: string | null) =>
  subtype?.toLowerCase() ?? "and";

export const resolveGateColor = (
  subtype?: string | null,
  customColor?: string | null
) => {
  const trimmed = customColor?.trim();
  if (trimmed) {
    return trimmed;
  }
  return DEFAULT_GATE_COLORS[normalizeSubtype(subtype)] ?? DEFAULT_GATE_COLORS.and;
};

const parseHexColor = (color: string) => {
  const hex = color.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{3,8}$/.test(hex)) {
    return null;
  }
  if (hex.length === 3 || hex.length === 4) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
    return { r, g, b, a };
  }
  if (hex.length === 6 || hex.length === 8) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }
  return null;
};

const toRgba = (color: string, alpha: number) => {
  const parsed = parseHexColor(color);
  if (!parsed) {
    return null;
  }
  const finalAlpha = Math.min(1, Math.max(0, parsed.a * alpha));
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${finalAlpha})`;
};

export const buildGateColorVars = (color: string) => ({
  "--gate-color": color,
  "--gate-color-soft": toRgba(color, 0.08) ?? color,
  "--gate-color-border": toRgba(color, 0.25) ?? color,
  "--gate-color-label": toRgba(color, 0.16) ?? color,
  "--gate-color-shadow": toRgba(color, 0.25) ?? color,
  "--gate-color-badge": toRgba(color, 0.9) ?? color,
});