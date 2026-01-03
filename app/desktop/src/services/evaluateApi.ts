import { fetchWithCloudErrorHandling } from "./apiClient";
import { BACKEND_ENDPOINT } from "./graphService";
import { enqueueGraphRequest } from "./graphRequestQueue";

export async function evaluateGraph(): Promise<void> {
  return enqueueGraphRequest(async () => {
    await fetchWithCloudErrorHandling(`${BACKEND_ENDPOINT}/evaluate`, {
      method: "POST",
    });
  });
}