import { GraphData } from "../core/graph";

const backendEndpoint = import.meta.env.VITE_BACKEND_ENDPOINT as string | undefined;

export const BACKEND_ENDPOINT = backendEndpoint ?? "http://127.0.0.1:8000";

export async function fetchGraph(): Promise<GraphData> {
  const response = await fetch(`${BACKEND_ENDPOINT}/graph`);
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}`);
  }
  return (await response.json()) as GraphData;
}