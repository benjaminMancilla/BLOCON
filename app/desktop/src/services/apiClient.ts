import type { CloudError } from "./cloudErrors";
import { parseCloudErrorPayload } from "./cloudErrors";
import { openCloudError } from "./cloudErrorStore";
import { logCloudAction } from "./appLogger";

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const buildCloudErrorMessage = (
  response: Response,
  cloudError: CloudError | null,
) => {
  if (cloudError?.message) return cloudError.message;
  return `Backend responded with ${response.status}`;
};

export const getCloudErrorFromError = (error: unknown): CloudError | null => {
  if (error instanceof ApiError) {
    return parseCloudErrorPayload(error.payload);
  }
  return null;
};

export const isRetryableCloudError = (error: unknown): boolean => {
  const cloudError = getCloudErrorFromError(error);
  return Boolean(cloudError?.retryable && cloudError.hasPendingOperation);
};

export async function fetchWithCloudErrorHandling(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === "string" ? input : (input as Request).url;
  const method = init?.method ?? "GET";
  await logCloudAction("cloud-request", { method, url });
  const response = await fetch(input, init);
  if (response.ok) {
    await logCloudAction("cloud-response", { method, url, status: response.status });
    return response;
  }

  let payload: unknown;
  try {
    payload = await response.clone().json();
  } catch (error) {
    payload = undefined;
  }

  const cloudError = parseCloudErrorPayload(payload);
  if (cloudError?.retryable && cloudError.hasPendingOperation) {
    openCloudError(cloudError);
  }

  await logCloudAction("cloud-error", {
    method,
    url,
    status: response.status,
    payload,
  });

  throw new ApiError(buildCloudErrorMessage(response, cloudError), response.status, payload);
}