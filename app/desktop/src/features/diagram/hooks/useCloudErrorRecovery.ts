import { useCallback, useSyncExternalStore } from "react";
import {
  clearCloudError,
  getCloudErrorState,
  handleApiErrorPayload,
  setCloudActionError,
  setCloudActionLoading,
  subscribeToCloudError,
} from "../../../services/cloudErrorStore";
import {
  cancelCloudOperation,
  retryCloudOperation,
} from "../../../services/graphService";

type CloudRecoveryOptions = {
  onRetrySuccess?: () => void;
  onCancelSuccess?: () => void;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "No se pudo completar la operación.";

export const useCloudErrorRecovery = (options: CloudRecoveryOptions = {}) => {
  const state = useSyncExternalStore(subscribeToCloudError, getCloudErrorState);

  const clear = useCallback(() => {
    clearCloudError();
  }, []);

  const retry = useCallback(async () => {
    if (state.actionLoading) return;
    setCloudActionLoading("retry");
    setCloudActionError(null);
    try {
      await retryCloudOperation();
      clearCloudError();
      options.onRetrySuccess?.();
    } catch (error) {
      setCloudActionError(getErrorMessage(error));
    } finally {
      setCloudActionLoading(null);
    }
  }, [options, state.actionLoading]);

  const cancel = useCallback(async () => {
    if (state.actionLoading) return;
    setCloudActionLoading("cancel");
    setCloudActionError(null);
    try {
      await cancelCloudOperation();
      clearCloudError();
      options.onCancelSuccess?.();
    } catch (error) {
      setCloudActionError(getErrorMessage(error));
    } finally {
      setCloudActionLoading(null);
    }
  }, [options, state.actionLoading]);

  return {
    ...state,
    retry,
    cancel,
    clear,
    handleApiError: handleApiErrorPayload,
  };
};