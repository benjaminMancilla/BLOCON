import { BACKEND_ENDPOINT } from "./graphService";
import { enqueueGraphRequest } from "./graphRequestQueue";

export type NodeEditErrorPayload = {
  status?: string;
  error?: {
    kind?: string;
    field?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
};

export class NodeEditApiError extends Error {
  field?: string;
  details?: Record<string, unknown>;
  kind?: string;
  status?: number;

  constructor(message: string, options?: Partial<NodeEditApiError>) {
    super(message);
    this.name = "NodeEditApiError";
    Object.assign(this, options);
  }
}

const parseEditError = async (
  response: Response
): Promise<NodeEditApiError> => {
  let payload: NodeEditErrorPayload | null = null;
  try {
    payload = (await response.json()) as NodeEditErrorPayload;
  } catch {
    payload = null;
  }

  const message =
    payload?.error?.message ?? `Backend responded with ${response.status}`;

  return new NodeEditApiError(message, {
    field: payload?.error?.field,
    details: payload?.error?.details,
    kind: payload?.error?.kind,
    status: response.status,
  });
};

export async function patchGate(
  gateId: string,
  patch: Record<string, unknown>
): Promise<void> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(
      `${BACKEND_ENDPOINT}/graph/gate/${encodeURIComponent(gateId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ patch }),
      }
    );

    if (!response.ok) {
      throw await parseEditError(response);
    }
  });
}

export async function patchComponent(
  componentId: string,
  patch: Record<string, unknown>
): Promise<void> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(
      `${BACKEND_ENDPOINT}/graph/component/${encodeURIComponent(componentId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ patch }),
      }
    );

    if (!response.ok) {
      throw await parseEditError(response);
    }
  });
}