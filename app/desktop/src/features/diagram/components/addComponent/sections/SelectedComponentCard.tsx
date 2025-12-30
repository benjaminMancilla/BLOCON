import { useEffect, useState } from "react";
import type { RemoteComponent } from "../../../../../services/remote/componentsService";

type SelectedComponentCardProps = {
  component: RemoteComponent;
  onClear: () => void;
  resetToken: number;
};

export const SelectedComponentCard = ({
  component,
  onClear,
  resetToken,
}: SelectedComponentCardProps) => {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setIsOpen(true);
  }, [component.id, resetToken]);

  return (
    <div className="add-component-panel__selected">
      <p className="add-component-panel__selected-label">
        Componente seleccionado
        <button
          className="add-component-panel__section-toggle"
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls="add-component-selected"
        >
          {isOpen ? "▾" : "▴"}
        </button>
      </p>
      {isOpen ? (
        <div
          className="add-component-panel__selected-card"
          id="add-component-selected"
        >
          <div className="add-component-panel__selected-header">
            <div>
              <div className="add-component-panel__selected-title">
                {component.title ?? component.kks_name ?? component.id}
              </div>
              <div className="add-component-panel__selected-meta">
                <span>{component.id}</span>
                {[component.type, component.SubType].filter(Boolean).length ? (
                  <span>
                    {[component.type, component.SubType]
                      .filter(Boolean)
                      .join(" • ")}
                  </span>
                ) : null}
              </div>
            </div>
            <button
              className="add-component-panel__selected-clear"
              type="button"
              onClick={onClear}
              aria-label="Deseleccionar componente"
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};