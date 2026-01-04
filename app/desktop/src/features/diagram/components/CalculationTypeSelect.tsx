import type { KeyboardEventHandler } from "react";
import type { CalculationType } from "../types/addComponent";
import { calculationTypeOptions } from "../icons/calculationTypeIcons";

type CalculationTypeSelectProps = {
  id?: string;
  value: CalculationType;
  onChange: (value: CalculationType) => void;
  disabled?: boolean;
  className?: string;
  onKeyDown?: KeyboardEventHandler<HTMLSelectElement>;
};

export const CalculationTypeSelect = ({
  id,
  value,
  onChange,
  disabled,
  className,
  onKeyDown,
}: CalculationTypeSelectProps) => {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value as CalculationType)}
      disabled={disabled}
      className={`node-info-panel__field-select${className ? ` ${className}` : ""}`}
      onKeyDown={onKeyDown}
    >
      {calculationTypeOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {`${option.icon} ${option.label}`}
        </option>
      ))}
    </select>
  );
};