import { useEffect, useState } from "react";
import { CollapsibleFieldset } from "../components/CollapsibleFieldset";
import type { AddComponentFormState } from "../../../types/addComponent";

type CalculationOption = {
  value: AddComponentFormState["calculationType"];
  label: string;
  icon: string;
};

type CalculationTypeSelectorProps = {
  value: AddComponentFormState["calculationType"];
  onChange: (value: AddComponentFormState["calculationType"]) => void;
  options: CalculationOption[];
  resetToken: number;
};

export const CalculationTypeSelector = ({
  value,
  onChange,
  options,
  resetToken,
}: CalculationTypeSelectorProps) => {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setIsOpen(true);
  }, [resetToken]);

  return (
    <CollapsibleFieldset
      legend="Tipo de cálculo"
      isOpen={isOpen}
      onToggle={() => setIsOpen((prev) => !prev)}
      className="add-component-panel__calc"
      collapsedClassName="add-component-panel__calc--collapsed"
      legendClassName="add-component-panel__calc-label"
      contentId="add-component-calculation"
      contentClassName="add-component-panel__calc-options"
    >
      {options.map((option) => (
        <label key={option.value} className="add-component-panel__calc-option">
          <input
            type="radio"
            name="calculation-type"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          <span className="diagram-node__icon">{option.icon}</span>
          <span className="add-component-panel__calc-text">{option.label}</span>
        </label>
      ))}
    </CollapsibleFieldset>
  );
};