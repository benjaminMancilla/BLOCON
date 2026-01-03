// features/diagram/components/ToastContainer.tsx
import type { Toast } from "../hooks/useToasts";

type ToastContainerProps = {
  toasts: Toast[];
  onDismiss: (id: string) => void;
};

const getCategoryClassName = (category: Toast["category"]) => {
  const baseClass = "diagram-toast";
  switch (category) {
    case "cloud":
      return `${baseClass} diagram-cloud-toast`;
    case "draft":
      return `${baseClass} diagram-draft-toast`;
    case "view":
      return `${baseClass} diagram-draft-toast`;
    case "delete":
      return `${baseClass} diagram-delete-toast`;
    case "insert":
      return `${baseClass} diagram-insert-toast`;
    case "rebuild":
      return `${baseClass} diagram-rebuild-toast`;
    default:
      return baseClass;
  }
};

const getTypeClassName = (type: Toast["type"]) => {
  switch (type) {
    case "success":
      return "diagram-toast--success";
    case "error":
      return "diagram-toast--error";
    case "warning":
      return "diagram-toast--warning";
    case "info":
      return "diagram-toast--info";
    default:
      return "";
  }
};

export const ToastContainer = ({ toasts, onDismiss }: ToastContainerProps) => {
  if (toasts.length === 0) return null;

  return (
    <div className="diagram-toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${getCategoryClassName(toast.category)} ${getTypeClassName(toast.type)}`}
          role="status"
          aria-live="polite"
          onClick={() => onDismiss(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};