import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { useEventHistory } from "../hooks/useEventHistory";

type VersionHistoryPanelContainerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const VersionHistoryPanelContainer = ({
  isOpen,
  onClose,
}: VersionHistoryPanelContainerProps) => {
  const history = useEventHistory({ isOpen });

  if (!isOpen) return null;

  return (
    <VersionHistoryPanel
      events={history.events}
      offset={history.offset}
      isLoading={history.isLoading}
      errorMessage={history.errorMessage}
      page={history.page}
      totalPages={history.totalPages}
      canGoNext={history.canGoNext}
      canGoPrevious={history.canGoPrevious}
      onNext={history.goNext}
      onPrevious={history.goPrevious}
      onClose={onClose}
    />
  );
};