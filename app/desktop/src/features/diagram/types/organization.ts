import type { AddComponentFormState } from "./addComponent";
import type { GateType } from "./gates";

export type OrganizationInsertTarget = {
  hostId: string;
  hostType: "gate" | "component";
  relationType: GateType | null;
};

export type OrganizationInsertPosition = {
  index: number | null;
  referenceId: string | null;
};

export type OrganizationInsertData = AddComponentFormState & {
  target: OrganizationInsertTarget | null;
  position: OrganizationInsertPosition;
};

export type OrganizationReorderEntry = {
  position: number;
  id: string;
};

export type OrganizationPayload = {
  insert: OrganizationInsertData;
  reorder: OrganizationReorderEntry[] | null;
};

export type OrganizationUiState = {
  gateId: string;
  placeholderId: string;
  gateSubtype: GateType | null;
  order: string[];
  initialOrder: string[];
};