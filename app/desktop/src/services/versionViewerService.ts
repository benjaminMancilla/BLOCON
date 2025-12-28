import { GraphData } from "../core/graph";
import { BACKEND_ENDPOINT } from "./graphService";
import { enqueueGraphRequest } from "./graphRequestQueue";

export async function fetchGraphAtVersion(
  version: number,
): Promise<GraphData> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(
      `${BACKEND_ENDPOINT}/event-history/version/${version}/graph`,
    );
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    return (await response.json()) as GraphData;
  });
}

export async function rebuildGraphAtVersion(version: number): Promise<void> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(
      `${BACKEND_ENDPOINT}/event-history/version/${version}/rebuild`,
      {
        method: "POST",
      },
    );
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
  });
}