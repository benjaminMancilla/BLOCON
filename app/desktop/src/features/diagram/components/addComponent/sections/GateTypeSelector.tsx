import { useEffect, useState, type CSSProperties } from "react";
import type { GateType } from "../../../types/gates";
import { buildGateColorVars, resolveGateColor } from "../../../utils/gateColors";
import { CollapsibleFieldset } from "../components/CollapsibleFieldset";

type GateOption = {
  value: GateType;
  label: string;
};

type GateTypeSelectorProps = {
  value: GateType | null;
  onChange: (value: GateType) => void;
  options: GateOption[];
  resetToken: number;
  resetKey: string;
};

export const GateTypeSelector = ({
  value,
  onChange,
  options,
  resetToken,
  resetKey,
}: GateTypeSelectorProps) => {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setIsOpen(true);
  }, [resetKey, resetToken]);

  return (
    <CollapsibleFieldset
      legend="Tipo de gate"
      isOpen={isOpen}
      onToggle={() => setIsOpen((prev) => !prev)}
      className="add-component-panel__gate"
      collapsedClassName="add-component-panel__gate--collapsed"
      legendClassName="add-component-panel__gate-label"
      contentId="add-component-gate-type"
      contentClassName="add-component-panel__gate-options"
    >
      {options.map((option) => {
        const gateColor = resolveGateColor(option.value, null);
        const colorVars = buildGateColorVars(gateColor) as CSSProperties;
        return (
          <label key={option.value} className="add-component-panel__gate-option">
            <input
              type="radio"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="add-component-panel__gate-icon" style={colorVars}>
              {option.label}
            </span>
            <span className="add-component-panel__gate-text">
              {option.label}
            </span>
          </label>
        );
      })}
    </CollapsibleFieldset>
  );
};