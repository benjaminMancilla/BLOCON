import { BACKEND_ENDPOINT } from "./graphService";

export type DiagramViewState = {
  collapsedGateIds: string[];
};

export async function fetchDiagramView(): Promise<DiagramViewState> {
  const response = await fetch(`${BACKEND_ENDPOINT}/diagram-view`);
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}`);
  }
  return (await response.json()) as DiagramViewState;
}

export async function saveDiagramView(view: DiagramViewState): Promise<void> {
  const response = await fetch(`${BACKEND_ENDPOINT}/diagram-view`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(view),
  });
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}`);
  }
}