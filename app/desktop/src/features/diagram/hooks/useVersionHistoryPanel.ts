import { useCallback, useState } from "react";

export const useVersionHistoryPanel = () => {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  return {
    isOpen,
    open,
    close,
    toggle,
  };
};