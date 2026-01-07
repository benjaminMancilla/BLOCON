import type { FailureType, FailuresCache, FailuresCacheEntry, FailureCacheRow } from "../../../core/graph";

const toFailureType = (value: unknown): FailureType | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (normalized === "M1" || normalized === "M2") {
    return normalized;
  }
  return null;
};

const toTimestamp = (value: unknown): number | null => {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const getFailureRows = (entry: FailuresCacheEntry | FailureCacheRow[] | null | undefined) => {
  if (!entry) return [] as FailureCacheRow[];
  if (Array.isArray(entry)) return entry;
  if (typeof entry === "object" && Array.isArray(entry.rows)) {
    return entry.rows;
  }
  return [] as FailureCacheRow[];
};

const extractRowData = (row: FailureCacheRow): { timestamp: number | null; type: FailureType | null } => {
  if (Array.isArray(row)) {
    return {
      timestamp: toTimestamp(row[0]),
      type: toFailureType(row[1]),
    };
  }
  if (row && typeof row === "object") {
    const record = row as Record<string, unknown>;
    return {
      timestamp: toTimestamp(record.failure_date ?? record.date ?? record.timestamp ?? record.time),
      type: toFailureType(record.type_failure ?? record.type),
    };
  }
  return { timestamp: null, type: null };
};

export const getLatestFailureType = (
  entry: FailuresCacheEntry | FailureCacheRow[] | null | undefined
): FailureType | null => {
  const rows = getFailureRows(entry);

  let latest: { timestamp: number; type: FailureType | null } | null = null;

  for (const row of rows) {
    const { timestamp, type } = extractRowData(row);
    if (timestamp === null) continue;

    if (!latest || timestamp > latest.timestamp) {
      latest = { timestamp, type };
    }
  }

  return latest?.type ?? null;
};

export const buildLastFailureTypeById = (
  cache: FailuresCache | null | undefined
): Map<string, FailureType> => {
  const items = cache?.items;
  if (!items || typeof items !== "object") {
    return new Map();
  }

  const result = new Map<string, FailureType>();
  Object.entries(items).forEach(([componentId, entry]) => {
    const type = getLatestFailureType(entry as FailuresCacheEntry | FailureCacheRow[] | null);
    if (type) {
      result.set(componentId, type);
    }
  });

  return result;
};