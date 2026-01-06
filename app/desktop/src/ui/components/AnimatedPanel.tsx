import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type AnimatedPanelProps<T extends ElementType> = {
  as?: T;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export const AnimatedPanel = <T extends ElementType = "div">({
  as,
  className,
  children,
  ...rest
}: AnimatedPanelProps<T>) => {
  const Component = as ?? "div";
  return (
    <Component
      className={`ui-animated-panel${className ? ` ${className}` : ""}`}
      data-state="open"
      {...rest}
    >
      {children}
    </Component>
  );
};