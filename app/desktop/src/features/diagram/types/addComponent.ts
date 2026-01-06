export type CalculationType = "exponential" | "weibull";

export type AddComponentAutoTarget = {
  hostId: string;
  hostType: "component" | "gate";
};

export type AddComponentEntryPoint = "topbar" | "context_menu";

export type AddComponentFormState = {
  componentId: string | null;
  calculationType: CalculationType;
  autoTarget?: AddComponentAutoTarget | null;
  entryPoint?: AddComponentEntryPoint | null;
};