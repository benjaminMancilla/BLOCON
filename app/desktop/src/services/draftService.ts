import { BACKEND_ENDPOINT } from "./graphService";
import { enqueueGraphRequest } from "./graphRequestQueue";

export type DraftSummary = {
  id: string;
  name: string;
  savedAt: string | null;
  baseVersion: number | null;
  eventsCount: number | null;
};

type DraftApiEntry = {
  id: string;
  name?: string | null;
  saved_at?: string | null;
  base_version?: number | null;
  events_count?: number | null;
};

type DraftApiWrapper = {
  id: string;
  meta?: DraftApiEntry | null;
};

type DraftLoadResponse = {
  status: "ok" | "conflict" | "missing";
  deleted?: boolean;
  draft?: DraftApiWrapper;
};

export type DraftListResult = {
  items: DraftSummary[];
  maxDrafts: number;
  draftCount: number;
  isFull: boolean;
};

const normalizeDraft = (entry: DraftApiEntry | DraftApiWrapper): DraftSummary => {
  const data: DraftApiEntry = "meta" in entry ? (entry.meta ?? {} as DraftApiEntry) : entry;
  const draftName =
    typeof data.name === "string" && data.name.trim()
      ? data.name.trim()
      : "Borrador sin nombre";
  return {
    id: entry.id,
    name: draftName,
    savedAt: data.saved_at ?? null,
    baseVersion: data.base_version ?? null,
    eventsCount: data.events_count ?? null,
  };
};

export async function listDrafts(): Promise<DraftListResult> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/drafts`);
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as {
      items?: DraftApiEntry[];
      maxDrafts?: number;
      draftCount?: number;
      isFull?: boolean;
    };
    const items = (data.items ?? []).map((entry) => normalizeDraft(entry));
    const maxDrafts = data.maxDrafts ?? items.length;
    const draftCount = data.draftCount ?? items.length;
    return {
      items,
      maxDrafts,
      draftCount,
      isFull: data.isFull ?? draftCount >= maxDrafts,
    };
  });
}

export async function createDraft(name?: string): Promise<DraftSummary> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/drafts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as { draft?: DraftApiWrapper };
    if (!data.draft) {
      throw new Error("Missing draft payload");
    }
    return normalizeDraft(data.draft);
  });
}

export async function saveDraft(
  draftId: string,
  name?: string,
): Promise<DraftSummary> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/drafts/${draftId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as { draft?: DraftApiWrapper };
    if (!data.draft) {
      throw new Error("Missing draft payload");
    }
    return normalizeDraft(data.draft);
  });
}

export async function renameDraft(
  draftId: string,
  name: string,
): Promise<DraftSummary> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/drafts/${draftId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as { draft?: DraftApiWrapper };
    if (!data.draft) {
      throw new Error("Missing draft payload");
    }
    return normalizeDraft(data.draft);
  });
}

export async function loadDraft(
  draftId: string,
): Promise<{ status: DraftLoadResponse["status"]; draft?: DraftSummary; deleted?: boolean }> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/drafts/${draftId}/load`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as DraftLoadResponse;
    return {
      status: data.status,
      deleted: data.deleted,
      draft: data.draft ? normalizeDraft(data.draft) : undefined,
    };
  });
}

export async function deleteDraft(draftId: string): Promise<boolean> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/drafts/${draftId}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as { deleted?: boolean };
    return Boolean(data.deleted);
  });
}