import type { RemoteComponent } from "../../../../../services/remote/componentsService";

type ComponentResultItemProps = {
  item: RemoteComponent;
  isExisting: boolean;
  isShaking: boolean;
  onSelect: (item: RemoteComponent) => void;
};

export const ComponentResultItem = ({
  item,
  isExisting,
  isShaking,
  onSelect,
}: ComponentResultItemProps) => {
  const title = item.title ?? item.kks_name ?? item.id;
  const meta = [item.type, item.SubType].filter(Boolean).join(" • ");

  return (
    <button
      className={`add-component-panel__result${
        isExisting ? " add-component-panel__result--disabled" : ""
      }${isShaking ? " add-component-panel__result--shake" : ""}`}
      role="listitem"
      type="button"
      aria-disabled={isExisting}
      onClick={() => onSelect(item)}
    >
      <div className="add-component-panel__result-title">{title}</div>
      <div className="add-component-panel__result-meta">
        <span>{item.id}</span>
        {meta ? <span>{meta}</span> : null}
      </div>
    </button>
  );
};