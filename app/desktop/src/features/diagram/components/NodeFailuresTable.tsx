import type { FailureRecord } from "../../../services/nodeDetailsApi";

const MAX_ROWS = 200;

const COLUMN_LABELS: Record<string, string> = {
  failure_date: "Fecha",
  type_failure: "Tipo",
  Component_ID: "Componente",
  component_id: "Componente",
  id: "ID",
};

const preferredKeys = [
  "failure_date",
  "type_failure",
  "Component_ID",
  "component_id",
  "id",
];

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : "—";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toString() : "—";
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
};

const isMonoKey = (key: string) => {
  const lowered = key.toLowerCase();
  return lowered.includes("date") || lowered.includes("time") || lowered.endsWith("id");
};

const formatColumnLabel = (key: string) => {
  if (COLUMN_LABELS[key]) return COLUMN_LABELS[key];
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
};

const buildColumnKeys = (records: FailureRecord[]) => {
  const keys: string[] = [];
  const seen = new Set<string>();

  for (const key of preferredKeys) {
    if (records.some((record) => key in record)) {
      keys.push(key);
      seen.add(key);
    }
  }

  for (const record of records) {
    Object.keys(record).forEach((key) => {
      if (!seen.has(key)) {
        keys.push(key);
        seen.add(key);
      }
    });
  }

  return keys;
};

type NodeFailuresTableProps = {
  failures?: {
    count: number;
    records: FailureRecord[];
  } | null;
  maxRows?: number;
};

export const NodeFailuresTable = ({
  failures,
  maxRows = MAX_ROWS,
}: NodeFailuresTableProps) => {
  const records = failures?.records ?? [];
  const total = failures?.count ?? records.length;

  if (total === 0) {
    return (
      <div className="node-failures-table__empty">Sin historial local</div>
    );
  }

  const cappedRecords = records.slice(0, maxRows);
  const columns = buildColumnKeys(cappedRecords);
  const showCount = total > cappedRecords.length;

  return (
    <div className="node-failures-table">
      {showCount ? (
        <div className="node-failures-table__meta">
          Mostrando {cappedRecords.length} de {total} registros
        </div>
      ) : null}
      <div className="node-failures-table__scroll">
        <table className="node-failures-table__table">
          <thead>
            <tr>
              {columns.map((key) => (
                <th key={key}>{formatColumnLabel(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cappedRecords.map((record, index) => (
              <tr key={`${record.Component_ID ?? record.component_id ?? "row"}-${index}`}>
                {columns.map((key) => (
                  <td
                    key={`${key}-${index}`}
                    className={
                      isMonoKey(key)
                        ? "node-failures-table__cell node-failures-table__cell--mono"
                        : "node-failures-table__cell"
                    }
                  >
                    {formatValue(record[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};