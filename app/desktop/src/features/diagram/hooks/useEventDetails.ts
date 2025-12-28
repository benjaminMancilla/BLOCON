import { useCallback, useMemo, useState } from "react";
import type { EventHistoryItem } from "../../../services/eventHistoryService";

type EventDetailsState = {
  event: EventHistoryItem;
  version: number;
};

const formatPayload = (payload: unknown): string => {
  if (payload === null || payload === undefined) return "";
  if (typeof payload === "string") return payload;
  try {
    return JSON.stringify(payload, null, 2);
  } catch (error) {
    return String(payload);
  }
};

export const useEventDetails = () => {
  const [state, setState] = useState<EventDetailsState | null>(null);

  const open = useCallback((event: EventHistoryItem, version: number) => {
    setState({ event, version });
  }, []);

  const close = useCallback(() => {
    setState(null);
  }, []);

  const payloadText = useMemo(() => {
    if (!state) return "";
    const payload =
      "payload" in state.event ? state.event.payload : state.event;
    return formatPayload(payload);
  }, [state]);

  return {
    isOpen: state !== null,
    event: state?.event ?? null,
    version: state?.version ?? null,
    payloadText,
    open,
    close,
  };
};