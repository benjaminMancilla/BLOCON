import type { CSSProperties, ReactNode } from "react";
import { gradientBySection, type GradientSection } from "../theme/gradients";

type GradientBackdropProps = {
  children: ReactNode;
  className?: string;
  section?: GradientSection;
  style?: CSSProperties;
  as?: keyof JSX.IntrinsicElements;
};

export const GradientBackdrop = ({
  children,
  className,
  section = "app",
  style,
  as: Component = "div",
}: GradientBackdropProps) => {
  const background = gradientBySection(section);
  return (
    <Component
      className={`ui-gradient-backdrop${className ? ` ${className}` : ""}`}
      data-section={section}
      style={{ background, ...style }}
    >
      {children}
    </Component>
  );
};