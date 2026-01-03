import { fetchWithCloudErrorHandling } from "./apiClient";
import { BACKEND_ENDPOINT } from "./graphService";
import { enqueueGraphRequest } from "./graphRequestQueue";

type ReloadFailuresResponse = {
  added_count?: number;
};

export async function reloadFailures(): Promise<number> {
  return enqueueGraphRequest(async () => {
    const response = await fetchWithCloudErrorHandling(
      `${BACKEND_ENDPOINT}/failures/reload`,
      {
      method: "POST",
      },
    );
    const payload: ReloadFailuresResponse = await response.json();
    return payload.added_count ?? 0;
  });
}