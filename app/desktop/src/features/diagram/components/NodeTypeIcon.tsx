import { getComponentIcon, getGateIcon } from "../icons/iconRegistry";

type NodeTypeIconProps = {
  kind: "component" | "gate";
  type?: string | null;
  subtype?: string | null;
  size?: number;
  className?: string;
};

export const NodeTypeIcon = ({
  kind,
  type,
  subtype,
  size = 32,
  className,
}: NodeTypeIconProps) => {
  const src = kind === "gate" ? getGateIcon(subtype) : getComponentIcon(type);
  const label = kind === "gate" ? subtype ?? "gate" : type ?? "component";
  const alt = `Icono de ${kind} ${label || "genérico"}`;

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
};