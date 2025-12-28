export const EVENT_KIND_LABELS: Record<string, string> = {
  add_component: "Agregar componente",
  add_component_relative: "Agregar componente",
  add_root_component: "Agregar raíz",
  add_gate: "Agregar gate",
  add_edge: "Agregar enlace",
  delete_node: "Eliminar nodo",
  remove_node: "Eliminar nodo",
  move_node: "Mover nodo",
  rename_node: "Renombrar nodo",
  update_node: "Actualizar nodo",
  set_head: "Establecer versión",
  edit_component: "Editar componente",
  edit_gate: "Editar gate",
  set_ignore_range: "Ignorar rango",
  snapshot: "Snapshot",
};

const toTitleCase = (value: string) =>
  value
    .split(" ")
    .map((word) =>
      word ? `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}` : word,
    )
    .join(" ");

export const formatEventKind = (kind?: string) => {
  const raw = typeof kind === "string" ? kind.trim() : "";
  if (!raw) return "Evento";
  return EVENT_KIND_LABELS[raw] ?? toTitleCase(raw.replace(/_/g, " "));
};

const normalize = (value: string) => value.trim().toLowerCase();

export const findLabelKindMatches = (query: string): string[] => {
  const normalized = normalize(query);
  if (!normalized) return [];
  return Object.entries(EVENT_KIND_LABELS)
    .filter(([, label]) => normalize(label).includes(normalized))
    .map(([key]) => key);
};

export const findTechnicalKindMatches = (query: string): string[] => {
  const normalized = normalize(query);
  if (!normalized) return [];
  return Object.keys(EVENT_KIND_LABELS).filter((key) =>
    normalize(key).startsWith(normalized),
  );
};