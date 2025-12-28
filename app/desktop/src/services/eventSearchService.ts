import { BACKEND_ENDPOINT } from "./graphService";
import { enqueueGraphRequest } from "./graphRequestQueue";
import type { EventHistoryResponse } from "./eventHistoryService";

export type EventSearchCriteria =
  | { type: "version"; version: number }
  | { type: "kind"; kindPrefix: string; kindList: string[] }
  | { type: "timestamp"; value: string };

type EventSearchParams = {
  criteria: EventSearchCriteria;
  offset: number;
  limit: number;
};

export async function searchEventHistoryPage({
  criteria,
  offset,
  limit,
}: EventSearchParams): Promise<EventHistoryResponse> {
  const query = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });

  if (criteria.type === "version") {
    query.set("version", String(criteria.version));
  }

  if (criteria.type === "timestamp") {
    query.set("timestamp", criteria.value);
  }

  if (criteria.type === "kind") {
    if (criteria.kindPrefix) {
      query.set("kind_prefix", criteria.kindPrefix);
    }
    if (criteria.kindList.length > 0) {
      query.set("kinds", criteria.kindList.join(","));
    }
  }

  return enqueueGraphRequest(async () => {
    const response = await fetch(
      `${BACKEND_ENDPOINT}/event-history/search?${query}`,
    );
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    return (await response.json()) as EventHistoryResponse;
  });
}