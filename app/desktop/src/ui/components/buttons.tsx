import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  className?: string;
};

export const PrimaryButton = ({ className, ...props }: ButtonProps) => {
  return (
    <button
      {...props}
      className={`ui-button ui-button--primary${className ? ` ${className}` : ""}`}
    />
  );
};

export const SecondaryButton = ({ className, ...props }: ButtonProps) => {
  return (
    <button
      {...props}
      className={`ui-button ui-button--secondary${className ? ` ${className}` : ""}`}
    />
  );
};

export const DangerButton = ({ className, ...props }: ButtonProps) => {
  return (
    <button
      {...props}
      className={`ui-button ui-button--danger${className ? ` ${className}` : ""}`}
    />
  );
};