import { fetchWithCloudErrorHandling } from "./apiClient";
import { BACKEND_ENDPOINT } from "./graphService";
import { enqueueGraphRequest } from "./graphRequestQueue";

export type NodeDetailsResponse = {
  kind: "component" | "gate";
  id: string;
  snapshot: Record<string, unknown>;
  cache?: Record<string, unknown> | null;
};

export async function getNodeDetails(nodeId: string): Promise<NodeDetailsResponse> {
  return enqueueGraphRequest(async () => {
    const response = await fetchWithCloudErrorHandling(
      `${BACKEND_ENDPOINT}/nodes/${encodeURIComponent(nodeId)}/details`,
    );
    return (await response.json()) as NodeDetailsResponse;
  });
}