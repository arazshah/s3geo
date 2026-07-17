import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  XCircle
} from "lucide-react";

import { cx } from "../../utils/cx";

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export type AppToast = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
};

type ToastContainerProps = {
  toasts: AppToast[];
  onDismiss: (id: string) => void;
};

function ToastIcon({ type }: { type: ToastType }) {
  if (type === "success") {
    return <CheckCircle2 size={18} className="text-emerald-600" />;
  }

  if (type === "error") {
    return <XCircle size={18} className="text-red-600" />;
  }

  if (type === "warning") {
    return <AlertTriangle size={18} className="text-amber-600" />;
  }

  if (type === "loading") {
    return <Loader2 size={18} className="animate-spin text-blue-600" />;
  }

  return <Info size={18} className="text-blue-600" />;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (!toasts.length) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[999999] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cx(
            "pointer-events-auto flex gap-3 rounded-2xl border bg-white p-4 shadow-2xl shadow-slate-900/12 backdrop-blur",
            toast.type === "success" && "border-emerald-100",
            toast.type === "error" && "border-red-100",
            toast.type === "warning" && "border-amber-100",
            toast.type === "info" && "border-blue-100",
            toast.type === "loading" && "border-blue-100"
          )}
        >
          <div className="mt-0.5 shrink-0">
            <ToastIcon type={toast.type} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-extrabold text-slate-900">
              {toast.title}
            </div>

            {toast.message && (
              <div className="mt-1 text-xs leading-5 text-slate-600">
                {toast.message}
              </div>
            )}
          </div>

          <button
            onClick={() => onDismiss(toast.id)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            title="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
