import { GraphData } from "../core/graph";
import type { OrganizationPayload } from "../features/diagram/types/organization";
import { fetchWithCloudErrorHandling } from "./apiClient";
import { enqueueGraphRequest } from "./graphRequestQueue";

const backendEndpoint = import.meta.env.VITE_BACKEND_ENDPOINT as string | undefined;

export const BACKEND_ENDPOINT = backendEndpoint ?? "http://127.0.0.1:8000";

export async function fetchGraph(): Promise<GraphData> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/graph`);
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    return (await response.json()) as GraphData;
  });
}

export async function insertOrganization(
  payload: OrganizationPayload
): Promise<void> {
  return enqueueGraphRequest(async () => {
    console.log('[INSERT] Sending organization insert:', payload);
    const response = await fetch(`${BACKEND_ENDPOINT}/graph/organization`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    console.log('[INSERT] Response status:', response.status);
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
  });
}

export async function deleteNode(nodeId: string): Promise<void> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(
      `${BACKEND_ENDPOINT}/graph/node/${encodeURIComponent(nodeId)}`,
      {
      method: "DELETE",
      },
    );
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
  });
}

export async function saveCloudGraph(): Promise<void> {
  return enqueueGraphRequest(async () => {
    await fetchWithCloudErrorHandling(
      `${BACKEND_ENDPOINT}/cloud/save`,
      {
        method: "POST",
      },
    );
  });
}

export async function loadCloudGraph(): Promise<void> {
  return enqueueGraphRequest(async () => {
    await fetchWithCloudErrorHandling(
      `${BACKEND_ENDPOINT}/cloud/load`,
      {
        method: "POST",
      },
    );
  });
}

export async function retryCloudOperation(): Promise<void> {
  return enqueueGraphRequest(async () => {
    await fetchWithCloudErrorHandling(`${BACKEND_ENDPOINT}/cloud/retry`, {
      method: "POST",
    });
  });
}

export async function cancelCloudOperation(): Promise<void> {
  return enqueueGraphRequest(async () => {
    await fetchWithCloudErrorHandling(`${BACKEND_ENDPOINT}/cloud/cancel`, {
      method: "POST",
    });
  });
}

export async function undoGraph(): Promise<void> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/graph/undo`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
  });
}

export async function redoGraph(): Promise<void> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/graph/redo`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
  });
}