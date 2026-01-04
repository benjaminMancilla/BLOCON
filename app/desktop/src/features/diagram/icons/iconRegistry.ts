import gateTypesData from "../../../../../assets/gate_types.json";
import unitTypesData from "../../../../../assets/unit_types.json";
import genericIconUrl from "../../../../../assets/icons/generic.png";

type GateTypesPayload = {
  gate_types?: string[];
};

type UnitTypesPayload = {
  unit_types?: string[];
};

const gateTypeList = new Set(
  (gateTypesData as GateTypesPayload).gate_types ?? [],
);

const unitTypeList = new Set(
  (unitTypesData as UnitTypesPayload).unit_types ?? [],
);

const gateIcons = import.meta.glob(
  "../../../../../assets/icons/gates/*.png",
  {
    eager: true,
    import: "default",
  },
);

const componentIcons = import.meta.glob(
  "../../../../../assets/icons/components/*.png",
  {
    eager: true,
    import: "default",
  },
);

const buildIconMap = (icons: Record<string, string>) => {
  return Object.entries(icons).reduce<Record<string, string>>(
    (acc, [path, url]) => {
      const name = path.split("/").pop()?.replace(/\.png$/i, "");
      if (name) acc[name] = url;
      return acc;
    },
    {},
  );
};

const gateIconMap = buildIconMap(gateIcons as Record<string, string>);
const componentIconMap = buildIconMap(componentIcons as Record<string, string>);

const normalizeKey = (value: string | null | undefined) => {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : null;
};

const resolveIcon = (
  key: string | null,
  validTypes: Set<string>,
  iconMap: Record<string, string>,
) => {
  if (!key) return genericIconUrl;
  if (!validTypes.has(key)) return genericIconUrl;
  return iconMap[key] ?? genericIconUrl;
};

export const getGateIcon = (subtype: string | null | undefined): string => {
  const key = normalizeKey(subtype);
  return resolveIcon(key, gateTypeList, gateIconMap);
};

export const getComponentIcon = (type: string | null | undefined): string => {
  const key = normalizeKey(type);
  return resolveIcon(key, unitTypeList, componentIconMap);
};