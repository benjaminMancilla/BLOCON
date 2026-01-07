import type { HTMLAttributes } from "react";

type PillTone =
  | "neutral"
  | "warning"
  | "success"
  | "danger"
  | "purple"
  | "blue"
  | "orange";

type PillProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: PillTone;
  className?: string;
};

export const Pill = ({
  tone = "neutral",
  className,
  ...props
}: PillProps) => {
  return (
    <span
      {...props}
      className={`ui-pill ui-pill--${tone}${className ? ` ${className}` : ""}`}
    />
  );
};