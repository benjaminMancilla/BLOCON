export type CloudErrorPayload = {
  status: "error";
  error: {
    kind: "cloud";
    operation?: string;
    retryable: boolean;
    has_pending_operation: boolean;
    message: string;
    details?: string;
  };
};

export type CloudError = {
  operation?: string;
  message: string;
  details?: string;
  retryable: boolean;
  hasPendingOperation: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const parseCloudErrorPayload = (payload: unknown): CloudError | null => {
  if (!isRecord(payload)) return null;
  if (payload.status !== "error") return null;
  const error = payload.error;
  if (!isRecord(error)) return null;
  if (error.kind !== "cloud") return null;
  if (typeof error.message !== "string") return null;
  if (typeof error.retryable !== "boolean") return null;
  if (typeof error.has_pending_operation !== "boolean") return null;

  return {
    operation:
      typeof error.operation === "string" ? error.operation : undefined,
    message: error.message,
    details: typeof error.details === "string" ? error.details : undefined,
    retryable: error.retryable,
    hasPendingOperation: error.has_pending_operation,
  };
};