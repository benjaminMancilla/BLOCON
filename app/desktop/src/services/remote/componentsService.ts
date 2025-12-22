import { BACKEND_ENDPOINT } from "../graphService";

export type RemoteComponent = {
  id: string;
  title?: string;
  kks_name?: string;
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

const normalizeResponse = (data: unknown): RemoteComponentSearchResponse => {
  if (Array.isArray(data) && data.length === 2 && Array.isArray(data[0])) {
    return {
      items: data[0] as RemoteComponent[],
      total: Number(data[1]) || (data[0] as RemoteComponent[]).length,
    };
  }

  if (data && typeof data === "object" && "items" in data) {
    const typed = data as { items?: RemoteComponent[]; total?: number };
    return {
      items: typed.items ?? [],
      total: typed.total ?? typed.items?.length ?? 0,
    };
  }

  if (Array.isArray(data)) {
    return { items: data as RemoteComponent[], total: data.length };
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

  const response = await fetch(url.toString(), { signal: options.signal });
  if (!response.ok) {
    throw new Error(`Remote search failed (${response.status})`);
  }
  const data = (await response.json()) as unknown;
  return normalizeResponse(data);
}