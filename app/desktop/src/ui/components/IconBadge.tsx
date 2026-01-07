import type { ReactNode } from "react";

type IconTone = "blue" | "orange" | "purple" | "danger" | "neutral" | "teal";

type IconBadgeProps = {
  icon: ReactNode;
  tone?: IconTone;
  className?: string;
};

export const IconBadge = ({
  icon,
  tone = "blue",
  className,
}: IconBadgeProps) => {
  return (
    <span
      className={`ui-icon-badge ui-icon-badge--${tone}${
        className ? ` ${className}` : ""
      }`}
    >
      {icon}
    </span>
  );
};