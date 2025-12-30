type SearchInputProps = {
  query: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  showExisting: boolean;
  onToggleShowExisting: (value: boolean) => void;
  summary: string;
};

export const SearchInput = ({
  query,
  onChange,
  onSearch,
  showExisting,
  onToggleShowExisting,
  summary,
}: SearchInputProps) => {
  return (
    <div className="add-component-panel__search">
      <label className="add-component-panel__label" htmlFor="component-search">
        Buscar
      </label>

      <input
        id="component-search"
        className="add-component-panel__input"
        type="search"
        placeholder="Ingresa un ID o nombre"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          onSearch();
        }}
      />

      <div className="add-component-panel__filters">
        <label className="add-component-panel__filter">
          <input
            type="checkbox"
            checked={showExisting}
            onChange={(event) => onToggleShowExisting(event.target.checked)}
          />
          Mostrar ya agregados
        </label>
      </div>

      <p className="add-component-panel__summary">{summary}</p>
    </div>
  );
};