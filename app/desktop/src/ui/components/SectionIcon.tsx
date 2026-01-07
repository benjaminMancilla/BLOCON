import type { ReactNode } from "react";
import { IconBadge } from "./IconBadge";

type SectionIconProps = {
  icon: ReactNode;
  tone?: "blue" | "orange" | "purple" | "danger" | "neutral" | "teal";
  className?: string;
};

export const SectionIcon = ({
  icon,
  tone = "blue",
  className,
}: SectionIconProps) => {
  return (
    <IconBadge
      icon={icon}
      tone={tone}
      className={`ui-section-icon${className ? ` ${className}` : ""}`}
    />
  );
};