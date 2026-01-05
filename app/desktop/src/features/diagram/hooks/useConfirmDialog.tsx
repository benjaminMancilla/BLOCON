import { useCallback, useRef, useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";

type ConfirmDialogOptions = {
  title: string;
  description: string;
  confirmLabel?: string;
  confirmTone?: "primary" | "danger";
};

export const useConfirmDialog = () => {
  const resolverRef = useRef<(value: boolean) => void>();
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);

  const confirm = useCallback((nextOptions: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setOptions(nextOptions);
    });
  }, []);

  const handleCancel = useCallback(() => {
    resolverRef.current?.(false);
    resolverRef.current = undefined;
    setOptions(null);
  }, []);

  const handleConfirm = useCallback(() => {
    resolverRef.current?.(true);
    resolverRef.current = undefined;
    setOptions(null);
  }, []);

  const dialog = options ? (
    <ConfirmDialog
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel}
      confirmTone={options.confirmTone}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
    />
  ) : null;

  return {
    confirm,
    dialog,
  };
};