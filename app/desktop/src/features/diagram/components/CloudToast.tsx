type CloudToastProps = {
  message: string;
  type: "success" | "error";
};

export const CloudToast = ({ message, type }: CloudToastProps) => (
  <div
    className={`diagram-cloud-toast diagram-cloud-toast--${type}`}
    role="status"
    aria-live="polite"
  >
    {message}
  </div>
);