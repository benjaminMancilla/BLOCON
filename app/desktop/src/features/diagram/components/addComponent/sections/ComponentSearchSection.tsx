import { useCallback } from "react";
import type { RemoteComponent } from "../../../../../services/remote/componentsService";
import { SearchInput } from "../components/SearchInput";
import { SearchResults } from "../components/SearchResults";
import type { ComponentSearchResult } from "../hooks/useComponentSearch";
import { useShakeAnimation } from "../hooks/useShakeAnimation";

type ComponentSearchSectionProps = {
  existingNodeIds: Set<string>;
  onComponentSelect: (component: RemoteComponent) => void;
  searchState: ComponentSearchResult;
};

export const ComponentSearchSection = ({
  existingNodeIds,
  onComponentSelect,
  searchState,
}: ComponentSearchSectionProps) => {
  const {
    query,
    setQuery,
    filteredResults,
    summary,
    showExisting,
    setShowExisting,
    triggerSearch,
    resetSearch,
  } = searchState;
  const { shakingItems, triggerShake } = useShakeAnimation({ durationMs: 420 });

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (!value.trim()) {
        resetSearch();
      }
    },
    [resetSearch, setQuery],
  );

  const handleSelect = useCallback(
    (item: RemoteComponent) => {
      if (existingNodeIds.has(item.id)) {
        triggerShake(item.id);
        return;
      }
      onComponentSelect(item);
    },
    [existingNodeIds, onComponentSelect, triggerShake],
  );

  return (
    <>
      <SearchInput
        query={query}
        onChange={handleQueryChange}
        onSearch={triggerSearch}
        showExisting={showExisting}
        onToggleShowExisting={setShowExisting}
        summary={summary}
      />
      <SearchResults
        results={filteredResults}
        existingNodeIds={existingNodeIds}
        shakingItems={shakingItems}
        onSelect={handleSelect}
      />
    </>
  );
};