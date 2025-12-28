import { BACKEND_ENDPOINT } from "./graphService";
import { enqueueGraphRequest } from "./graphRequestQueue";

export type EventHistoryItem = {
  version?: number;
  kind?: string;
  ts?: string;
  payload?: unknown;
  [key: string]: unknown;
};

export type EventHistoryResponse = {
  events: EventHistoryItem[];
  total: number;
  offset: number;
  limit: number;
};

type EventHistoryParams = {
  offset: number;
  limit: number;
};

export async function fetchEventHistoryPage({
  offset,
  limit,
}: EventHistoryParams): Promise<EventHistoryResponse> {
  const query = new URLSearchParams({
    offset: String(offset),
    limit: String(limit),
  });

  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/event-history?${query}`);
        if (!response.ok) {
            throw new Error(`Backend responded with ${response.status}`);
        }
        return (await response.json()) as EventHistoryResponse;
  });
}