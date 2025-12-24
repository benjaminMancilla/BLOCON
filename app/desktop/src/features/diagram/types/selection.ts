export type DiagramNodeType = "gate" | "component";

export type DiagramNodeSelection = {
  id: string;
  type: DiagramNodeType;
  name?: string | null;
};

export type SelectionStatus = "selecting" | "idle" | "selected";