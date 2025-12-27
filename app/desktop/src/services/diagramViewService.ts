import { BACKEND_ENDPOINT } from "./graphService";

export type DiagramViewState = {
  collapsedGateIds: string[];
};

export async function fetchDiagramView(): Promise<DiagramViewState> {
  console.log('[FETCH] Loading Diagram View');
  const response = await fetch(`${BACKEND_ENDPOINT}/diagram-view`);
  if (!response.ok) {
    throw new Error(`Backend responded with ${response.status}`);
  }
  console.log('[FETCH] Diagram View Loaded!');
  return (await response.json()) as DiagramViewState;
}

export async function saveDiagramView(view: DiagramViewState): Promise<void> {
  console.log('[SAVE] Saving Diagram View (PUT)');
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
  console.log('[SAVE] Diagram View Saved!');
}