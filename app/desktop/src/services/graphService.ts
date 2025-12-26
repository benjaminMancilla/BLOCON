import { GraphData } from "../core/graph";
import type { OrganizationPayload } from "../features/diagram/types/organization";

const backendEndpoint = import.meta.env.VITE_BACKEND_ENDPOINT as string | undefined;

export const BACKEND_ENDPOINT = backendEndpoint ?? "http://127.0.0.1:8000";

export async function fetchGraph(): Promise<GraphData> {
  const response = await fetch(`${BACKEND_ENDPOINT}/graph`);
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}`);
  }
  return (await response.json()) as GraphData;
}

export async function insertOrganization(
  payload: OrganizationPayload
): Promise<void> {
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
}

export async function saveCloudGraph(): Promise<void> {
  const response = await fetch(`${BACKEND_ENDPOINT}/cloud/save`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}`);
  }
}

export async function loadCloudGraph(): Promise<void> {
  const response = await fetch(`${BACKEND_ENDPOINT}/cloud/load`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}`);
  }
}