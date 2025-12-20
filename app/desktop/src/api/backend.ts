export type GraphNode = {
  id: string;
  type: string;
  subtype?: string | null;
  k?: number | null;
  unit_type?: string | null;
  dist?: { kind?: string | null } | null;
  reliability?: number | null;
  conflict?: boolean;
};

export type GraphEdge = {
  from: string;
  to: string;
};

export type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  root?: string | null;
  reliability_total?: number | null;
};

const backendEndpoint = import.meta.env.VITE_BACKEND_ENDPOINT as string | undefined;

export const BACKEND_ENDPOINT = backendEndpoint ?? "http://127.0.0.1:8000";

export async function fetchGraph(): Promise<GraphResponse> {
  const response = await fetch(`${BACKEND_ENDPOINT}/graph`);
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}`);
  }
  return (await response.json()) as GraphResponse;
}