import type { RemoteComponent } from "../../../../../services/remote/componentsService";
import { ComponentResultItem } from "./ComponentResultItem";

type SearchResultsProps = {
  results: RemoteComponent[];
  existingNodeIds: Set<string>;
  shakingItems: Record<string, boolean>;
  onSelect: (item: RemoteComponent) => void;
};

export const SearchResults = ({
  results,
  existingNodeIds,
  shakingItems,
  onSelect,
}: SearchResultsProps) => {
  return (
    <div className="add-component-panel__results" role="list">
      {results.map((item) => (
        <ComponentResultItem
          key={item.id}
          item={item}
          isExisting={existingNodeIds.has(item.id)}
          isShaking={Boolean(shakingItems[item.id])}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};