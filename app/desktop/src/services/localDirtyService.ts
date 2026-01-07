import { BACKEND_ENDPOINT } from "./graphService";

export type LocalDirtyStatus = {
  dirty: boolean;
  local_events_count: number;
};

export async function fetchLocalDirty(): Promise<LocalDirtyStatus> {
  const response = await fetch(`${BACKEND_ENDPOINT}/local/dirty`);
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}`);
  }
  const payload = (await response.json()) as Partial<LocalDirtyStatus>;
  const count = Number(payload.local_events_count ?? 0);
  return {
    dirty: Boolean(payload.dirty ?? count > 0),
    local_events_count: Number.isFinite(count) ? count : 0,
  };
}