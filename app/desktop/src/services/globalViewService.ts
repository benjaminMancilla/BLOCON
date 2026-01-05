import { BACKEND_ENDPOINT } from "./graphService";
import { enqueueGraphRequest } from "./graphRequestQueue";
import type { DiagramViewState } from "./diagramViewService";

type GlobalViewPayload = {
  exists: boolean;
  view: DiagramViewState | null;
};

type GlobalViewResponse = {
  globalView?: GlobalViewPayload | null;
};

const normalizeGlobalView = (
  payload?: GlobalViewPayload | null,
): GlobalViewPayload => {
  return {
    exists: Boolean(payload?.exists),
    view: payload?.view ?? null,
  };
};

export async function fetchGlobalView(): Promise<GlobalViewPayload> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/views/global`);
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as GlobalViewResponse;
    return normalizeGlobalView(data.globalView ?? undefined);
  });
}

export async function saveGlobalView(view: DiagramViewState): Promise<void> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/views/global`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ view }),
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
  });
}

export async function deleteGlobalView(): Promise<{ deleted: boolean }> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/views/global`, {
      method: "DELETE",
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as { deleted?: boolean };
    return { deleted: Boolean(data.deleted) };
  });
}

export async function reloadGlobalView(): Promise<GlobalViewPayload> {
  return enqueueGraphRequest(async () => {
    const response = await fetch(`${BACKEND_ENDPOINT}/views/global/reload`, {
      method: "POST",
    });
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = (await response.json()) as GlobalViewResponse;
    return normalizeGlobalView(data.globalView ?? undefined);
  });
}