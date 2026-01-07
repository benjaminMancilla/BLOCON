import type { ReactNode } from "react";

type SurfaceCardProps = {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
};

export const SurfaceCard = ({
  children,
  className,
  as: Component = "div",
}: SurfaceCardProps) => {
  return (
    <Component className={`ui-surface-card${className ? ` ${className}` : ""}`}>
      {children}
    </Component>
  );
};