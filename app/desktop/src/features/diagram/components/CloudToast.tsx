type CloudToastProps = {
  message: string;
  type: "success" | "error";
  className?: string;
};

export const CloudToast = ({ message, type, className }: CloudToastProps) => (
  <div
    className={`diagram-cloud-toast diagram-cloud-toast--${type}${
      className ? ` ${className}` : ""
    }`}
    role="status"
    aria-live="polite"
  >
    {message}
  </div>
);