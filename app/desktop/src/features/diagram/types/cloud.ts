export type CloudAction = "save" | "load";

export type CloudToast = {
  message: string;
  type: "success" | "error";
  token: number;
};