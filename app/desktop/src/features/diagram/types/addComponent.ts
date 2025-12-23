export type CalculationType = "exponential" | "weibull";

export type AddComponentFormState = {
  componentId: string | null;
  calculationType: CalculationType;
};