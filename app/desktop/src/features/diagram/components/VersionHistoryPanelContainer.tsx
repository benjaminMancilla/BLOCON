import { useCallback, useEffect, useState } from "react";
import type { EventHistoryItem } from "../../../services/eventHistoryService";
import { EventContextMenu } from "./EventContextMenu";
import { VersionHistoryPanel } from "./VersionHistoryPanel";
import { useEventHistory } from "../hooks/useEventHistory";
import { useEventSearch } from "../hooks/useEventSearch";

type VersionHistoryPanelContainerProps = {
  isOpen: boolean;
  onClose: () => void;
  onViewDetails: (event: EventHistoryItem, version: number) => void;
  onShowVersion: (version: number) => void;
  onRebuild: (version: number) => void;
};

export const VersionHistoryPanelContainer = ({
  isOpen,
  onClose,
  onViewDetails,
  onShowVersion,
  onRebuild,
}: VersionHistoryPanelContainerProps) => {
  const history = useEventHistory({ isOpen });
  const search = useEventSearch({ isOpen });
  const [contextMenu, setContextMenu] = useState<{
    event: EventHistoryItem;
    version: number;
    position: { x: number; y: number };
  } | null>(null);

  const currentState = search.isActive ? search : history;

  useEffect(() => {
    if (!isOpen) {
      setContextMenu(null);
    }
  }, [isOpen]);

  const handleEventMenuOpen = useCallback(
    (
      event: EventHistoryItem,
      options: { version: number; position: { x: number; y: number } },
    ) => {
      setContextMenu({ event, ...options });
    },
    [],
  );

  const handleContextClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleViewDetails = useCallback(() => {
    if (!contextMenu) return;
    onViewDetails(contextMenu.event, contextMenu.version);
    setContextMenu(null);
  }, [contextMenu, onViewDetails]);

  const handleShowVersion = useCallback(() => {
    if (!contextMenu) return;
    onShowVersion(contextMenu.version);
    setContextMenu(null);
  }, [contextMenu, onShowVersion]);

  const handleRebuild = useCallback(() => {
    if (!contextMenu) return;
    onRebuild(contextMenu.version);
    setContextMenu(null);
  }, [contextMenu, onRebuild]);

  if (!isOpen) return null;

  return (
    <>
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
        onEventMenuOpen={handleEventMenuOpen}
      />
      <EventContextMenu
        isOpen={contextMenu !== null}
        position={contextMenu?.position ?? null}
        onClose={handleContextClose}
        onViewDetails={handleViewDetails}
        onShowVersion={handleShowVersion}
        onRebuild={handleRebuild}
      />
    </>
  );
};