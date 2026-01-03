import { BACKEND_ENDPOINT } from "../graphService";
import { fetchWithCloudErrorHandling } from "../apiClient";

export type RemoteComponent = {
  id: string;
  title?: string;
  kks_name: string;
  name?: string;
  type?: string;
  SubType?: string;
  insID?: string | number;
  updated_at?: string;
};

export type RemoteComponentSearchResponse = {
  items: RemoteComponent[];
  total: number;
};

type SearchOptions = {
  signal?: AbortSignal;
};

const ensureKksName = (item: any): RemoteComponent => ({
  ...item,
  kks_name: item.kks_name || item.name || item.title || item.id || "Sin nombre",
});

const normalizeResponse = (data: unknown): RemoteComponentSearchResponse => {
  if (Array.isArray(data) && data.length === 2 && Array.isArray(data[0])) {
    const items = (data[0] as any[]).map(ensureKksName);
    return {
      items,
      total: Number(data[1]) || items.length,
    };
  }

  if (data && typeof data === "object" && "items" in data) {
    const typed = data as { items?: any[]; total?: number };
    const items = (typed.items ?? []).map(ensureKksName);
    return {
      items,
      total: typed.total ?? items.length,
    };
  }

  if (Array.isArray(data)) {
    const items = (data as any[]).map(ensureKksName);
    return { items, total: items.length };
  }

  return { items: [], total: 0 };
};

export async function searchRemoteComponents(
  query: string,
  page = 1,
  pageSize = 20,
  options: SearchOptions = {},
): Promise<RemoteComponentSearchResponse> {
  const url = new URL(`${BACKEND_ENDPOINT}/remote/components/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("page_size", String(pageSize));

  const response = await fetchWithCloudErrorHandling(url.toString(), {
    signal: options.signal,
  });
  const data = (await response.json()) as unknown;
  return normalizeResponse(data);
}