import { useCallback } from "react";
import type { RemoteComponent } from "../../../../../services/remote/componentsService";
import { SearchInput } from "../components/SearchInput";
import { SearchResults } from "../components/SearchResults";
import { useComponentSearch } from "../hooks/useComponentSearch";
import { useShakeAnimation } from "../hooks/useShakeAnimation";

type ComponentSearchSectionProps = {
  existingNodeIds: Set<string>;
  onComponentSelect: (component: RemoteComponent) => void;
};

const ENTER_DEBOUNCE_MS = 650;
const MIN_QUERY_LEN = 2;

export const ComponentSearchSection = ({
  existingNodeIds,
  onComponentSelect,
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
  } = useComponentSearch({
    minQueryLength: MIN_QUERY_LEN,
    debounceMs: ENTER_DEBOUNCE_MS,
    existingIds: existingNodeIds,
  });
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