import {
  findLabelKindMatches,
  findTechnicalKindMatches,
} from "./eventKindLabels";
import type { EventSearchCriteria } from "../../../services/eventSearchService";

const INTEGER_REGEX = /^\d+$/;
const TIMESTAMP_REGEX = /^\d{4}-\d{2}(-\d{2})?$/;

const uniq = (values: string[]) => Array.from(new Set(values));

export const parseEventSearchInput = (
  input: string,
): EventSearchCriteria | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (INTEGER_REGEX.test(trimmed)) {
    return { type: "version", version: Number(trimmed) };
  }

  if (TIMESTAMP_REGEX.test(trimmed)) {
    return { type: "timestamp", value: trimmed };
  }

  const labelMatches = findLabelKindMatches(trimmed);
  const technicalMatches = findTechnicalKindMatches(trimmed);

  return {
    type: "kind",
    kindPrefix: trimmed,
    kindList: uniq([...labelMatches, ...technicalMatches]),
  };
};