import type { CloudError } from "./cloudErrors";
import { parseCloudErrorPayload } from "./cloudErrors";

export type CloudErrorState = {
  cloudError: CloudError | null;
  isModalOpen: boolean;
  actionLoading: "cancel" | "retry" | null;
  actionError: string | null;
};

const listeners = new Set<() => void>();

let state: CloudErrorState = {
  cloudError: null,
  isModalOpen: false,
  actionLoading: null,
  actionError: null,
};

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const setState = (next: Partial<CloudErrorState>) => {
  state = { ...state, ...next };
  emitChange();
};

export const subscribeToCloudError = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getCloudErrorState = () => state;

export const openCloudError = (error: CloudError) => {
  setState({
    cloudError: error,
    isModalOpen: true,
    actionLoading: null,
    actionError: null,
  });
};

export const clearCloudError = () => {
  setState({
    cloudError: null,
    isModalOpen: false,
    actionLoading: null,
    actionError: null,
  });
};

export const setCloudActionLoading = (
  value: CloudErrorState["actionLoading"],
) => {
  setState({ actionLoading: value });
};

export const setCloudActionError = (message: string | null) => {
  setState({ actionError: message });
};

export const handleApiErrorPayload = (payload: unknown) => {
  const cloudError = parseCloudErrorPayload(payload);
  if (cloudError?.retryable && cloudError.hasPendingOperation) {
    openCloudError(cloudError);
  }
  return cloudError;
};