import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { useEventHistory } from "../hooks/useEventHistory";
import { useEventSearch } from "../hooks/useEventSearch";

type VersionHistoryPanelContainerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const VersionHistoryPanelContainer = ({
  isOpen,
  onClose,
}: VersionHistoryPanelContainerProps) => {
  const history = useEventHistory({ isOpen });
  const search = useEventSearch({ isOpen });

  const currentState = search.isActive ? search : history;

  if (!isOpen) return null;

  return (
    <VersionHistoryPanel
      events={currentState.events}
      offset={currentState.offset}
      isLoading={currentState.isLoading}
      errorMessage={currentState.errorMessage}
      searchQuery={search.query}
      onSearchChange={search.updateQuery}
      onSearchSubmit={search.submitSearch}
      page={currentState.page}
      totalPages={currentState.totalPages}
      canGoNext={currentState.canGoNext}
      canGoPrevious={currentState.canGoPrevious}
      onNext={currentState.goNext}
      onPrevious={currentState.goPrevious}
      onClose={onClose}
    />
  );
};