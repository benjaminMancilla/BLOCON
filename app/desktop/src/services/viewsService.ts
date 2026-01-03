import { BACKEND_ENDPOINT } from "./graphService";
import { enqueueGraphRequest } from "./graphRequestQueue";

export type ViewSummary = {
  id: string;
  name: string;
  savedAt: string | null;
};

type ViewApiEntry = {
  id: string;
  name?: string | null;
  saved_at?: string | null;
};

type ViewApiWrapper = {
  id: string;
  meta?: ViewApiEntry | null;
};

type ViewLoadResponse = {
  status: "ok" | "missing";
  view?: ViewApiWrapper;
};

const normalizeView = (entry: ViewApiEntry | ViewApiWrapper): ViewSummary => {
  const data: ViewApiEntry = "meta" in entry ? (entry.meta ?? ({} as ViewApiEntry)) : entry;
  const viewName =
    typeof data.name === "string" && data.name.trim()
      ? data.name.trim()
      : "Vista sin nombre";
  return {
    id: entry.id,
    name: viewName,
    savedAt: data.saved_at ?? null,
  };
};

export async function listViews(): Promise<ViewSummary[]> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/views`);
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as { views?: ViewApiEntry[] };
    return (data.views ?? []).map((entry) => normalizeView(entry));
  });
}

export async function createView(name?: string): Promise<ViewSummary> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/views`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as { view?: ViewApiWrapper };
    if (!data.view) {
      throw new Error("Missing view payload");
    }
    return normalizeView(data.view);
  });
}

export async function saveView(viewId: string, name?: string): Promise<ViewSummary> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/views/${viewId}/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as { view?: ViewApiWrapper };
    if (!data.view) {
      throw new Error("Missing view payload");
    }
    return normalizeView(data.view);
  });
}

export async function renameView(viewId: string, name: string): Promise<ViewSummary> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/views/${viewId}/rename`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as { view?: ViewApiWrapper };
    if (!data.view) {
      throw new Error("Missing view payload");
    }
    return normalizeView(data.view);
  });
}

export async function loadView(
  viewId: string,
): Promise<{ status: ViewLoadResponse["status"]; view?: ViewSummary }> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/views/${viewId}/load`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as ViewLoadResponse;
    return {
      status: data.status,
      view: data.view ? normalizeView(data.view) : undefined,
    };
  });
}

export async function deleteView(viewId: string): Promise<boolean> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/views/${viewId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as { deleted?: boolean };
    return Boolean(data.deleted);
  });
}