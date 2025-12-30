import type { PropsWithChildren } from "react";

type CollapsibleFieldsetProps = PropsWithChildren<{
  legend: string;
  isOpen: boolean;
  onToggle: () => void;
  className: string;
  legendClassName: string;
  collapsedClassName?: string;
  contentId: string;
  contentClassName?: string;
}>;

export const CollapsibleFieldset = ({
  legend,
  isOpen,
  onToggle,
  className,
  legendClassName,
  collapsedClassName,
  contentId,
  contentClassName,
  children,
}: CollapsibleFieldsetProps) => {
  const classNames = `${className}${isOpen ? "" : ` ${collapsedClassName ?? ""}`}`;

  return (
    <fieldset className={classNames}>
      <legend className={legendClassName}>
        {legend}
        <button
          className="add-component-panel__section-toggle"
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={contentId}
        >
          {isOpen ? "▾" : "▴"}
        </button>
      </legend>
      {isOpen ? (
        <div id={contentId} className={contentClassName}>
          {children}
        </div>
      ) : null}
    </fieldset>
  );
};