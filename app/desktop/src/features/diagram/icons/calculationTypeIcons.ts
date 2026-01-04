import type { CalculationType } from "../types/addComponent";

export type CalculationTypeOption = {
  value: CalculationType;
  label: string;
  icon: string;
};

export const calculationTypeOptions: CalculationTypeOption[] = [
  {
    value: "exponential",
    label: "Exponencial",
    icon: "λ",
  },
  {
    value: "weibull",
    label: "Weibull",
    icon: "β",
  },
];

export const normalizeCalculationType = (
  value?: string | null
): CalculationType | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("wei")) return "weibull";
  if (normalized.startsWith("exp")) return "exponential";
  return null;
};

export const getCalculationTypeOption = (
  value?: string | null
): CalculationTypeOption | null => {
  const normalized = normalizeCalculationType(value);
  if (!normalized) return null;
  return calculationTypeOptions.find((option) => option.value === normalized) ?? null;
};

export const formatCalculationTypeLabel = (value?: string | null): string => {
  const option = getCalculationTypeOption(value);
  if (option) return option.label;
  if (!value) return "—";
  const trimmed = value.trim();
  return trimmed ? trimmed : "—";
};